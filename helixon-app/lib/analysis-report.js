// The recruiter-facing report for one analysis, built from what the scoring
// pipeline produced (scores.result) and what was read from the CV
// (candidates.extracted). Used by /api/run to answer straight after
// screening, and by /api/candidates/[id] so the candidate profile can show
// the same full report later - before, the report only existed in the
// /api/run response and was gone once you left the Analyse screen.

import { getScoreBand } from "@/lib/scoreBands";

// Contact details and anything identifying are withheld for a blind screen.
export function redactExtracted(ex = {}) {
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

    education: (ex.education || []).map((item) => ({
      ...item,
      institution: item.institution
        ? item.institution.replace(/./g, "█")
        : item.institution,
    })),
  };
}

// Matches interviewQuestions.js's MAX_QUESTIONS, for results stored before
// that cap existed.
const MAX_INTERVIEW_QUESTIONS = 8;

function displayList(items, max = 20) {
  return Array.isArray(items) ? textList(items, max, 1000) : [];
}

export function buildReport(result = {}, extracted = {}, { salary = null, blind = false } = {}) {
  const r = result || {};
  const ex = blind ? redactExtracted(extracted || {}) : extracted || {};

  return {
    match_score: r.match_score ?? 0,
    skill_score: r.skill_score ?? null,
    experience_score: r.experience_score ?? null,
    culture_score: r.culture_score ?? null,
    score_band: getScoreBand(r.match_score ?? 0),
    recommendation: r.recommendation || "Review",
    summary: r.summary || "",
    confidence: r.confidence ?? null,
    score_rationale: r.score_rationale ?? null,

    matched_skills: r.matched_skills || [],
    missing_skills: r.missing_skills || [],
    missing_required: r.missing_required || [],
    missing_preferred: r.missing_preferred || [],
    other_skills: r.other_skills || [],
    // Rendered as plain text on the report (app/analyse/_components/Report),
    // which the candidate profile also shows for analyses stored long ago -
    // one object or non-array in a stored result used to take the whole
    // profile page down, so each list is reduced to clean strings here.
    strengths: displayList(r.strengths),
    weaknesses: displayList(r.weaknesses),
    red_flags: displayList(r.red_flags),
    standout_factors: displayList(r.standout_factors),
    interview_questions: displayList(r.interview_questions, MAX_INTERVIEW_QUESTIONS),
    requirements_met: r.requirements_met || [],
    // Why this score may be less reliable than usual (vague job, AI
    // assessment unavailable, CV cut short) - see scoreCandidate.
    warnings: r.warnings || [],

    experience_breakdown: ex.experience_breakdown || [],
    cv_quality_issues: ex.cv_quality_issues || [],
    education: ex.education || [],
    certifications: ex.certifications || [],
    languages: ex.languages || [],
    name: ex.name,
    email: ex.email ?? null,
    phone: ex.phone ?? null,
    linkedin: ex.linkedin ?? null,
    github: ex.github ?? null,
    portfolio_url: ex.portfolio_url ?? null,
    location: ex.location ?? null,
    current_title: ex.current_title ?? null,
    current_employer: ex.current_employer ?? null,
    notice_period: ex.notice_period ?? null,
    willing_to_relocate: ex.willing_to_relocate ?? null,

    salary_estimate: salary ?? r.salary_estimate ?? null,
    blind_mode: blind,
  };
}

// Items can be plain strings or small objects ({ flag, detail } etc.).
function asText(item) {
  if (typeof item === "string") return item.trim();
  if (!item || typeof item !== "object") return "";
  return String(item.flag || item.title || item.description || item.detail || item.text || item.reason || "").trim();
}

function textList(items, max = 8, maxChars = 300) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const text = asText(item);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text.slice(0, maxChars));
    if (out.length >= max) break;
  }
  return out;
}

// The headline "why they match" copied onto the candidate row
// (match_summary / strengths / concerns), which the profile, lists and
// exports read. Concerns are red flags first, then weaknesses.
export function matchHighlights(result = {}) {
  const r = result || {};
  return {
    match_summary: typeof r.summary === "string" && r.summary.trim() ? r.summary.trim().slice(0, 2000) : null,
    strengths: textList(r.strengths),
    concerns: textList([...(r.red_flags || []), ...(r.weaknesses || [])]),
  };
}
