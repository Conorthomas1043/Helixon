import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { resolveRecruiterNames } from "@/lib/recruiter-directory";

// Rebuilt against Clerk auth and scoped to the caller's agency_id - the
// previous version authenticated via a Supabase-Auth bearer token nothing
// in this Clerk-based app ever sends (getCurrentRecruiter always threw,
// see lib/supabase/server.js), and had no agency scoping at all, so a
// working version of it would have returned every agency's candidates to
// anyone. See app/api/dashboard-stats/route.js for the same Clerk +
// agency_id pattern this mirrors.
const SORTS = {
  score_desc: { column: "match_score", ascending: false },
  newest: { column: "created_at", ascending: false },
  oldest: { column: "created_at", ascending: true },
  recent_activity: { column: "last_activity_at", ascending: false },
  // Alphabetical on the raw stage string, not funnel order - ordering by a
  // joined/computed rank isn't supported by a single .order() call here.
  // "recruiter"/"job" (sort-by-joined-table-name) aren't supported for the
  // same reason and fall back to score_desc below.
  stage: { column: "stage", ascending: false },
};

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;

  const params = new URL(request.url).searchParams;
  const search = params.get("search")?.trim() ?? "";
  const stage = params.get("stage") ?? "all";
  const status = params.get("status") ?? "all";
  const recruiterId = params.get("recruiterId") ?? "all";
  const jobId = params.get("jobId") ?? "all";
  const scoreBand = params.get("scoreBand") ?? "all";
  const dateRange = params.get("dateRange") ?? "all";
  const tagIds = (params.get("tagIds") || "").split(",").map((t) => t.trim()).filter(Boolean);
  const sortBy = params.get("sortBy") ?? "score_desc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize")) || 8));

  let query = supabase
    .from("candidates")
    .select(
      "id, full_name, name, current_title, current_company, location, status, stage, match_score, tags, next_action, recruiter_id, job_id, created_at, last_activity_at, extracted, jobs(id, title, client)",
      { count: "exact" }
    )
    .eq("agency_id", agencyId);

  if (stage !== "all") query = query.eq("stage", stage);
  if (status !== "all") query = query.eq("status", status);
  if (recruiterId !== "all") query = query.eq("recruiter_id", recruiterId);
  if (jobId !== "all") query = query.eq("job_id", jobId);
  if (search) query = query.ilike("full_name", `%${search}%`);
  if (tagIds.length > 0) query = query.contains("tags", tagIds);
  if (scoreBand === "80+") query = query.gte("match_score", 80);
  else if (scoreBand === "60-79") query = query.gte("match_score", 60).lt("match_score", 80);
  else if (scoreBand === "<60") query = query.lt("match_score", 60);
  if (dateRange !== "all") {
    const days = { today: 1, "7d": 7, "30d": 30 }[dateRange];
    if (days) query = query.gte("created_at", new Date(Date.now() - days * 86400000).toISOString());
  }

  const sort = SORTS[sortBy] ?? SORTS.score_desc;
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false });

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Failed to load candidates" }, { status: 500 });
  }

  const recruiterNames = await resolveRecruiterNames(supabase, (data ?? []).map((c) => c.recruiter_id));

  return NextResponse.json({
    items: (data ?? []).map((c) => ({
      id: c.id,
      fullName: c.full_name || c.name || "Unnamed candidate",
      currentTitle: c.current_title,
      currentCompany: c.current_company,
      location: c.location,
      jobId: c.job_id,
      jobTitle: c.jobs?.title || "Unspecified role",
      company: c.jobs?.client ?? null,
      recruiterId: c.recruiter_id,
      recruiterName: recruiterNames.get(c.recruiter_id) ?? null,
      status: c.status,
      stage: c.stage,
      score: c.match_score,
      skills: c.extracted?.skills ?? [],
      tags: c.tags ?? [],
      nextAction: c.next_action,
      createdAt: c.created_at,
      lastActivityAt: c.last_activity_at,
    })),
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  });
}
