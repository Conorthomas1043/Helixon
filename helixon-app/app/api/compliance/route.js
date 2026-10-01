import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { EXPIRING_DAYS, checkState, privacyNoticeStatus, toCheck } from "@/lib/compliance";
import { sendPrivacyNotices } from "@/lib/compliance-email";

// The agency's compliance to-do list (/dashboard/compliance).
//
// GET    checks expired / expiring / still to do / failed; people placed or
//        offered without a verified right-to-work check; privacy notices
//        due; references still awaited
// POST { candidateIds }   email the privacy notice to each (up to 50 at a time)

const nameOf = (c) => c?.full_name || c?.name || "Candidate";

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const agencyId = auth.agencyId;
  const horizon = new Date(Date.now() + EXPIRING_DAYS * 86400000).toISOString().slice(0, 10);

  const [checksRes, placedRes, rtwRes, noticeRes, refsRes] = await Promise.all([
    supabase
      .from("compliance_checks")
      .select("*, candidates(id, full_name, name, stage)")
      .eq("agency_id", agencyId)
      .or(`status.in.(pending,failed),expires_on.lte.${horizon},follow_up_on.lte.${horizon}`)
      .order("expires_on", { ascending: true, nullsFirst: false })
      .limit(500),
    supabase.from("candidates").select("id, full_name, name, stage, jobs(title, client)").eq("agency_id", agencyId).in("stage", ["Offer", "Placed"]).limit(1000),
    supabase.from("compliance_checks").select("candidate_id").eq("agency_id", agencyId).eq("kind", "right_to_work").eq("status", "verified").limit(5000),
    supabase
      .from("candidates")
      .select("id, full_name, name, email, source, created_at, consent_given_at, consent_source, privacy_notice_sent_at")
      .eq("agency_id", agencyId)
      .is("privacy_notice_sent_at", null)
      .is("consent_given_at", null)
      .is("pooled_from_id", null)
      .order("created_at", { ascending: true })
      .limit(500),
    supabase
      .from("candidate_references")
      .select("id, candidate_id, referee_name, referee_company, requested_at, expires_at, candidates(full_name, name)")
      .eq("agency_id", agencyId)
      .eq("status", "requested")
      .order("created_at", { ascending: true })
      .limit(300),
  ]);
  const failed = [checksRes, placedRes, rtwRes, noticeRes, refsRes].find((r) => r.error);
  if (failed) {
    console.error("[compliance] Query failed:", failed.error.message);
    return NextResponse.json({ error: "Failed to load compliance." }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const checks = (checksRes.data ?? []).map((row) => ({ ...toCheck(row), candidateName: nameOf(row.candidates), state: checkState(row, today) })).filter((c) => c.state !== "ok");
  const verified = new Set((rtwRes.data ?? []).map((r) => r.candidate_id));
  const missingRtw = (placedRes.data ?? [])
    .filter((c) => !verified.has(c.id))
    .map((c) => ({ candidateId: c.id, candidateName: nameOf(c), stage: c.stage, jobTitle: c.jobs?.title ?? null, client: c.jobs?.client ?? null }));
  const notices = (noticeRes.data ?? [])
    .map((c) => ({ c, due: privacyNoticeStatus(c, today) }))
    .filter((x) => x.due)
    .map(({ c, due }) => ({ candidateId: c.id, candidateName: nameOf(c), email: c.email, source: c.source, addedAt: c.created_at, ...due }));
  const references = (refsRes.data ?? []).map((r) => ({
    id: r.id,
    candidateId: r.candidate_id,
    candidateName: nameOf(r.candidates),
    refereeName: r.referee_name,
    refereeCompany: r.referee_company,
    requestedAt: r.requested_at,
    expired: r.expires_at ? r.expires_at < new Date().toISOString() : false,
  }));
  return NextResponse.json({ checks, missingRtw, notices, references });
}

export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body.candidateIds) ? body.candidateIds : []).map(cleanUuid).filter(Boolean))].slice(0, 50);
  if (!ids.length) return NextResponse.json({ error: "Pick some candidates." }, { status: 400 });
  const { data: candidates } = await supabase.from("candidates").select("id, full_name, name, email").eq("agency_id", auth.agencyId).in("id", ids);
  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const result = await sendPrivacyNotices({ agencyId: auth.agencyId, profile: auth.profile, actor, recruiterName: recruiterDisplayName(auth.profile), candidates: candidates ?? [] });
  return NextResponse.json(result);
}
