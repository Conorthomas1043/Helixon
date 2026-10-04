import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { cleanText, cleanUuid } from "@/lib/sanitize";
import { poolRootId } from "@/lib/rescreen";
import { addMonths, getAgencyPrivacy } from "@/lib/privacy-settings";
import { candidateHidden } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

// Save someone to the agency's talent pool for future roles, or take them
// out. The pool holds one entry per person: the flag goes on their first
// candidate row (the one later screenings hang off - see lib/rescreen.js),
// whichever of their rows it's set from.
//
// POST { note? }                       save (or update the note)
// PATCH { note?, status?, checkIn?, extend? }
//                                      edit an entry: why they're kept,
//                                      availability, date to check in;
//                                      extend renews it for the agency's
//                                      retention period
//
// Entries lapse at talent_pool_expires_at (the agency's retention period
// after saving - lib/privacy-settings.js) unless extended.
// DELETE                               remove

const POOL_STATUSES = ["available", "open", "not_looking"];
const POOL_COLUMNS = "talent_pool_at, talent_pool_by, talent_pool_note, talent_pool_status, talent_pool_check_in, talent_pool_expires_at";

async function expiryFor(agencyId) {
  const { retentionMonths } = await getAgencyPrivacy(supabase, agencyId);
  return addMonths(new Date(), retentionMonths).toISOString();
}

function toPool(row) {
  return {
    savedAt: row.talent_pool_at,
    savedBy: row.talent_pool_by,
    note: row.talent_pool_note,
    status: row.talent_pool_status,
    checkIn: row.talent_pool_check_in,
    expiresAt: row.talent_pool_expires_at,
  };
}

async function load(params) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return { response: hidden };
  const { id } = await params;
  const { data: candidate } = await (await agencyDb())
    .from("candidates")
    .select("id, pooled_from_id")
    .eq("id", cleanUuid(id) || "")
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  if (!candidate) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { auth, id: candidate.id, rootId: poolRootId(candidate) };
}

export async function POST(request, { params }) {
  const ctx = await load(params);
  if (ctx.response) return ctx.response;
  const { auth, id, rootId } = ctx;
  const body = await request.json().catch(() => ({}));
  const note = cleanText(body?.note, { max: 500 }) || null;
  const actor = recruiterDisplayName(auth.profile) || auth.userId;

  const { data, error } = await (await agencyDb())
    .from("candidates")
    .update({ talent_pool_at: new Date().toISOString(), talent_pool_by: actor, talent_pool_note: note, talent_pool_expires_at: await expiryFor(auth.agencyId) })
    .eq("id", rootId)
    .eq("agency_id", auth.agencyId)
    .select(POOL_COLUMNS)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Couldn't save them to the talent pool." }, { status: 500 });
  }
  await logActivity(supabase, id, "talent_pool_added", actor, note ? { note } : null);
  return NextResponse.json({ talentPool: toPool(data) });
}

export async function PATCH(request, { params }) {
  const ctx = await load(params);
  if (ctx.response) return ctx.response;
  const { auth, rootId } = ctx;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const update = {};
  if ("note" in body) update.talent_pool_note = cleanText(body.note, { max: 500 }) || null;
  if ("status" in body) {
    if (body.status !== null && !POOL_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid availability." }, { status: 400 });
    }
    update.talent_pool_status = body.status;
  }
  if ("checkIn" in body) {
    if (body.checkIn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.checkIn))) {
      return NextResponse.json({ error: "Invalid check-in date." }, { status: 400 });
    }
    update.talent_pool_check_in = body.checkIn;
  }
  if (body.extend === true) update.talent_pool_expires_at = await expiryFor(auth.agencyId);
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await (await agencyDb())
    .from("candidates")
    .update(update)
    .eq("id", rootId)
    .eq("agency_id", auth.agencyId)
    .not("talent_pool_at", "is", null)
    .select(POOL_COLUMNS)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "They aren't in the talent pool." }, { status: 404 });
  }
  return NextResponse.json({ talentPool: toPool(data) });
}

export async function DELETE(request, { params }) {
  const ctx = await load(params);
  if (ctx.response) return ctx.response;
  const { auth, id, rootId } = ctx;

  const { error } = await (await agencyDb())
    .from("candidates")
    .update({ talent_pool_at: null, talent_pool_by: null, talent_pool_note: null, talent_pool_status: null, talent_pool_check_in: null, talent_pool_expires_at: null })
    .eq("id", rootId)
    .eq("agency_id", auth.agencyId);
  if (error) {
    return NextResponse.json({ error: "Couldn't remove them from the talent pool." }, { status: 500 });
  }
  await logActivity(supabase, id, "talent_pool_removed", recruiterDisplayName(auth.profile) || auth.userId);
  return NextResponse.json({ talentPool: null });
}
