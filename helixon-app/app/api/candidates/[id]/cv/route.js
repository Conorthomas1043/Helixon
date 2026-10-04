import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { candidateCvUrl } from "@/lib/candidate-files";
import { candidateHidden } from "@/lib/permissions";
import { reportError } from "@/lib/report-error";
import { agencyDb } from "@/lib/agency-db";

// GET /api/candidates/[id]/cv
//   ?format=text        -> { text } - the extracted CV text (every analysed
//                          candidate has this, including ones analysed
//                          before original files were kept)
//   ?download=1         -> { url } - one-minute signed URL that saves the
//                          original file under its own name
//   (default)           -> { url } - one-minute signed URL that opens it in
//                          the browser (PDFs preview inline)
//
// Scoped by agency_id like every other candidate route, so a guessed id
// from another agency is a 404. Opening or downloading the original is
// recorded on the candidate's activity timeline - it's personal data
// leaving the app, so there should be a trail of who did it and when.
export const GET = customerRoute(async (request, { params }, auth) => {
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const { agencyId, userId, profile } = auth;
  const { id } = await params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const download = url.searchParams.get("download") === "1";

  const { data: candidate, error } = await (await agencyDb())
    .from("candidates")
    .select("id, cv_file_url, cv_filename, cv_text")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load the CV." }, { status: 500 });
  }
  if (!candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (format === "text") {
    if (!candidate.cv_text?.trim()) {
      return NextResponse.json({ error: "No CV text on file." }, { status: 404 });
    }
    return NextResponse.json({ text: candidate.cv_text });
  }

  if (!candidate.cv_file_url) {
    return NextResponse.json({ error: "The original CV file isn't stored for this candidate." }, { status: 404 });
  }

  let signedUrl;
  try {
    signedUrl = await candidateCvUrl({
      path: candidate.cv_file_url,
      fileName: candidate.cv_filename || "cv",
      download,
    });
  } catch (err) {
    reportError(`[candidates/cv] Signed URL failed for candidate ${id}:`, err?.message);
    return NextResponse.json({ error: "Couldn't open the CV. Please try again." }, { status: 500 });
  }

  const { error: activityError } = await supabase.from("candidate_activity").insert({
    candidate_id: id,
    type: download ? "cv_downloaded" : "cv_viewed",
    actor: recruiterDisplayName(profile) || userId,
    meta: {},
  });
  if (activityError) {
    reportError(`[candidates/cv] Failed to record CV access for candidate ${id}:`, activityError.message);
  }

  return NextResponse.json({ url: signedUrl });
});
