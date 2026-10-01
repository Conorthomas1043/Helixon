import { supabase } from "@/lib/supabase";
import { PLACEMENT_STATUSES, toPlacement } from "@/lib/placements";
import { apiError, apiJson, pageMeta, paging, sinceParam, withApiKey } from "@/lib/api-v1";

// GET /api/v1/placements?status=&createdSince= - offers and placements.
export const GET = withApiKey(async (ctx, request) => {
  const params = new URL(request.url).searchParams;
  const pg = paging(params);
  let q = supabase.from("placements").select("*", { count: "exact" }).eq("agency_id", ctx.agencyId);
  if (PLACEMENT_STATUSES[params.get("status")]) q = q.eq("status", params.get("status"));
  const since = sinceParam(params.get("createdSince"));
  if (since) q = q.gte("created_at", since);
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(pg.from, pg.to);
  if (error) return apiError(500, "Placements couldn't be loaded.");
  return apiJson({ data: (data ?? []).map(toPlacement), ...pageMeta(pg, count) });
});
