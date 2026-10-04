import { isIP } from "node:net";
import { requireAdminSession } from "@/lib/admin/auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin/csrf";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin/audit";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin/http";
import { cleanLine } from "@/lib/sanitize";

// Pentester findings an admin has reviewed:
//   POST   { ip, reason }  dismiss everything that IP has done so far
//   DELETE { ip }          show its findings again
// Anything the IP does after a dismissal is flagged as normal.

function validIp(value) {
  const ip = String(value || "").trim();
  return isIP(ip) ? ip : null;
}

export async function POST(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const body = (await request.json().catch(() => null)) || {};
    const ip = validIp(body.ip);
    if (!ip) return json({ error: "A valid IP address is required." }, 400);
    const reason = cleanLine(body.reason, 200) || null;

    const { error } = await getAdminSupabase()
      .from("threat_dismissals")
      .upsert({ ip, reason, dismissed_by: admin.username, dismissed_at: new Date().toISOString() }, { onConflict: "ip" });
    if (error?.code === "42P01" || error?.code === "PGRST205") return json({ error: "Dismissing findings needs the latest database migration (admin_granular_controls)." }, 409);
    if (error) return adminDbError("threats", error);

    await writeAdminAudit({ adminUsername: admin.username, action: "threat_dismissed", targetType: "ip", targetId: ip, metadata: { ip, reason }, request });
    return json({ ok: true });
  } catch (error) {
    return adminErrorResponse("threats", error);
  }
}

export async function DELETE(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const body = (await request.json().catch(() => null)) || {};
    const ip = validIp(body.ip);
    if (!ip) return json({ error: "A valid IP address is required." }, 400);

    const { error } = await getAdminSupabase().from("threat_dismissals").delete().eq("ip", ip);
    if (error) return adminDbError("threats", error);

    await writeAdminAudit({ adminUsername: admin.username, action: "threat_restored", targetType: "ip", targetId: ip, metadata: { ip }, request });
    return json({ ok: true });
  } catch (error) {
    return adminErrorResponse("threats", error);
  }
}
