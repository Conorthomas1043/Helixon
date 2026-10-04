import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { logActivity } from "@/lib/candidate-activity";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { agencyDisplayName } from "@/lib/agency-display";
import { buildClientProfile } from "@/lib/client-profile";
import { cleanLine } from "@/lib/sanitize";
import { candidateHidden } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

// The client-ready profile for one candidate (lib/client-profile.js).
//
// GET ?blind=1&concerns=1&label=   the profile - client-safe fields only
// POST { blind }                   records that it was printed/saved to send
//                                  to a client (personal data leaving the
//                                  agency belongs in the candidate's history)

async function loadCandidate(agencyId, id) {
  const { data } = await (await agencyDb())
    .from("candidates")
    .select(
      "id, full_name, name, current_title, current_company, location, years_experience, match_score, match_summary, strengths, concerns, extracted, processing_status, jobs(title, client)"
    )
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();
  return data;
}

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const { id } = await params;

  const candidate = await loadCandidate(auth.agencyId, id);
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const search = new URL(request.url).searchParams;
  const blind = search.get("blind") === "1";
  const includeConcerns = search.get("concerns") === "1";
  const label = cleanLine(search.get("label"), 40) || "Candidate";

  const [{ data: latest }, { data: agency }] = await Promise.all([
    (await agencyDb()).from("scores").select("result").eq("candidate_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("agencies").select("name").eq("id", auth.agencyId).maybeSingle(),
  ]);

  const profile = buildClientProfile(
    { candidate, extracted: candidate.extracted, result: latest?.result ?? null, job: candidate.jobs },
    { blind, label, includeConcerns }
  );

  return NextResponse.json({
    profile,
    agencyName: agencyDisplayName(agency, auth.profile),
    preparedBy: recruiterDisplayName(auth.profile),
  });
}

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const { id } = await params;

  const candidate = await loadCandidate(auth.agencyId, id);
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const blind = body?.blind === true;
  await logActivity(supabase, id, "client_profile_printed", recruiterDisplayName(auth.profile) || auth.userId, {
    note: blind ? "Anonymised profile" : "Named profile",
  });
  return NextResponse.json({ ok: true });
}
