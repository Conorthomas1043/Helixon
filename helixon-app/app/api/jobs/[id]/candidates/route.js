import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { resolveRecruiterNames } from "@/lib/agency/recruiter-directory";
import { agencyDb } from "@/lib/agency-db";
import { getAccess, scopeCandidateQuery } from "@/lib/agency/permissions";
import { fetchAll } from "@/lib/fetch-all";

export const GET = customerRoute(async (request, { params }, auth) => {
  const { agencyId } = auth;
  const { id } = await params;

  // Confirm the job belongs to this agency before listing its candidates -
  // job_id alone isn't enough to trust, since it's just a path param.
  const { data: job } = await (await agencyDb()).from("jobs").select("id").eq("id", id).eq("agency_id", agencyId).maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // "Own candidates only" applies here too; paged past 1,000 rows, with id
  // as the tiebreaker so equal scores keep their place between pages.
  const access = await getAccess(auth);
  const db = await agencyDb();
  const { data, error } = await fetchAll((from, to) =>
    scopeCandidateQuery(
      db
        .from("candidates")
        .select("id, full_name, name, processing_status, stage, match_score, recruiter_id, created_at")
        .eq("job_id", id)
        .eq("agency_id", agencyId),
      access,
      auth
    )
      .order("match_score", { ascending: false, nullsFirst: false })
      .order("id")
      .range(from, to)
  );

  if (error) {
    return NextResponse.json({ error: "Failed to load candidates" }, { status: 500 });
  }

  const recruiterNames = await resolveRecruiterNames(supabase, (data ?? []).map((c) => c.recruiter_id));

  return NextResponse.json(
    (data ?? []).map((c) => ({
      id: c.id,
      fullName: c.full_name || c.name || "Unnamed candidate",
      status: c.processing_status,
      stage: c.stage,
      score: c.match_score,
      recruiterId: c.recruiter_id,
      recruiterName: recruiterNames.get(c.recruiter_id) ?? null,
      createdAt: c.created_at,
    }))
  );
});
