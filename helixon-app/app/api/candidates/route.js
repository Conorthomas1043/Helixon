import { createClient, getCurrentRecruiter, unauthorized } from "@/lib/supabase/server";

const SORTS = {
  score_desc: { column: "match_score", ascending: false },
  newest: { column: "created_at", ascending: false },
  oldest: { column: "created_at", ascending: true },
  recent_activity: { column: "last_activity_at", ascending: false },
};

export async function GET(request) {
  const supabase = createClient();
  const recruiter = await getCurrentRecruiter(supabase);
  if (!recruiter) return unauthorized();

  const params = new URL(request.url).searchParams;
  const search = params.get("search")?.trim() ?? "";
  const stage = params.get("stage") ?? "all";
  const status = params.get("status") ?? "all";
  const recruiterId = params.get("recruiterId") ?? "all";
  const jobId = params.get("jobId") ?? "all";
  const sortBy = params.get("sortBy") ?? "score_desc";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize")) || 8));

  let query = supabase
    .from("candidates")
    .select(
      "id, full_name, current_title, current_company, location, status, stage, match_score, tags, next_action, created_at, last_activity_at, job:jobs(id, title, company), recruiter:recruiters(id, name)",
      { count: "exact" }
    );

  if (stage !== "all") query = query.eq("stage", stage);
  if (status !== "all") query = query.eq("status", status);
  if (recruiterId !== "all") query = query.eq("recruiter_id", recruiterId);
  if (jobId !== "all") query = query.eq("job_id", jobId);
  if (search) query = query.ilike("full_name", `%${search}%`);

  const sort = SORTS[sortBy] ?? SORTS.score_desc;
  query = query.order(sort.column, { ascending: sort.ascending, nullsFirst: false });

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, count, error } = await query;
  if (error) return Response.json({ error: "Failed to load candidates" }, { status: 500 });

  return Response.json({
    items: (data ?? []).map((c) => ({
      id: c.id,
      fullName: c.full_name,
      currentTitle: c.current_title,
      currentCompany: c.current_company,
      location: c.location,
      jobTitle: c.job?.title ?? "Unspecified role",
      company: c.job?.company ?? null,
      recruiterId: c.recruiter?.id ?? null,
      recruiterName: c.recruiter?.name ?? null,
      status: c.status,
      stage: c.stage,
      score: c.match_score,
      tags: c.tags,
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
