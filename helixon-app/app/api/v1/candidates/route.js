import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { cleanEmail, cleanLine, cleanList, cleanText, cleanUuid } from "@/lib/sanitize";
import { applyFilters, readFilters, resolveFilters } from "@/lib/candidates/query";
import { findExistingPerson } from "@/lib/candidates/duplicates";
import { logActivity } from "@/lib/candidates/activity";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { CANDIDATE_COLUMNS, apiError, apiJson, pageMeta, paging, sinceParam, toApiCandidate, withApiKey } from "@/lib/api-v1";
import { candidatePayload, emitWebhook } from "@/lib/webhooks";

// GET  /api/v1/candidates - the Candidates list's filters (search, boolean
//      search, stage, jobId, near/radius, tags...) plus updatedSince, paged
// POST /api/v1/candidates - add someone (the LinkedIn extension, a form,
//      Zapier). { name, email?, phone?, linkedin?, location?, currentTitle?,
//      currentCompany?, jobId?, stage?, source?, skills?, note? }. Someone
//      already on file (same email or LinkedIn) is returned, not duplicated.

const SOURCES = new Set(["referral", "job_board", "linkedin", "direct_sourcing", "agency_database", "careers_page", "other"]);

export const GET = withApiKey(async (ctx, request) => {
  const params = new URL(request.url).searchParams;
  const pg = paging(params);
  const { resolved, error: filterError } = await resolveFilters(ctx.agencyId, readFilters(params));
  if (filterError) return apiError(400, filterError);
  let q = supabase.from("candidates").select(CANDIDATE_COLUMNS, { count: "exact" }).eq("agency_id", ctx.agencyId);
  q = applyFilters(q, resolved);
  const since = sinceParam(params.get("updatedSince"));
  if (since) q = q.gte("last_activity_at", since);
  const { data, count, error } = await q.order("created_at", { ascending: false }).range(pg.from, pg.to);
  if (error) return apiError(400, "That search couldn't be run.");
  return apiJson({ data: (data ?? []).map(toApiCandidate), ...pageMeta(pg, count) });
});

export const POST = withApiKey(async (ctx, request) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return apiError(400, "Send a JSON body.");
  const name = cleanLine(body.name, 120);
  if (!name) return apiError(400, "name is required.");
  const email = body.email ? cleanEmail(body.email) : null;
  if (body.email && !email) return apiError(400, "email isn't a valid address.");
  const linkedinRaw = cleanLine(body.linkedin, 200);
  const linkedin = linkedinRaw && /linkedin\.com\//i.test(linkedinRaw) ? linkedinRaw : null;
  if (body.stage && !STAGE_LABELS[body.stage]) return apiError(400, `stage must be one of ${Object.keys(STAGE_LABELS).join(", ")}.`);
  const source = SOURCES.has(body.source) ? body.source : linkedin ? "linkedin" : "other";

  let jobId = null;
  if (body.jobId) {
    jobId = cleanUuid(body.jobId);
    const { data: job } = jobId ? await supabase.from("jobs").select("id").eq("id", jobId).eq("agency_id", ctx.agencyId).maybeSingle() : { data: null };
    if (!job) return apiError(404, "That job wasn't found.");
  }

  const existing = await findExistingPerson(supabase, ctx.agencyId, { email, linkedin });
  if (existing) {
    const { data } = await supabase.from("candidates").select(CANDIDATE_COLUMNS).eq("id", existing.rootId).eq("agency_id", ctx.agencyId).maybeSingle();
    if (data) return apiJson({ data: toApiCandidate(data), duplicate: true, matchedOn: existing.matchedOn });
  }

  const currentTitle = cleanLine(body.currentTitle, 160) || null;
  const currentCompany = cleanLine(body.currentCompany, 160) || null;
  const location = cleanLine(body.location, 120) || null;
  const skills = cleanList(body.skills, { maxItems: 60, maxLength: 80 });
  const { data: created, error } = await supabase
    .from("candidates")
    .insert({
      agency_id: ctx.agencyId,
      user_id: ctx.userId,
      recruiter_id: ctx.userId,
      name,
      full_name: name,
      email,
      phone: cleanLine(body.phone, 40) || null,
      linkedin,
      location,
      current_title: currentTitle,
      current_company: currentCompany,
      job_id: jobId,
      stage: body.stage || null,
      source,
      processing_status: "completed",
      extracted: { name, skills, current_title: currentTitle, current_employer: currentCompany, location, linkedin, imported: true },
    })
    .select(CANDIDATE_COLUMNS)
    .single();
  if (error) return apiError(500, "The candidate couldn't be saved.");

  await logActivity(supabase, created.id, "imported", ctx.actor, { note: "Added via the API" });
  const note = cleanText(body.note, { max: 5000 });
  if (note) {
    await supabase.from("candidate_notes").insert({ agency_id: ctx.agencyId, candidate_id: created.id, note, author_id: ctx.userId, author_name: ctx.actor });
  }
  after(() => emitWebhook(ctx.agencyId, "candidate.created", candidatePayload(created, { via: "api" })));
  return apiJson({ data: toApiCandidate(created), duplicate: false }, 201);
});
