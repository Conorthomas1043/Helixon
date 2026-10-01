import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cleanLine, cleanUuid } from "@/lib/sanitize";
import { MAX_NAME_LEN, addToShortlist, ownedJobId, shortlistAuth, toShortlist } from "@/lib/shortlists";

// The agency's shortlists (lib/shortlists.js). Rebuilt on Clerk auth and
// agency scoping - the original took an agencyId from the request with no
// authentication at all.
//
// GET  ?jobId=&candidateId=        list, newest first; with candidateId each
//                                  entry says whether that person is on it
// POST { name, jobId?, candidateIds? }  create, optionally with people on it

export async function GET(request) {
  const { auth, response } = await shortlistAuth();
  if (response) return response;

  const params = new URL(request.url).searchParams;
  const jobId = cleanUuid(params.get("jobId"));
  const candidateId = cleanUuid(params.get("candidateId"));

  let query = supabase
    .from("shortlists")
    .select("id, name, job_id, created_at, jobs(id, title, client, client_email), shortlist_candidates(candidate_id)")
    .eq("agency_id", auth.agencyId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (jobId) query = query.eq("job_id", jobId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load shortlists." }, { status: 500 });

  return NextResponse.json({
    shortlists: (data ?? []).map((row) => {
      const members = row.shortlist_candidates ?? [];
      return {
        ...toShortlist(row, members),
        ...(candidateId ? { containsCandidate: members.some((m) => m.candidate_id === candidateId) } : {}),
      };
    }),
  });
}

export async function POST(request) {
  const { auth, response } = await shortlistAuth();
  if (response) return response;

  const body = await request.json().catch(() => null);
  const name = cleanLine(body?.name, MAX_NAME_LEN);
  if (!name) return NextResponse.json({ error: "Give the shortlist a name." }, { status: 400 });

  const jobId = await ownedJobId(auth.agencyId, body?.jobId);
  if (jobId?.error) return NextResponse.json({ error: "That job wasn't found." }, { status: 400 });

  const { data: created, error } = await supabase
    .from("shortlists")
    .insert({ agency_id: auth.agencyId, name, job_id: jobId ?? null })
    .select("id, name, job_id, created_at, jobs(id, title, client, client_email)")
    .single();
  if (error) return NextResponse.json({ error: "Failed to create shortlist." }, { status: 500 });

  let added = 0;
  if (Array.isArray(body?.candidateIds) && body.candidateIds.length) {
    const result = await addToShortlist(auth, created.id, body.candidateIds, null, created.name);
    if (result.error) {
      // Don't leave an empty list behind for a request that failed.
      await supabase.from("shortlists").delete().eq("id", created.id).eq("agency_id", auth.agencyId);
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    added = result.added;
  }

  return NextResponse.json({ shortlist: { ...toShortlist(created), count: added } }, { status: 201 });
}
