// Applications from an agency's public jobs page (/jobs/<slug>/<job>).
//
// receiveApplication() runs inside the request: it checks the CV can be
// read, creates the candidate (processing), keeps the CV file and records
// where they came from and that they agreed to the privacy notice.
// screenApplication() runs after the response (next/server after()): it
// screens the CV against the job exactly like an upload on /analyse, links
// them to anyone already on file, and tells the job's recruiter.
//
// Screening is skipped - the application still lands, unscored - when the
// agency has no active subscription, has hit its monthly screening cap, or
// screening isn't configured.

import { supabase } from "@/lib/supabase";
import { analyseCV, estimateSalary } from "@/lib/cv-analysis";
import extractCvText from "@/lib/cv-analysis/extraction/cvTextExtractor";
import { storeCandidateCv } from "@/lib/candidate-files";
import { matchHighlights } from "@/lib/analysis-report";
import { logActivity } from "@/lib/candidate-activity";
import { findExistingPerson } from "@/lib/candidate-duplicates";
import { capRefusal, getAgencyControls, screeningsThisMonth } from "@/lib/agency-controls";
import { agencyHasActiveSubscription } from "@/lib/customer-auth";
import { jobTextFor } from "@/lib/rescreen";
import { sendAgencyEmail, siteUrl } from "@/lib/mailer";
import { clerkClient } from "@clerk/nextjs/server";
import { notify } from "@/lib/notifications";

export const MAX_CV_BYTES = 10 * 1024 * 1024;
const CV_TYPES = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

export function acceptableCv(file) {
  if (!file || typeof file !== "object" || !file.size) return "Attach your CV.";
  if (file.size > MAX_CV_BYTES) return "Your CV is too large - the limit is 10 MB.";
  const name = String(file.name || "").toLowerCase();
  if (!CV_TYPES.has(file.type) && !name.endsWith(".pdf") && !name.endsWith(".docx")) return "Upload your CV as a PDF or Word (.docx) file.";
  return null;
}

// Returns { candidateId, duplicate } or { error, status }.
export async function receiveApplication({ agency, job, file, applicant, source }) {
  let cvText;
  try {
    cvText = String(await extractCvText(file)).trim();
  } catch {
    return { error: "We couldn't read that file. Try saving your CV as a PDF and uploading it again.", status: 422 };
  }
  if (cvText.length < 50) return { error: "We couldn't find any text in that CV. If it's a scan, please upload a text PDF or Word file.", status: 422 };

  // Someone applying twice for the same job lands once.
  const { data: already } = await supabase
    .from("candidates")
    .select("id")
    .eq("agency_id", agency.id)
    .eq("job_id", job.id)
    .ilike("email", applicant.email.replace(/[\\%_]/g, "\\$&"))
    .limit(1);
  if (already?.length) return { candidateId: already[0].id, duplicate: true };

  const now = new Date().toISOString();
  const { data: candidate, error } = await supabase
    .from("candidates")
    .insert({
      agency_id: agency.id,
      user_id: job.user_id,
      recruiter_id: job.user_id,
      job_id: job.id,
      name: applicant.name,
      full_name: applicant.name,
      email: applicant.email,
      phone: applicant.phone || null,
      linkedin: applicant.linkedin || null,
      cv_text: cvText,
      processing_status: "processing",
      source: source.source,
      source_detail: source.detail,
      applied_at: now,
      consent_given_at: now,
      consent_source: "Jobs page application",
    })
    .select("id")
    .single();
  if (error) {
    console.error("[applications] Insert failed:", error.message);
    return { error: "Something went wrong sending your application. Please try again.", status: 500 };
  }

  try {
    const stored = await storeCandidateCv({ agencyId: agency.id, candidateId: candidate.id, file });
    if (stored) await supabase.from("candidates").update({ cv_file_url: stored.path, cv_filename: stored.fileName }).eq("id", candidate.id);
  } catch (err) {
    console.error("[applications] CV file not stored:", err?.message);
  }

  await logActivity(supabase, candidate.id, "applied", applicant.name, {
    note: `Applied for ${job.public_title || job.title}${source.detail ? ` via ${source.detail}` : ""}`,
    consent: { given_at: now, notice: "Agency privacy notice shown on the application form" },
  });
  return { candidateId: candidate.id, duplicate: false };
}

async function screeningAllowed(agencyId) {
  if (!process.env.ANTHROPIC_API_KEY) return "Screening isn't configured";
  const controls = await getAgencyControls(agencyId);
  if (controls.suspended) return "Workspace suspended";
  if (!(await agencyHasActiveSubscription(agencyId).catch(() => false))) return "No active subscription";
  if (controls.screeningCap && capRefusal(await screeningsThisMonth(agencyId), controls.screeningCap)) return "Monthly screening limit reached";
  return null;
}

// Screens the application and notifies the recruiter. Never throws.
export async function screenApplication({ agency, job, candidateId }) {
  try {
    const { data: candidate } = await supabase.from("candidates").select("id, full_name, email, cv_text").eq("id", candidateId).maybeSingle();
    if (!candidate) return;

    const notAllowed = await screeningAllowed(agency.id);
    let score = null;
    if (notAllowed) {
      await supabase.from("candidates").update({ processing_status: "completed" }).eq("id", candidateId);
      await logActivity(supabase, candidateId, "analysis_completed", "Helixon", { note: `Not screened automatically: ${notAllowed}` });
    } else {
      const jobText = jobTextFor(job);
      const knownJobParsed = job.parsed && Array.isArray(job.parsed.required_skills) ? job.parsed : null;
      const { extracted, result, jobParsed } = await analyseCV(null, jobText, { cvText: candidate.cv_text, jobParsed: knownJobParsed });
      if (!knownJobParsed && jobParsed && !job.parsed?.required_skills) {
        await supabase.from("jobs").update({ parsed: jobParsed }).eq("id", job.id).eq("agency_id", agency.id);
      }
      let salary = null;
      try {
        salary = estimateSalary(extracted || {}, { relevantYears: result?.relevant_years_experience ?? null, job: jobParsed || {} });
      } catch {
        // Optional.
      }
      const ex = extracted || {};
      const existing = await findExistingPerson(supabase, agency.id, { email: candidate.email, linkedin: ex.linkedin });
      const { data: scoreRow } = await supabase
        .from("scores")
        .insert({
          agency_id: agency.id,
          candidate_id: candidateId,
          job_id: job.id,
          user_id: job.user_id,
          match_score: result?.match_score ?? 0,
          recommendation: result?.recommendation || "Review",
          result: {
            ...(result || {}),
            salary_estimate: salary,
            blind_mode: false,
            lawful_basis: { confirmed: true, by: "Applicant consent (jobs page)", at: new Date().toISOString() },
          },
          source: "application",
          stage: "new",
        })
        .select("id")
        .single();
      score = result?.match_score ?? 0;
      await supabase
        .from("candidates")
        .update({
          extracted: ex,
          current_title: ex.current_title || null,
          current_company: ex.current_employer || null,
          location: ex.location || null,
          linkedin: ex.linkedin || undefined,
          years_experience: ex.years_experience ?? null,
          match_score: score,
          recommendation: result?.recommendation || "Review",
          stage: "Screened",
          processing_status: "completed",
          ...(existing && existing.rootId !== candidateId ? { pooled_from_id: existing.rootId } : {}),
          ...matchHighlights(result),
        })
        .eq("id", candidateId);
      await logActivity(supabase, candidateId, "screened", "Helixon", { job_id: job.id, score_id: scoreRow?.id, match_score: score });
    }

    await notify({
      agencyId: agency.id,
      userId: job.owner_id || job.user_id || null,
      kind: "application",
      title: `New application: ${candidate.full_name}`,
      body: `${job.title}${score != null ? ` · match ${score}` : ""}`,
      href: `/dashboard/candidates/${candidate.id}`,
    });
    await notifyRecruiter({ agency, job, candidate, score });
  } catch (err) {
    console.error("[applications] Screening failed:", err?.message);
    await supabase.from("candidates").update({ processing_status: "failed" }).eq("id", candidateId);
  }
}

// One email to the job's recruiter per application, unless they've turned
// application alerts off (Account > Notifications).
async function notifyRecruiter({ agency, job, candidate, score }) {
  if (!job.user_id) return;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(job.user_id);
    if (user?.privateMetadata?.applicationAlerts === false) return;
    const to = user?.primaryEmailAddress?.emailAddress;
    if (!to) return;
    const link = `${siteUrl()}/dashboard/candidates/${candidate.id}`;
    await sendAgencyEmail({
      agencyId: agency.id,
      to,
      replyTo: null,
      fromName: "Helixon",
      subject: `New application: ${candidate.full_name} for ${job.title}${score != null ? ` (match ${score})` : ""}`,
      text: [
        `${candidate.full_name} has applied for ${job.title} through your jobs page.`,
        score != null ? `Match score: ${score}/100.` : "They haven't been screened automatically - open their profile to review.",
        "",
        link,
        "",
        "Turn these off in Account > Notifications.",
      ].join("\n"),
    });
  } catch (err) {
    console.error("[applications] Recruiter alert failed:", err?.message);
  }
}
