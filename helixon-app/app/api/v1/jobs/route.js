import { supabase } from "@/lib/supabase";
import { cleanLine, cleanList, cleanText } from "@/lib/sanitize";
import { ensureClient } from "@/lib/clients";
import { JOB_COLUMNS, apiError, apiJson, pageMeta, paging, toApiJob, withApiKey } from "@/lib/api-v1";

// GET  /api/v1/jobs?status=open|closed
// POST /api/v1/jobs { title, client?, location?, salaryRange?,
//      employmentType?, seniority?, requiredSkills?, description? }

export const GET = withApiKey(async (ctx, request) => {
  const params = new URL(request.url).searchParams;
  const pg = paging(params);
  let q = supabase.from("jobs").select(JOB_COLUMNS, { count: "exact" }).eq("agency_id", ctx.agencyId);
  if (["open", "closed"].includes(params.get("status"))) q = q.eq("status", params.get("status"));
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(pg.from, pg.to);
  if (error) return apiError(500, "Jobs couldn't be loaded.");
  return apiJson({ data: (data ?? []).map(toApiJob), ...pageMeta(pg, count) });
});

export const POST = withApiKey(async (ctx, request) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError(400, "Send a JSON body.");
  const title = cleanLine(body.title, 200);
  if (!title) return apiError(400, "title is required.");
  const client = body.client ? await ensureClient(ctx.agencyId, body.client) : null;
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      agency_id: ctx.agencyId,
      user_id: ctx.userId,
      title,
      client: client?.name ?? (cleanLine(body.client, 200) || null),
      client_id: client?.id ?? null,
      location: cleanLine(body.location, 200) || null,
      salary_range: cleanLine(body.salaryRange, 80) || null,
      employment_type: cleanLine(body.employmentType, 60) || null,
      seniority: cleanLine(body.seniority, 60) || null,
      required_skills: cleanList(body.requiredSkills, { maxItems: 40, maxLength: 100 }),
      job_text: cleanText(body.description, { max: 50000 }) || null,
      status: "open",
      is_saved: true,
    })
    .select(JOB_COLUMNS)
    .single();
  if (error) return apiError(500, "The job couldn't be saved.");
  return apiJson({ data: toApiJob(data) }, 201);
});
