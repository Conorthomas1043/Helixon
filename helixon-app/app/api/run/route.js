import { NextResponse, after } from "next/server";
import { supabase } from "@/lib/supabase";
import { agencyDb } from "@/lib/agency-db";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { requireCustomerContext } from "@/lib/auth/customer-auth";
import { capRefusal, screeningsThisMonth } from "@/lib/agency/controls";
import { analyseCV } from "@/lib/cv-analysis";
import { buildReport } from "@/lib/screening/analysis-report";
import { candidatePayload, emitWebhook } from "@/lib/integrations/webhooks";
import { readScreeningForm, reusableJobParsed, screeningFailure } from "@/lib/screening/input";
import { duplicateNotice, saveScreening } from "@/lib/screening/save";
import { reportError } from "@/lib/report-error";
import { captureAgencyEvent } from "@/lib/analytics/server";
import { aiWritingNotice } from "@/lib/screening/ai-writing";
import { noteFirstScreening } from "@/lib/agency/test-account";

// POST (multipart) - screen one CV against a job: check the request, run the
// analysis (lib/cv-analysis), save it (lib/screening/save.js) and answer with
// the report. The agency always comes from the signed-in member, never from
// the form.

// Two or three model calls per screening, each with its own retries. Set so
// the intended timeout is visible here; the Vercel plan may cap it lower.
export const maxDuration = 240;

// Per signed-in user per hour: comfortably above one full bulk upload (50
// CVs), so a batch never stalls part-way through.
const RUN_LIMIT_PER_USER_PER_HOUR = 100;
// Per address, before any work: a loose flood guard. The real allowance is
// per user, so a whole office behind one address isn't throttled together.
const RUN_LIMIT_PER_IP_PER_HOUR = 300;

const refuse = (status, error, extra) => NextResponse.json({ ok: false, error, ...extra }, { status });

// With `X-Run-Progress: ndjson` the answer is streamed as lines of JSON:
// { type: "progress", step } as each stage of the analysis finishes, then
// { type: "done", status, body } with what the plain request would have
// answered. The screening view shows real progress that way; without the
// header (the public API, older clients) it's the same JSON as ever.
export async function POST(request) {
  if (request.headers.get("x-run-progress") !== "ndjson") return screen(request, null);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
      const response = await screen(request, (step) => send({ type: "progress", step }));
      send({ type: "done", status: response.status, body: await response.json().catch(() => null) });
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}

async function screen(request, onProgress) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) return refuse(500, "Screening service is not configured.");
    if (!(await rateLimit(`run-ip:${getClientIp(request)}`, RUN_LIMIT_PER_IP_PER_HOUR))) {
      return refuse(429, "Too many requests. Please try again later.");
    }

    const auth = await requireCustomerContext({ requireSubscription: true });
    if (!auth.ok) return refuse(auth.status, auth.error, { upgrade: auth.upgrade || false });
    const { userId, agencyId, profile } = auth;

    // An optional monthly cap an admin can set per agency (Admin > Agencies).
    if (auth.screeningCap) {
      const capped = capRefusal(await screeningsThisMonth(agencyId), auth.screeningCap);
      if (capped) return refuse(capped.status, capped.error, { capReached: true });
    }

    const read = await readScreeningForm(await request.formData());
    if (read.error) return refuse(read.status, read.error);
    const { input } = read;

    // Counted only for valid requests, so a rejected upload doesn't use up
    // one of the hour's screenings.
    if (!(await rateLimit(`run-user:${userId}`, RUN_LIMIT_PER_USER_PER_HOUR))) {
      return refuse(429, "Hourly analysis limit reached. Please try again later.");
    }

    const db = await agencyDb();

    // A saved job must be this agency's. Checked before the (paid) analysis,
    // so a bad id costs nothing and leaves nothing behind.
    let existingJob = null;
    if (input.existingJobId) {
      const { data, error } = await db.from("jobs").select("*").eq("id", input.existingJobId).eq("agency_id", agencyId).maybeSingle();
      if (error || !data) return refuse(404, "That saved job could not be found.");
      existingJob = data;
    }

    const reusedJobParsed = reusableJobParsed(existingJob, input);
    const analysis = await analyseCV(input.file, input.jobText, { blind: input.blind, jobParsed: reusedJobParsed, onProgress });

    const saved = await saveScreening({ db, supabase, agencyId, userId, profile, input, existingJob, reusedJobParsed, analysis });
    const { candidate, job, score, salary, existingPerson, extracted } = saved;
    const matchScore = analysis.result?.match_score ?? null;

    after(() =>
      emitWebhook(agencyId, "candidate.created", candidatePayload({ ...candidate, match_score: matchScore, job_id: job.id }, { jobTitle: job.title ?? null, via: "screening" }))
    );
    // How often the AI-writing check fires, per agency (no CV content).
    after(() =>
      captureAgencyEvent("cv_ai_writing_checked", agencyId, {
        likelihood: extracted?.ai_writing?.likelihood ?? "unknown",
        flagged: Boolean(aiWritingNotice(extracted)),
      })
    );

    after(() => noteFirstScreening(agencyId));

    return NextResponse.json({
      ok: true,
      result: buildReport(analysis.result, extracted, { salary, blind: input.blind }),
      candidateId: candidate.id,
      jobId: job.id,
      scoreId: score.id,
      duplicate: await duplicateNotice(db, { agencyId, candidateId: candidate.id, jobId: job.id, existingPerson }),
      job: { id: job.id, title: job.title, is_saved: job.is_saved, status: job.status },
      // The live pipeline stage (candidates.stage), not scores.stage ("new").
      stage: "Screened",
    });
  } catch (error) {
    reportError("[run] Error:", error);
    const { status, error: message } = screeningFailure(error);
    return refuse(status, message);
  }
}
