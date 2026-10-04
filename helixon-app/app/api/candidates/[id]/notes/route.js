import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { logActivity } from "@/lib/candidates/activity";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanText, cleanUuid } from "@/lib/sanitize";
import { candidateHidden } from "@/lib/permissions";
import { findMentions } from "@/lib/mentions";
import { notify } from "@/lib/notifications";
import { reportError } from "@/lib/report-error";
import { agencyDb } from "@/lib/agency-db";

// Team notes on a candidate. The text lives in candidate_notes.note - this
// route used to write a `body` column that doesn't exist (and no
// agency_id), so every note failed to save and none were ever stored.
//
// POST { body }            add a note
// PATCH { noteId, body }   edit your own note
// PATCH { noteId, pinned }  pin / unpin any note (pinned ones sit at the top)
// DELETE ?noteId=          delete your own note

function toNote(row) {
  return { id: row.id, author: row.author_name, authorId: row.author_id, createdAt: row.created_at, body: row.note, pinnedAt: row.pinned_at ?? null };
}

async function context(params) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return { response: hidden };
  const { id } = await params;
  const { data: candidate } = await (await agencyDb())
    .from("candidates")
    .select("id")
    .eq("id", id)
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  if (!candidate) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { auth, id };
}

// The caller's own note on this candidate, or an error response.
async function ownNote(auth, candidateId, noteId) {
  if (!noteId) return { response: NextResponse.json({ error: "Which note?" }, { status: 400 }) };
  const { data: note } = await (await agencyDb())
    .from("candidate_notes")
    .select("id, author_id")
    .eq("id", noteId)
    .eq("candidate_id", candidateId)
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  if (!note) return { response: NextResponse.json({ error: "Note not found." }, { status: 404 }) };
  if (note.author_id !== auth.userId) {
    return { response: NextResponse.json({ error: "You can only change your own notes." }, { status: 403 }) };
  }
  return { note };
}

export async function POST(request, { params }) {
  const ctx = await context(params);
  if (ctx.response) return ctx.response;
  const { auth, id } = ctx;

  const payload = await request.json().catch(() => null);
  const noteBody = cleanText(payload?.body, { max: 5000 });
  if (!noteBody) {
    return NextResponse.json({ error: "Write something first." }, { status: 400 });
  }

  const authorName = recruiterDisplayName(auth.profile) || auth.userId;
  const { data, error } = await (await agencyDb())
    .from("candidate_notes")
    .insert({ agency_id: auth.agencyId, candidate_id: id, author_id: auth.userId, author_name: authorName, note: noteBody })
    .select()
    .single();

  if (error) {
    reportError("[notes POST] Insert failed:", error.message);
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }

  await logActivity(supabase, id, "note_added", authorName);

  // @mentions notify the teammates named (lib/mentions.js).
  if (noteBody.includes("@")) {
    const { data: team } = await supabase.from("profiles").select("clerk_user_id, first_name, last_name, username").eq("agency_id", auth.agencyId);
    const members = (team ?? []).map((m) => ({ id: m.clerk_user_id, name: recruiterDisplayName(m) })).filter((m) => m.id && m.name);
    const { data: who } = await (await agencyDb()).from("candidates").select("full_name, name").eq("id", id).maybeSingle();
    for (const userId of findMentions(noteBody, members)) {
      if (userId === auth.userId) continue;
      await notify({
        agencyId: auth.agencyId,
        userId,
        kind: "mention",
        title: `${authorName} mentioned you on ${who?.full_name || who?.name || "a candidate"}`,
        body: noteBody.slice(0, 200),
        href: `/dashboard/candidates/${id}`,
      });
    }
  }
  return NextResponse.json(toNote(data));
}

export async function PATCH(request, { params }) {
  const ctx = await context(params);
  if (ctx.response) return ctx.response;
  const { auth, id } = ctx;

  const payload = await request.json().catch(() => null);

  // Pinning isn't editing - anyone on the team can pin a note.
  if (typeof payload?.pinned === "boolean") {
    const noteId = cleanUuid(payload.noteId);
    if (!noteId) return NextResponse.json({ error: "Which note?" }, { status: 400 });
    const { data, error } = await (await agencyDb())
      .from("candidate_notes")
      .update(payload.pinned ? { pinned_at: new Date().toISOString(), pinned_by: auth.userId } : { pinned_at: null, pinned_by: null })
      .eq("id", noteId)
      .eq("candidate_id", id)
      .eq("agency_id", auth.agencyId)
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: "Failed to pin note" }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Note not found." }, { status: 404 });
    return NextResponse.json(toNote(data));
  }

  const own = await ownNote(auth, id, cleanUuid(payload?.noteId));
  if (own.response) return own.response;
  const noteBody = cleanText(payload?.body, { max: 5000 });
  if (!noteBody) {
    return NextResponse.json({ error: "A note can't be empty - delete it instead." }, { status: 400 });
  }

  const { data, error } = await (await agencyDb())
    .from("candidate_notes")
    .update({ note: noteBody })
    .eq("id", own.note.id)
    .eq("agency_id", auth.agencyId)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
  return NextResponse.json(toNote(data));
}

export async function DELETE(request, { params }) {
  const ctx = await context(params);
  if (ctx.response) return ctx.response;
  const { auth, id } = ctx;

  const noteId = cleanUuid(new URL(request.url).searchParams.get("noteId"));
  const own = await ownNote(auth, id, noteId);
  if (own.response) return own.response;

  const { error } = await (await agencyDb()).from("candidate_notes").delete().eq("id", own.note.id).eq("agency_id", auth.agencyId);
  if (error) {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
