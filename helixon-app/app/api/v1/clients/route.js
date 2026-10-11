import { supabase } from "@/lib/supabase";
import { cleanClientFields, toClient } from "@/lib/clients/core";
import { apiError, apiJson, pageMeta, paging, withApiKey } from "@/lib/api/v1";
import { fields, num, text } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

// cleanClientFields (lib/clients/core.js) reads these; the owner is always the key's member.
const NewClientInput = fields({
  name: text(400),
  website: text(600),
  industry: text(240),
  address: text(1000),
  termsNotes: text(4000),
  status: text(40),
  feePercent: num,
  paymentTermsDays: num,
  rebateDays: num,
});

// GET  /api/v1/clients
// POST /api/v1/clients { name, website?, industry?, address?, status?,
//      feePercent?, paymentTermsDays?, rebateDays? }

const shape = (row) => {
  const c = toClient(row);
  delete c.ownerId;
  return c;
};

export const GET = withApiKey(async (ctx, request) => {
  const pg = paging(new URL(request.url).searchParams);
  const { data, count, error } = await supabase.from("clients").select("*", { count: "exact" }).eq("agency_id", ctx.agencyId).order("name").range(pg.from, pg.to);
  if (error) return apiError(500, "Clients couldn't be loaded.");
  return apiJson({ data: (data ?? []).map(shape), ...pageMeta(pg, count) });
});

export const POST = withApiKey(async (ctx, request) => {
  const parsed = await parseBody(request, NewClientInput, { respond: apiError });
  if (parsed.response) return parsed.response;
  const body = parsed.body;
  if (!body || typeof body !== "object") return apiError(400, "Send a JSON body.");
  const fields = cleanClientFields({ ...body, ownerId: undefined }, { requireName: true });
  if (fields.error) return apiError(400, fields.error);
  const { data: existing } = await supabase.from("clients").select("*").eq("agency_id", ctx.agencyId).ilike("name", fields.name.replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle();
  if (existing) return apiJson({ data: shape(existing), duplicate: true });
  const { data, error } = await supabase.from("clients").insert({ ...fields, agency_id: ctx.agencyId, owner_id: ctx.userId }).select("*").single();
  if (error) return apiError(500, "The client couldn't be saved.");
  return apiJson({ data: shape(data), duplicate: false }, 201);
});
