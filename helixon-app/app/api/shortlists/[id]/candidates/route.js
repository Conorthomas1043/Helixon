import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cleanText, cleanUuid } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidate-activity";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { MAX_NOTE_LEN, addToShortlist, loadShortlist, shortlistAuth } from "@/lib/shortlists";

// The people on one shortlist (lib/shortlists.js).
//
// POST { candidateIds, note? }   add people (already-listed ones are skipped)
// PATCH { candidateId, note }    change why someone is on it
// DELETE ?candidateId=           take someone off it

async function context(params) {
  const { auth, response } = await shortlistAuth();
  if (response) return { response };
  const { id } = await params;
  const loaded = await loadShortlist(auth.agencyId, id);
  if (loaded.response) return { response: loaded.response };
  return { auth, shortlist: loaded.shortlist };
}

export async function POST(request, { params }) {
  const ctx = await context(params);
  if (ctx.response) return ctx.response;

  const body = await request.json().catch(() => null);
  const note = cleanText(body?.note, { max: MAX_NOTE_LEN }) || null;
  const result = await addToShortlist(ctx.auth, ctx.shortlist.id, body?.candidateIds, note, ctx.shortlist.name);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, added: result.added });
}

export async function PATCH(request, { params }) {
  const ctx = await context(params);
  if (ctx.response) return ctx.response;

  const body = await request.json().catch(() => null);
  const candidateId = cleanUuid(body?.candidateId);
  if (!candidateId) return NextResponse.json({ error: "Which candidate?" }, { status: 400 });
  const note = cleanText(body?.note, { max: MAX_NOTE_LEN }) || null;

  const { data, error } = await supabase
    .from("shortlist_candidates")
    .update({ note })
    .eq("shortlist_id", ctx.shortlist.id)
    .eq("candidate_id", candidateId)
    .select("candidate_id");
  if (error) return NextResponse.json({ error: "Failed to save the note." }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "They aren't on this shortlist." }, { status: 404 });
  return NextResponse.json({ ok: true, note });
}

export async function DELETE(request, { params }) {
  const ctx = await context(params);
  if (ctx.response) return ctx.response;

  const candidateId = cleanUuid(new URL(request.url).searchParams.get("candidateId"));
  if (!candidateId) return NextResponse.json({ error: "Which candidate?" }, { status: 400 });

  const { data, error } = await supabase
    .from("shortlist_candidates")
    .delete()
    .eq("shortlist_id", ctx.shortlist.id)
    .eq("candidate_id", candidateId)
    .select("candidate_id");
  if (error) return NextResponse.json({ error: "Failed to remove them." }, { status: 500 });
  if (data?.length) {
    await logActivity(supabase, candidateId, "shortlist_removed", recruiterDisplayName(ctx.auth.profile) || ctx.auth.userId, {
      note: ctx.shortlist.name,
    });
  }
  return NextResponse.json({ ok: true });
}
