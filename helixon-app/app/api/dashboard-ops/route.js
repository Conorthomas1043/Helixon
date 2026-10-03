import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { buildOps } from "@/lib/dashboard-ops";
import { getAccess } from "@/lib/permissions";

// GET /api/dashboard-ops?scope=mine|team - the Overview's business view
// (lib/dashboard-ops.js): open jobs, interviews this week, offers out,
// placements and fees this month, cash owed, and alerts for overdue
// invoices, timesheets to approve, expiring compliance checks, contracts
// and rebate periods ending, and jobs past their fill-by date.
//
// Each table is read on its own and fails soft - one that a later
// migration adds may not exist yet, and the rest of the Overview is still
// worth showing without it.

const LIMIT = 5000;

async function rows(query, fallback) {
  let { data, error } = await query;
  if (error && fallback) ({ data, error } = await fallback());
  if (error) {
    console.warn("[dashboard-ops] Query skipped:", error.message);
    return [];
  }
  return data ?? [];
}

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { agencyId, userId } = auth;
  const mine = new URL(request.url).searchParams.get("scope") === "mine";
  const now = Date.now();
  const soon = new Date(now + 31 * 86400000).toISOString().slice(0, 10);

  const jobQuery = (cols) => supabase.from("jobs").select(cols).eq("agency_id", agencyId).eq("status", "open").limit(LIMIT);
  const placementQuery = (cols) =>
    supabase
      .from("placements")
      .select(cols)
      .eq("agency_id", agencyId)
      .in("status", ["offered", "accepted", "started", "completed"])
      .gte("created_at", new Date(now - 400 * 86400000).toISOString())
      .limit(LIMIT);
  const placementCols = "id, status, kind, fee_amount, currency, offer_date, created_at, start_date, end_date, rebate_until, recruiter_id, candidate_id, candidate_name, client_name";

  const [jobs, interviews, placements, invoices, timesheets, checks, clients] = await Promise.all([
    rows(
      jobQuery("id, title, client, status, owner_id, user_id, priority, target_date, openings, created_at, candidates(stage)"),
      () => jobQuery("id, title, client, status, user_id, created_at, candidates(stage)")
    ),
    rows(
      supabase
        .from("interviews")
        .select("id, starts_at, status, round, kind, created_by, candidate_id, candidates(full_name, name, recruiter_id), jobs(title)")
        .eq("agency_id", agencyId)
        .eq("status", "scheduled")
        .gte("starts_at", new Date(now - 2 * 3600000).toISOString())
        .lte("starts_at", new Date(now + 8 * 86400000).toISOString())
        .order("starts_at")
        .limit(200)
    ),
    rows(placementQuery(`${placementCols}, splits`), () => placementQuery(placementCols)),
    rows(supabase.from("invoices").select("id, number, status, total, currency, due_on, client_id, bill_to").eq("agency_id", agencyId).eq("status", "sent").limit(LIMIT)),
    rows(supabase.from("timesheets").select("id, status, week_starting, placement_id, placements(candidate_name)").eq("agency_id", agencyId).eq("status", "submitted").limit(500)),
    rows(
      supabase
        .from("compliance_checks")
        .select("id, kind, label, status, expires_on, candidate_id, candidates(full_name, name)")
        .eq("agency_id", agencyId)
        .not("expires_on", "is", null)
        .lte("expires_on", soon)
        .neq("status", "failed")
        .limit(500)
    ),
    rows(supabase.from("clients").select("id, name, owner_id, next_action").eq("agency_id", agencyId).not("next_action", "is", null).limit(2000)),
  ]);

  // Only the latest check of each kind per candidate matters - a renewed
  // right-to-work replaces the one that's expiring.
  const { data: renewals } = checks.length
    ? await supabase
        .from("compliance_checks")
        .select("candidate_id, kind, expires_on")
        .eq("agency_id", agencyId)
        .in("candidate_id", [...new Set(checks.map((c) => c.candidate_id))].slice(0, 300))
        .gt("expires_on", soon)
    : { data: [] };
  const renewed = new Set((renewals ?? []).map((r) => `${r.candidate_id}:${r.kind}`));

  const access = await getAccess(auth);
  const visibleCandidate = (recruiterId) => access.seesAllCandidates || !recruiterId || recruiterId === userId;
  const ops = buildOps(
    {
      jobs,
      interviews: interviews.filter((i) => visibleCandidate(i.candidates?.recruiter_id)),
      placements: placements.filter((p) => access.seesAllCandidates || p.recruiter_id === userId || (Array.isArray(p.splits) && p.splits.some((x) => x.recruiterId === userId))),
      invoices: access.canSeeFinancials ? invoices : [],
      timesheets,
      checks: checks.filter((c) => !renewed.has(`${c.candidate_id}:${c.kind}`)),
      clients,
    },
    { now, myId: userId, mine }
  );
  if (!access.canSeeFinancials) {
    ops.kpis.feesThisMonth = null;
    ops.kpis.outstanding = null;
    ops.kpis.overdueCount = null;
    ops.kpis.overdueTotal = null;
  }
  return NextResponse.json({ ...ops, financialsHidden: !access.canSeeFinancials });
}
