import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { resolveRecruiterNames } from "@/lib/recruiter-directory";
import { followUpItems, interviewFollowUpItems, sortFollowUps } from "@/lib/follow-ups";
import { getAccess, scopeCandidateQuery } from "@/lib/permissions";

// GET ?scope=mine|all&tz= - open follow-ups (lib/follow-ups.js): candidates'
// next actions, talent-pool check-ins and this week's interviews, most
// urgent first. "mine" is the
// candidates assigned to the caller. `tz` is the browser's time zone, so
// "today" is the recruiter's today.

const LIMIT = 500;

function validTimeZone(tz) {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const params = new URL(request.url).searchParams;
  const mine = params.get("scope") !== "all";
  const timeZone = validTimeZone(params.get("tz")) || "UTC";

  let query = supabase
    .from("candidates")
    .select("id, full_name, name, recruiter_id, next_action, talent_pool_at, talent_pool_check_in, jobs(title)")
    .eq("agency_id", auth.agencyId)
    .or("next_action.not.is.null,talent_pool_check_in.not.is.null")
    .limit(LIMIT);
  if (mine) query = query.eq("recruiter_id", auth.userId);
  const access = await getAccess(auth);
  query = scopeCandidateQuery(query, access, auth);

  const now = new Date();
  const [{ data, error }, { data: interviews }] = await Promise.all([
    query,
    supabase
      .from("interviews")
      .select("id, candidate_id, round, status, starts_at, duration_minutes, created_by, candidates(full_name, name, recruiter_id), jobs(title)")
      .eq("agency_id", auth.agencyId)
      .eq("status", "scheduled")
      .lte("starts_at", new Date(now.getTime() + 7 * 86400000).toISOString())
      .limit(LIMIT),
  ]);
  if (error) return NextResponse.json({ error: "Failed to load follow-ups." }, { status: 500 });

  const visible = (r) => access.seesAllCandidates || !r.candidates?.recruiter_id || r.candidates.recruiter_id === auth.userId;
  const interviewRows = (interviews ?? []).filter((r) => visible(r) && (!mine || r.candidates?.recruiter_id === auth.userId || r.created_by === auth.userId));
  const items = sortFollowUps([...followUpItems(data, now, timeZone), ...interviewFollowUpItems(interviewRows, now, timeZone)]);
  const names = await resolveRecruiterNames(supabase, items.map((i) => i.recruiterId));
  return NextResponse.json({
    items: items.map((i) => ({ ...i, recruiterName: names.get(i.recruiterId) ?? null })),
    truncated: (data ?? []).length >= LIMIT,
  });
}
