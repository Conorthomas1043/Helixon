import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/ratelimit";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { analyseCV, estimateSalary } from "@/lib/cv-analysis";
import { isAdminUser } from "@/lib/admin-auth";
import { getScoreBand } from "@/lib/scoreBands";
import { NextResponse } from "next/server";

const ACCEPTED_CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);
const ACCEPTED_CV_EXTENSIONS = [".pdf", ".doc", ".docx"];
const FREE_TRIAL_LIMIT = 3;

function isAcceptedCvFile(file) {
  if (!file) return false;
  if (file.type && ACCEPTED_CV_MIME_TYPES.has(file.type)) return true;
  const name = (file.name || "").toLowerCase();
  return ACCEPTED_CV_EXTENSIONS.some(ext => name.endsWith(ext));
}

function redactExtracted(ex = {}) {
  return {
    ...ex,
    name: "Candidate",
    email: null,
    phone: null,
    linkedin: null,
    github: null,
    portfolio_url: null,
    location: null,
    current_employer: null,
    education: (ex.education || []).map(e => ({
      ...e,
      institution: e.institution ? e.institution.replace(/./g, "█") : e.institution
    }))
  };
}

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY");
    }

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!rateLimit(ip)) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const cookieStore = await cookies();

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          }
        }
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    const userId = user?.id || null;
    const isAdmin = await isAdminUser(request);

    // ── Resolve agencyId server-side — never trust the client form value ──
    // Logged-in users: agencyId should come from their own agency record via
    // a users<->agencies relationship if you have one; for now we still
    // honour form agencyId ONLY when userId is present, matching existing
    // behaviour, since authenticated requests already carry a verified
    // identity. Anonymous/trial requests get their agencyId from the
    // httpOnly cookie set by /api/trial/start — the client never controls it.
    const trialAgencyId = cookieStore.get("helixon_trial")?.value || null;
    const formAgencyId = (await request.clone().formData().catch(() => null))?.get?.("agencyId") || null;

    const agencyId = userId ? formAgencyId : trialAgencyId;

    if (!agencyId) {
      return NextResponse.json(
        { ok: false, error: "No trial session found. Please start a free trial first." },
        { status: 401 }
      );
    }

    // ── Free-trial limit for LOGGED-IN users (existing behaviour) ─────────
    if (userId && !isAdmin) {
      const { count } = await supabase
        .from("scores")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .single();

      if (sub?.status !== "active" && (count || 0) >= FREE_TRIAL_LIMIT) {
        return NextResponse.json(
          { ok: false, upgrade: true, message: "You have used your free analyses." },
          { status: 402 }
        );
      }
    }

    // ── Free-trial limit for ANONYMOUS trial users, keyed on agency ───────
    if (!userId && !isAdmin) {
      const { count } = await supabase
        .from("scores")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId);

      if ((count || 0) >= FREE_TRIAL_LIMIT) {
        return NextResponse.json(
          { ok: false, upgrade: true, message: "You have used your free analyses." },
          { status: 402 }
        );
      }
    }

    const form = await request.formData();

    const file = form.get("cv");
    const jobText = form.get("jobText");
    const blind = form.get("blind") === "true";
    const existingJobId = form.get("jobId") || null;
    const saveJob = form.get("saveJob") === "true";

    if (!file || !jobText) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }

    if (!isAcceptedCvFile(file)) {
      return NextResponse.json({ ok: false, error: "Unsupported CV file." }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "CV file too large." }, { status: 400 });
    }

    if (jobText.trim().length < 50) {
      return NextResponse.json({ ok: false, error: "Job description too short." }, { status: 400 });
    }

    const { cvText, extracted, result, jobParsed } = await analyseCV(file, jobText);

    const ex = extracted || {};

    let salary = null;
    try {
      salary = estimateSalary(ex);
    } catch (error) {
      console.warn("[run] Salary estimate failed:", error.message);
      salary = null;
    }

    const { data: cand, error: candError } = await supabase
      .from("candidates")
      .insert({
        agency_id: agencyId,
        name: ex.name || "Candidate",
        cv_text: cvText || "",
        extracted: ex
      })
      .select()
      .single();

    if (candError) throw new Error(candError.message);

    let job;

    if (existingJobId) {
      const { data: existingJob, error: existingJobError } = await supabase
        .from("jobs")
        .select()
        .eq("id", existingJobId)
        .eq("agency_id", agencyId)
        .single();

      if (existingJobError) {
        throw new Error(`Saved job not found: ${existingJobError.message}`);
      }
      job = existingJob;
    } else {
      const { data: newJob, error: jobError } = await supabase
        .from("jobs")
        .insert({
          agency_id: agencyId,
          title: jobParsed?.title || "Untitled Role",
          job_text: jobText,
          parsed: jobParsed || {},
          is_saved: saveJob,
          status: "open"
        })
        .select()
        .single();

      if (jobError) throw new Error(jobError.message);
      job = newJob;
    }

    const { data: scoreRow, error: scoreError } = await supabase
      .from("scores")
      .insert({
        agency_id: agencyId,
        candidate_id: cand.id,
        job_id: job.id,
        match_score: result?.match_score || 0,
        recommendation: result?.recommendation || "Review",
        result: { ...(result || {}), salary_estimate: salary },
        user_id: userId,
        source: "single",
        stage: "new"
      })
      .select()
      .single();

    if (scoreError) throw new Error(scoreError.message);

    // ── Bump analyses_used in agencies.settings for trial visibility ──────
    if (!userId) {
      const { data: agencyRow } = await supabase
        .from("agencies")
        .select("settings")
        .eq("id", agencyId)
        .single();

      const settings = agencyRow?.settings || {};
      await supabase
        .from("agencies")
        .update({ settings: { ...settings, analyses_used: (settings.analyses_used || 0) + 1 } })
        .eq("id", agencyId);
    }

    const displayEx = blind ? redactExtracted(ex) : ex;

    return NextResponse.json({
      ok: true,
      result: {
        match_score: result?.match_score ?? 0,
        skill_score: result?.skill_score ?? null,
        experience_score: result?.experience_score ?? null,
        culture_score: result?.culture_score ?? null,
        score_band: getScoreBand(result?.match_score ?? 0),
        recommendation: result?.recommendation ?? "Review",
        summary: result?.summary ?? "",
        confidence: result?.confidence ?? null,
        score_rationale: result?.score_rationale ?? null,
        matched_skills: result?.matched_skills ?? [],
        missing_skills: result?.missing_skills ?? [],
        missing_required: result?.missing_required ?? [],
        missing_preferred: result?.missing_preferred ?? [],
        other_skills: result?.other_skills ?? [],
        strengths: result?.strengths ?? [],
        weaknesses: result?.weaknesses ?? [],
        red_flags: result?.red_flags ?? [],
        standout_factors: result?.standout_factors ?? [],
        interview_questions: result?.interview_questions ?? [],
        experience_breakdown: displayEx.experience_breakdown ?? [],
        cv_quality_issues: displayEx.cv_quality_issues ?? [],
        education: displayEx.education ?? [],
        certifications: displayEx.certifications ?? [],
        languages: displayEx.languages ?? [],
        name: displayEx.name,
        email: displayEx.email ?? null,
        phone: displayEx.phone ?? null,
        linkedin: displayEx.linkedin ?? null,
        github: displayEx.github ?? null,
        portfolio_url: displayEx.portfolio_url ?? null,
        location: displayEx.location ?? null,
        current_title: displayEx.current_title ?? null,
        current_employer: displayEx.current_employer ?? null,
        notice_period: displayEx.notice_period ?? null,
        willing_to_relocate: displayEx.willing_to_relocate ?? null,
        salary_estimate: salary,
        blind_mode: blind
      },
      candidateId: cand.id,
      jobId: job.id,
      scoreId: scoreRow.id,
      job: { id: job.id, title: job.title, is_saved: job.is_saved, status: job.status },
      stage: scoreRow.stage
    });
  } catch (err) {
    console.error("[run] Error:", err.message, err.stack);

    const pdfError =
      err.message?.includes("Unable to extract text from PDF") ||
      err.message?.includes("PDF contained");

    return NextResponse.json(
      {
        ok: false,
        error: pdfError
          ? "We couldn't read this PDF. It may be corrupted or exported in an unusual way. Try re-saving the CV as PDF, or upload a DOCX version."
          : err.message || "Something went wrong analysing this candidate."
      },
      { status: pdfError ? 422 : 500 }
    );
  }
}




