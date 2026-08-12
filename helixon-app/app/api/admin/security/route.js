// app/api/admin/security/route.js
// GET  — returns security events, blocked IPs, login attempt stats
// POST — block or unblock an IP
import { supabase } from "@/lib/supabase";
import { getAdminSession } from "@/lib/admin-auth";

function authCheck(request) {
  return getAdminSession().then((s) => {
    if (s) return s;
    const k = request.headers.get("x-admin-key");
    return k === process.env.ADMIN_KEY ? { username: "api-key" } : null;
  });
}

export async function GET(request) {
  const session = await authCheck(request);
  if (!session) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const h72 = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const [
      { data: events },
      { data: blocked },
      { data: loginAttempts },
    ] = await Promise.all([
      supabase
        .from("security_events")
        .select("*")
        .order("ts", { ascending: false })
        .limit(200),
      supabase
        .from("blocked_ips")
        .select("*")
        .order("blocked_at", { ascending: false }),
      supabase
        .from("login_attempts")
        .select("ip, username, login_type, success, ts")
        .gte("ts", h72)
        .order("ts", { ascending: false })
        .limit(500),
    ]);

    const safeEvents  = events || [];
    const safeBlocked = blocked || [];
    const safeLogins  = loginAttempts || [];

    // Aggregate: failed logins per IP in last 72h
    const failedByIP = {};
    safeLogins.filter((l) => !l.success).forEach((l) => {
      failedByIP[l.ip] = (failedByIP[l.ip] || 0) + 1;
    });
    const topFailedIPs = Object.entries(failedByIP)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    // Severity summary
    const severitySummary = { low: 0, medium: 0, high: 0, critical: 0 };
    safeEvents.filter((e) => !e.resolved).forEach((e) => {
      if (e.severity in severitySummary) severitySummary[e.severity]++;
    });

    // Unresolved count
    const unresolvedCount = safeEvents.filter((e) => !e.resolved).length;

    return Response.json({
      ok: true,
      summary: { unresolvedCount, severitySummary, blockedIPCount: safeBlocked.length },
      events: safeEvents,
      blocked: safeBlocked,
      topFailedIPs,
      recentLogins: safeLogins.slice(0, 50),
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await authCheck(request);
  if (!session) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const { action, ip, reason, eventId } = await request.json();

    // ── Block an IP ────────────────────────────────────────────────────────────
    if (action === "block_ip") {
      if (!ip) return Response.json({ ok: false, error: "IP required." }, { status: 400 });

      const { error } = await supabase.from("blocked_ips").upsert({
        ip,
        reason: reason || "Manually blocked by admin",
        blocked_by: session.username || "admin",
        blocked_at: new Date().toISOString(),
      }, { onConflict: "ip" });

      // Log the block as a security event
      await supabase.from("security_events").insert({
        event_type: "ip_blocked",
        severity: "high",
        ip,
        detail: { blocked_by: session.username, reason },
      });

      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true });
    }

    // ── Unblock an IP ──────────────────────────────────────────────────────────
    if (action === "unblock_ip") {
      if (!ip) return Response.json({ ok: false, error: "IP required." }, { status: 400 });
      const { error } = await supabase.from("blocked_ips").delete().eq("ip", ip);
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true });
    }

    // ── Resolve a security event ───────────────────────────────────────────────
    if (action === "resolve_event") {
      if (!eventId) return Response.json({ ok: false, error: "eventId required." }, { status: 400 });
      const { error } = await supabase
        .from("security_events")
        .update({ resolved: true })
        .eq("id", eventId);
      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}