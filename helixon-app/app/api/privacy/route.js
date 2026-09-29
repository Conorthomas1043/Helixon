import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { getOrgMemberRole } from "@/lib/clerk-org";
import { RETENTION_CHOICES, getAgencyPrivacy } from "@/lib/privacy-settings";
import { upcomingRetention } from "@/lib/data-retention";

// The workspace's Data & privacy settings (/dashboard/privacy).
//
// GET                                   settings, who can change them, and
//                                       who is due for deletion / leaving
//                                       the talent pool in the next 30 days
// PATCH { retentionMonths?, presenceEnabled? }   owner or admin only
// POST { action: "keep", ids }          keep candidates past the retention
//                                       period for now: logged as activity,
//                                       which restarts their clock

async function canManage(auth) {
  const { data: agency } = await supabase.from("agencies").select("clerk_org_id").eq("id", auth.agencyId).maybeSingle();
  // No team yet: the only member is the owner.
  if (!agency?.clerk_org_id) return true;
  try {
    return (await getOrgMemberRole({ orgId: agency.clerk_org_id, userId: auth.userId })) === "org:admin";
  } catch {
    return false;
  }
}

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const [settings, upcoming, manage] = await Promise.all([
      getAgencyPrivacy(supabase, auth.agencyId),
      upcomingRetention(supabase, auth.agencyId),
      canManage(auth),
    ]);
    return NextResponse.json({
      settings: { retentionMonths: settings.retentionMonths, presenceEnabled: settings.presenceEnabled },
      retentionChoices: RETENTION_CHOICES,
      canManage: manage,
      upcoming,
    });
  } catch (err) {
    console.error("[privacy] Load failed:", err.message);
    return NextResponse.json({ error: "Couldn't load your privacy settings." }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await canManage(auth))) {
    return NextResponse.json({ error: "Only the workspace owner or an admin can change these settings." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const { rawSettings } = await getAgencyPrivacy(supabase, auth.agencyId);
  const next = { ...rawSettings };
  if (body?.retentionMonths !== undefined) {
    if (!RETENTION_CHOICES.includes(body.retentionMonths)) {
      return NextResponse.json({ error: "Pick one of the offered retention periods." }, { status: 400 });
    }
    next.retention_months = body.retentionMonths;
  }
  if (body?.presenceEnabled !== undefined) {
    if (typeof body.presenceEnabled !== "boolean") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    next.presence_enabled = body.presenceEnabled;
  }

  const { error } = await supabase.from("agencies").update({ settings: next }).eq("id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });

  // Switching presence off also deletes what was recorded.
  if (body?.presenceEnabled === false) {
    await supabase
      .from("profiles")
      .update({ last_seen_at: null, last_active_at: null, presence_status: null, presence_message: null, presence_until: null })
      .eq("agency_id", auth.agencyId);
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  if (body?.action !== "keep") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(cleanUuid).filter(Boolean))].slice(0, 200) : [];
  if (!ids.length) return NextResponse.json({ error: "Choose who to keep." }, { status: 400 });

  const { data: owned } = await supabase.from("candidates").select("id").eq("agency_id", auth.agencyId).in("id", ids);
  const keep = (owned || []).map((r) => r.id);
  if (!keep.length) return NextResponse.json({ ok: true, kept: 0 });

  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const now = new Date().toISOString();
  await supabase.from("candidates").update({ last_activity_at: now }).eq("agency_id", auth.agencyId).in("id", keep);
  await supabase.from("candidate_activity").insert(keep.map((id) => ({ candidate_id: id, type: "retention_extended", actor, meta: { note: "Kept past the retention period" } })));
  return NextResponse.json({ ok: true, kept: keep.length });
}
