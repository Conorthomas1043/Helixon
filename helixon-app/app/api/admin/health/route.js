import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin-csrf";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin-audit";
import { getServicesSnapshot } from "@/lib/ops/live-services";
import { getFullHealthChecksSnapshot } from "@/lib/ops/health-checks";
import { gradeHealth } from "@/lib/ops/health-grade";
import { cleanSetting, getSiteSettings, saveSiteSetting } from "@/lib/site-settings";

// Single combined "is the site actually working" snapshot: the existing
// live-services checks (Stripe/Clerk/Redis/Resend/Sentry) plus the database
// itself, the AI providers the product runs on, and a live check that a
// curated set of public pages still return 200 - see lib/ops/health-checks.js
// for why each of those didn't already exist. Split into two files by what
// they check (paid third-party services vs this app's own infrastructure),
// merged here so the admin page/mobile tab only needs one request.
//
// Each run is graded (lib/ops/health-grade.js, honouring checks an admin
// has muted) and recorded in admin_health_snapshots for the history strip -
// at most once every RECORD_EVERY_MS unless the status changed, so a page
// left open doesn't flood the table.

const RECORD_EVERY_MS = 5 * 60 * 1000;
const HISTORY = 48;

function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function recordAndLoadHistory(supabase, grade, adminUsername) {
  const { data: history, error } = await supabase
    .from("admin_health_snapshots")
    .select("id,created_at,overall,failing,checked_by")
    .order("created_at", { ascending: false })
    .limit(HISTORY);
  // Table arrives with migration 20260929030000; no history before that.
  if (error) return null;

  const last = history?.[0];
  const changed = !last || last.overall !== grade.overall || String(last.failing) !== String(grade.failing);
  if (!changed && Date.now() - Date.parse(last.created_at) < RECORD_EVERY_MS) return history;

  const { data: inserted, error: insertError } = await supabase
    .from("admin_health_snapshots")
    .insert({ overall: grade.overall, failing: grade.failing, checked_by: adminUsername })
    .select("id,created_at,overall,failing,checked_by")
    .single();
  if (insertError) {
    console.error("[admin/health] Couldn't record snapshot:", insertError.message);
    return history;
  }
  return [inserted, ...(history || [])].slice(0, HISTORY);
}

export async function GET() {
  try {
    const admin = await requireAdminSession();

    const [services, checks, settings] = await Promise.all([getServicesSnapshot(), getFullHealthChecksSnapshot(), getSiteSettings({ fresh: true })]);
    const snapshot = { ...services, ...checks };
    const muted = settings.health?.muted || [];
    const grade = gradeHealth(snapshot, muted);
    const history = await recordAndLoadHistory(getAdminSupabase(), grade, admin.username);

    return json({ ...snapshot, grade, muted, history });
  } catch (error) {
    if (error?.message === "Unauthorized") return json({ error: "Unauthorized" }, 401);
    console.error("Admin health data error", error);
    return json({ error: "Unable to load health data" }, 500);
  }
}

// { muted: ["gemini", ...] } - checks that stay visible but no longer
// affect the overall status.
export async function PATCH(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const body = (await request.json().catch(() => null)) || {};
    const before = (await getSiteSettings({ fresh: true })).health;
    const value = cleanSetting("health", { muted: body.muted });

    try {
      await saveSiteSetting("health", value, admin.username);
    } catch (error) {
      if (error?.code === "42P01" || error?.code === "PGRST205") return json({ error: "Muting checks needs the admin_controls database migration." }, 409);
      throw error;
    }

    await writeAdminAudit({
      adminUsername: admin.username,
      action: "health_checks_muted",
      targetType: "site_setting",
      targetId: "health",
      metadata: { before: before?.muted || [], after: value.muted },
      request,
    });
    return json({ ok: true, muted: value.muted });
  } catch (error) {
    if (error?.message === "Unauthorized") return json({ error: "Unauthorized" }, 401);
    console.error("Admin health settings error", error);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
}
