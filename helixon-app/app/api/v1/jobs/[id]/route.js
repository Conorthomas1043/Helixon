import { supabase } from "@/lib/supabase";
import { cleanUuid } from "@/lib/sanitize";
import { JOB_COLUMNS, apiError, apiJson, toApiJob, withApiKey } from "@/lib/api-v1";

// GET /api/v1/jobs/{id} - with a count of candidates per stage.
export const GET = withApiKey(async (ctx, request, params) => {
  const id = cleanUuid(params.id);
  const { data } = id ? await supabase.from("jobs").select(`${JOB_COLUMNS}, candidates(stage)`).eq("id", id).eq("agency_id", ctx.agencyId).maybeSingle() : { data: null };
  if (!data) return apiError(404, "Job not found.");
  const pipeline = {};
  for (const c of data.candidates ?? []) if (c.stage) pipeline[c.stage] = (pipeline[c.stage] || 0) + 1;
  return apiJson({ data: { ...toApiJob(data), candidates: (data.candidates ?? []).length, pipeline } });
});
