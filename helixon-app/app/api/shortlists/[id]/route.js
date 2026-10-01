import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cleanLine } from "@/lib/sanitize";
import { resolveRecruiterNames } from "@/lib/recruiter-directory";
import { MAX_NAME_LEN, loadShortlist, ownedJobId, shortlistAuth, toShortlist } from "@/lib/shortlists";

// One shortlist (lib/shortlists.js).
//
// GET                    the list and the people on it, strongest match first
// PATCH { name?, jobId? }  rename it or point it at another job (null = none)
// DELETE                 delete the list - the candidates themselves are untouched

export async function GET(request, { params }) {
  const { auth, response } = await shortlistAuth();
  if (response) return response;
  const { id } = await params;
  const loaded = await loadShortlist(auth.agencyId, id);
  if (loaded.response) return loaded.response;

  const { data: members, error } = await supabase
    .from("shortlist_candidates")
    .select(
      "candidate_id, note, created_at, candidates!inner(id, agency_id, full_name, name, email, current_title, current_company, location, match_score, stage, recruiter_id, processing_status, jobs(id, title, client))"
    )
    .eq("shortlist_id", loaded.shortlist.id)
    .eq("candidates.agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to load shortlist." }, { status: 500 });

  const rows = members ?? [];
  const recruiterNames = await resolveRecruiterNames(supabase, rows.map((m) => m.candidates?.recruiter_id));

  const candidates = rows
    .map((m) => ({
      id: m.candidates.id,
      fullName: m.candidates.full_name || m.candidates.name || "Unnamed candidate",
      email: m.candidates.email ?? null,
      currentTitle: m.candidates.current_title,
      currentCompany: m.candidates.current_company,
      location: m.candidates.location,
      score: m.candidates.match_score,
      stage: m.candidates.stage,
      status: m.candidates.processing_status,
      jobId: m.candidates.jobs?.id ?? null,
      jobTitle: m.candidates.jobs?.title ?? null,
      recruiterName: recruiterNames.get(m.candidates.recruiter_id) ?? null,
      note: m.note,
      addedAt: m.created_at,
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return NextResponse.json({ shortlist: toShortlist(loaded.shortlist, rows), candidates });
}

export async function PATCH(request, { params }) {
  const { auth, response } = await shortlistAuth();
  if (response) return response;
  const { id } = await params;
  const loaded = await loadShortlist(auth.agencyId, id);
  if (loaded.response) return loaded.response;

  const body = await request.json().catch(() => null);
  const update = {};
  if (body?.name !== undefined) {
    const name = cleanLine(body.name, MAX_NAME_LEN);
    if (!name) return NextResponse.json({ error: "The name can't be empty." }, { status: 400 });
    update.name = name;
  }
  const jobId = await ownedJobId(auth.agencyId, body?.jobId);
  if (jobId?.error) return NextResponse.json({ error: "That job wasn't found." }, { status: 400 });
  if (jobId !== undefined) update.job_id = jobId;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await supabase
    .from("shortlists")
    .update(update)
    .eq("id", loaded.shortlist.id)
    .eq("agency_id", auth.agencyId)
    .select("id, name, job_id, created_at, jobs(id, title, client, client_email)")
    .single();
  if (error) return NextResponse.json({ error: "Failed to update shortlist." }, { status: 500 });
  return NextResponse.json({ shortlist: toShortlist(data) });
}

export async function DELETE(request, { params }) {
  const { auth, response } = await shortlistAuth();
  if (response) return response;
  const { id } = await params;
  const loaded = await loadShortlist(auth.agencyId, id);
  if (loaded.response) return loaded.response;

  // shortlist_candidates cascades with the list.
  const { error } = await supabase.from("shortlists").delete().eq("id", loaded.shortlist.id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to delete shortlist." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
