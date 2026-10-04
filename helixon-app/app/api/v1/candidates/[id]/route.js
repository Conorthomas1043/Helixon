import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { cleanEmail, cleanLine, cleanText, cleanUuid } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidates/activity";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { CANDIDATE_COLUMNS, apiError, apiJson, toApiCandidate, withApiKey } from "@/lib/api-v1";
import { emitWebhook } from "@/lib/webhooks";

// GET   /api/v1/candidates/{id}
// PATCH /api/v1/candidates/{id}  { stage?, email?, phone?, location?,
//       currentTitle?, currentCompany?, note? } - note adds a note

async function load(agencyId, rawId) {
  const id = cleanUuid(rawId);
  if (!id) return null;
  const { data } = await supabase.from("candidates").select(CANDIDATE_COLUMNS).eq("id", id).eq("agency_id", agencyId).maybeSingle();
  return data;
}

export const GET = withApiKey(async (ctx, request, params) => {
  const c = await load(ctx.agencyId, params.id);
  if (!c) return apiError(404, "Candidate not found.");
  return apiJson({ data: toApiCandidate(c) });
});

const FIELDS = {
  phone: ["phone", (v) => cleanLine(v, 40)],
  location: ["location", (v) => cleanLine(v, 120)],
  currentTitle: ["current_title", (v) => cleanLine(v, 160)],
  currentCompany: ["current_company", (v) => cleanLine(v, 160)],
};

export const PATCH = withApiKey(async (ctx, request, params) => {
  const c = await load(ctx.agencyId, params.id);
  if (!c) return apiError(404, "Candidate not found.");
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError(400, "Send a JSON body.");

  const update = {};
  for (const [key, [col, clean]] of Object.entries(FIELDS)) if (body[key] !== undefined) update[col] = body[key] ? clean(body[key]) || null : null;
  if (body.email !== undefined) {
    const email = body.email ? cleanEmail(body.email) : null;
    if (body.email && !email) return apiError(400, "email isn't a valid address.");
    update.email = email;
  }
  if (body.stage !== undefined) {
    if (!STAGE_LABELS[body.stage]) return apiError(400, `stage must be one of ${Object.keys(STAGE_LABELS).join(", ")}.`);
    update.stage = body.stage;
  }
  const note = body.note !== undefined ? cleanText(body.note, { max: 5000 }) : null;
  if (!Object.keys(update).length && !note) return apiError(400, "Nothing to update.");

  let fresh = c;
  if (Object.keys(update).length) {
    const { data, error } = await supabase.from("candidates").update(update).eq("id", c.id).eq("agency_id", ctx.agencyId).select(CANDIDATE_COLUMNS).single();
    if (error) return apiError(500, "The candidate couldn't be saved.");
    fresh = data;
    if (update.stage && update.stage !== c.stage) {
      await logActivity(supabase, c.id, "stage_changed", ctx.actor, { from: c.stage, to: update.stage });
      after(() => emitWebhook(ctx.agencyId, "candidate.stage_changed", { candidateId: c.id, name: c.full_name || c.name, jobId: c.job_id, from: c.stage, to: update.stage, by: ctx.actor }));
    }
    const other = Object.keys(update).filter((k) => k !== "stage");
    if (other.length) await logActivity(supabase, c.id, "details_updated", ctx.actor, { note: "Updated via the API" });
  }
  if (note) {
    await supabase.from("candidate_notes").insert({ agency_id: ctx.agencyId, candidate_id: c.id, note, author_id: ctx.userId, author_name: ctx.actor });
    await logActivity(supabase, c.id, "note_added", ctx.actor, null);
  }
  return apiJson({ data: toApiCandidate(fresh) });
});
