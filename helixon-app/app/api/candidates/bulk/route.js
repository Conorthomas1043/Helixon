import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { findAgencyTag } from "@/lib/agency-tags";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { eraseCandidates } from "@/lib/candidates/erasure";
import { addMonths, getAgencyPrivacy } from "@/lib/privacy-settings";
import { getAccess, scopeCandidateQuery } from "@/lib/permissions";
import { logAudit } from "@/lib/agency-audit";
import { agencyDb } from "@/lib/agency-db";

// POST { ids: [...], action: "stage" | "tag" | "delete" | "pool" | "unpool", stage?, tagId? }
//
// Bulk actions from the Candidates list in one request. They used to loop
// one request per candidate from the browser (a 50-candidate stage change
// was 50 requests, and failures were silently ignored). Every action is
// scoped to the caller's agency; ids from anywhere else are ignored.
const MAX_IDS = 500;

export const POST = customerRoute(async (request, _context, auth, body) => {
  const db = await agencyDb();
  const { agencyId, userId, profile } = auth;
  const actor = recruiterDisplayName(profile) || userId;

  const ids = Array.isArray(body?.ids) ? [...new Set(body.ids.map(cleanUuid).filter(Boolean))] : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Select at least one candidate." }, { status: 400 });
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json({ error: `Select at most ${MAX_IDS} candidates at a time.` }, { status: 400 });
  }

  if (body.action === "delete") {
    // Only candidates this member can see ("own candidates only").
    const access = await getAccess(auth);
    let deletable = ids;
    if (!access.seesAllCandidates) {
      const { data: visible } = await scopeCandidateQuery(db.from("candidates").select("id").eq("agency_id", agencyId).in("id", ids), access, auth);
      deletable = (visible || []).map((r) => r.id);
    }
    const { erased, failedStep } = await eraseCandidates(supabase, agencyId, deletable);
    if (erased) {
      await logAudit({ auth, request, action: "candidate.deleted", targetType: "candidate", summary: `Deleted ${erased} candidate${erased === 1 ? "" : "s"} (bulk)`, meta: { ids: deletable.slice(0, 50) } });
    }
    if (failedStep) {
      return NextResponse.json(
        { error: `Erased ${erased}, then failed (${failedStep}). Safe to retry.`, erased },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, updated: erased });
  }

  const { data: rows, error: lookupError } = await scopeCandidateQuery(
    db.from("candidates").select("id, stage, tags, pooled_from_id").eq("agency_id", agencyId).in("id", ids),
    await getAccess(auth),
    auth
  );
  if (lookupError) {
    return NextResponse.json({ error: "Failed to load those candidates." }, { status: 500 });
  }
  const now = new Date().toISOString();

  if (body.action === "stage") {
    const stage = body.stage;
    if (!STAGE_LABELS[stage]) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    const moving = (rows || []).filter((r) => r.stage !== stage);
    if (moving.length) {
      const { error } = await db
        .from("candidates")
        .update({ stage, last_activity_at: now })
        .eq("agency_id", agencyId)
        .in("id", moving.map((r) => r.id));
      if (error) {
        return NextResponse.json({ error: "Failed to update stages." }, { status: 500 });
      }
      await supabase.from("candidate_activity").insert(
        moving.map((r) => ({ candidate_id: r.id, type: "stage_changed", actor, meta: { from: r.stage, to: stage } }))
      );
    }
    return NextResponse.json({ ok: true, updated: moving.length });
  }

  if (body.action === "tag") {
    const tag = typeof body.tagId === "string" ? await findAgencyTag(supabase, agencyId, body.tagId) : null;
    if (!tag) {
      return NextResponse.json({ error: "Unknown tag" }, { status: 400 });
    }
    const tagging = (rows || []).filter((r) => !(r.tags ?? []).includes(tag.id));
    // Each row's tags array differs, so these are separate writes - run a
    // few at a time rather than all at once.
    for (let i = 0; i < tagging.length; i += 20) {
      const results = await Promise.all(
        tagging.slice(i, i + 20).map((r) =>
          db
            .from("candidates")
            .update({ tags: [...(r.tags ?? []), tag.id], last_activity_at: now })
            .eq("id", r.id)
            .eq("agency_id", agencyId)
        )
      );
      if (results.some((res) => res.error)) {
        return NextResponse.json({ error: "Failed to add the tag to some candidates." }, { status: 500 });
      }
    }
    if (tagging.length) {
      await supabase.from("candidate_activity").insert(
        tagging.map((r) => ({ candidate_id: r.id, type: "tag_added", actor, meta: { tag: tag.label } }))
      );
    }
    return NextResponse.json({ ok: true, updated: tagging.length });
  }

  // Talent pool: one entry per person, on their first row (lib/rescreen.js).
  if (body.action === "pool" || body.action === "unpool") {
    const adding = body.action === "pool";
    const roots = [...new Set((rows || []).map((r) => r.pooled_from_id || r.id))];
    if (roots.length) {
      let query = db
        .from("candidates")
        .update(
          adding
            ? { talent_pool_at: now, talent_pool_by: actor, talent_pool_expires_at: addMonths(new Date(), (await getAgencyPrivacy(supabase, agencyId)).retentionMonths).toISOString() }
            : { talent_pool_at: null, talent_pool_by: null, talent_pool_note: null, talent_pool_status: null, talent_pool_check_in: null, talent_pool_expires_at: null }
        )
        .eq("agency_id", agencyId)
        .in("id", roots);
      // Saving again mustn't reset when (or by whom) someone was first saved.
      query = adding ? query.is("talent_pool_at", null) : query.not("talent_pool_at", "is", null);
      const { data: changed, error } = await query.select("id");
      if (error) {
        return NextResponse.json({ error: "Failed to update the talent pool." }, { status: 500 });
      }
      if (changed?.length) {
        await supabase.from("candidate_activity").insert(
          changed.map((r) => ({ candidate_id: r.id, type: adding ? "talent_pool_added" : "talent_pool_removed", actor }))
        );
      }
      return NextResponse.json({ ok: true, updated: changed?.length || 0 });
    }
    return NextResponse.json({ ok: true, updated: 0 });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}, { body: JsonObject, optionalBody: true });
