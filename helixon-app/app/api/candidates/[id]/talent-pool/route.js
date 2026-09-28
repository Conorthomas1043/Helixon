import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logActivity } from "@/lib/candidate-activity";
import { cleanText, cleanUuid } from "@/lib/sanitize";
import { poolRootId } from "@/lib/rescreen";

// Save someone to the agency's talent pool for future roles, or take them
// out. The pool holds one entry per person: the flag goes on their first
// candidate row (the one later screenings hang off - see lib/rescreen.js),
// whichever of their rows it's set from.
//
// POST { note? }   save (or update the note)
// DELETE           remove

async function load(params) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const { id } = await params;
  const { data: candidate } = await supabase
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

  const { data, error } = await supabase
    .from("candidates")
    .update({ talent_pool_at: new Date().toISOString(), talent_pool_by: actor, talent_pool_note: note })
    .eq("id", rootId)
    .eq("agency_id", auth.agencyId)
    .select("talent_pool_at, talent_pool_by, talent_pool_note")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Couldn't save them to the talent pool." }, { status: 500 });
  }
  await logActivity(supabase, id, "talent_pool_added", actor, note ? { note } : null);
  return NextResponse.json({ talentPool: { savedAt: data.talent_pool_at, savedBy: data.talent_pool_by, note: data.talent_pool_note } });
}

export async function DELETE(request, { params }) {
  const ctx = await load(params);
  if (ctx.response) return ctx.response;
  const { auth, id, rootId } = ctx;

  const { error } = await supabase
    .from("candidates")
    .update({ talent_pool_at: null, talent_pool_by: null, talent_pool_note: null })
    .eq("id", rootId)
    .eq("agency_id", auth.agencyId);
  if (error) {
    return NextResponse.json({ error: "Couldn't remove them from the talent pool." }, { status: 500 });
  }
  await logActivity(supabase, id, "talent_pool_removed", recruiterDisplayName(auth.profile) || auth.userId);
  return NextResponse.json({ talentPool: null });
}
