import { supabase } from "@/lib/supabase";
import { API_VERSION, apiJson, withApiKey } from "@/lib/api-v1";
import { WEBHOOK_EVENTS } from "@/lib/webhooks";

// GET /api/v1 - checks a key works, and lists what's available.
export const GET = withApiKey(async (ctx) => {
  const { data: agency } = await supabase.from("agencies").select("name").eq("id", ctx.agencyId).maybeSingle();
  return apiJson({
    ok: true,
    version: API_VERSION,
    workspace: agency?.name ?? null,
    actingAs: ctx.actor,
    endpoints: [
      "GET  /api/v1/candidates?search=&stage=&jobId=&updatedSince=&page=&pageSize=",
      "POST /api/v1/candidates",
      "GET  /api/v1/candidates/{id}",
      "PATCH /api/v1/candidates/{id}",
      "GET  /api/v1/jobs?status=open|closed",
      "POST /api/v1/jobs",
      "GET  /api/v1/jobs/{id}",
      "GET  /api/v1/clients",
      "POST /api/v1/clients",
      "GET  /api/v1/placements?status=",
    ],
    webhookEvents: Object.keys(WEBHOOK_EVENTS),
  });
});
