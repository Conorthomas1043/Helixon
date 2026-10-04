// The client-ready candidate profile: what an agency sends a hiring
// manager, built from the candidate row, their parsed CV (`extracted`) and
// their latest analysis (scores.result). Shown on
// /dashboard/candidates/[id]/client-profile and in a shortlist's client pack.
//
// Never includes the candidate's own contact details (email, phone,
// LinkedIn and other links) - the client goes through the agency - nor the
// recruiter-only parts of the analysis (interview questions, score
// rationale, red flags). Concerns are left out unless asked for.
//
// `blind` anonymises it: the name becomes a label ("Candidate A"), and
// employers, institutions and location are withheld, with any of those
// values that appear in free text replaced the same way blind screening
// does (lib/cv-analysis/scoring/blindRedaction.js). Like blind screening it
// reduces exposure rather than guaranteeing anonymity - a distinctive job
// history can still identify someone.

import { buildBlindCvText } from "@/lib/cv-analysis/scoring/blindRedaction";

const WITHHELD = "Withheld";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function year(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 1900 ? n : null;
}

function span(start, end) {
  const s = year(start);
  const e = year(end);
  if (s && e) return s === e ? String(s) : `${s}–${e}`;
  if (s) return `${s}–present`;
  if (e) return String(e);
  return null;
}

function skillNames(extracted, result) {
  const matched = (result?.matched_skills || []).map((s) => (typeof s === "string" ? s : s?.skill || s?.name)).filter(Boolean);
  const all = (extracted?.skills || []).map((s) => (typeof s === "string" ? s : s?.name)).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const s of [...matched, ...all]) {
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= 20) break;
  }
  return out;
}

/**
 * @param {{ candidate?: Record<string, any>, extracted?: Record<string, any>, result?: Record<string, any> | null, job?: Record<string, any> | null }} input
 * @param {{ blind?: boolean, label?: string, includeConcerns?: boolean }} [options]
 */
export function buildClientProfile({ candidate = {}, extracted = {}, result = null, job = null }, { blind = false, label = "Candidate", includeConcerns = false } = {}) {
  const ex = extracted || {};
  // Free-text redaction works off what extraction identified, plus what the
  // recruiter may have corrected on the row since.
  const identifying = {
    ...ex,
    name: candidate.full_name || candidate.name || ex.name,
    location: candidate.location || ex.location,
    current_employer: candidate.current_company || ex.current_employer,
  };
  const clean = (value) => {
    const t = text(value);
    if (!t) return "";
    return blind ? buildBlindCvText(t, identifying) : t;
  };
  const cleanList = (items, max = 8) => (items || []).map((i) => clean(typeof i === "string" ? i : i?.text || i?.flag || i?.detail || "")).filter(Boolean).slice(0, max);

  const positions = (ex.positions || []).slice(0, 8).map((p) => ({
    title: clean(p.title) || "Role",
    employer: blind ? (p.employer || p.company ? WITHHELD : null) : text(p.employer || p.company) || null,
    dates: span(p.start_year, p.end_year) || text(p.duration) || null,
  }));

  const education = (ex.education || []).slice(0, 5).map((e) =>
    typeof e === "string"
      ? { qualification: clean(e), institution: null, dates: null }
      : {
          qualification: [text(e.degree), text(e.field_of_study)].filter(Boolean).join(", ") || "Qualification",
          institution: blind ? (e.institution ? WITHHELD : null) : text(e.institution) || null,
          dates: span(e.start_year, e.end_year),
        }
  );

  const certifications = (ex.certifications || [])
    .map((c) => (typeof c === "string" ? c : [text(c?.name), year(c?.year) ? `(${year(c.year)})` : ""].filter(Boolean).join(" ")))
    .map(clean)
    .filter(Boolean)
    .slice(0, 8);

  const requirements = (result?.requirements_met || []).map((r) => ({
    requirement: clean(r.requirement),
    status: r.status || (r.met ? "met" : "not_met"),
  }));

  const summary = clean(candidate.match_summary || result?.summary || ex.summary);
  const strengths = cleanList(candidate.strengths?.length ? candidate.strengths : result?.strengths, 6);
  const concerns = includeConcerns
    ? cleanList(candidate.concerns?.length ? candidate.concerns : [...(result?.red_flags || []), ...(result?.weaknesses || [])], 5)
    : [];

  return {
    blind,
    name: blind ? label : candidate.full_name || candidate.name || ex.name || "Candidate",
    currentTitle: clean(candidate.current_title || ex.current_title) || null,
    currentEmployer: blind ? null : text(candidate.current_company || ex.current_employer) || null,
    location: blind ? null : text(candidate.location || ex.location) || null,
    yearsExperience: candidate.years_experience ?? ex.years_experience ?? null,
    noticePeriod: text(ex.notice_period) || null,
    willingToRelocate: typeof ex.willing_to_relocate === "boolean" ? ex.willing_to_relocate : null,
    languages: (ex.languages || []).map((l) => (typeof l === "string" ? l : l?.language || l?.name)).filter(Boolean).slice(0, 6),
    score: typeof candidate.match_score === "number" ? candidate.match_score : result?.match_score ?? null,
    summary: summary || null,
    strengths,
    concerns,
    skills: skillNames(ex, result),
    requirements,
    positions,
    education,
    certifications,
    job: job ? { title: job.title || null, client: job.client || null } : null,
  };
}

// "Candidate A", "Candidate B" … "Candidate AA" for blind packs.
export function blindLabel(index) {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Candidate ${s}`;
}
