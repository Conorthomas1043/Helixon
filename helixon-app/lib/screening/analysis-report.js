// The recruiter-facing report for one analysis, built from what the scoring
// pipeline produced (scores.result) and what was read from the CV
// (candidates.extracted). Used by /api/run to answer straight after
// screening, and by /api/candidates/[id] so the candidate profile shows the
// same full report later.

import { getScoreBand } from "@/lib/screening/scoreBands";
import { aiWritingNotice } from "@/lib/screening/ai-writing";

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

// The CV line behind each matched skill (scoreCandidate's evidence), so the
// report can quote it rather than paraphrase. Withheld for a blind screen: a
// line from the CV can name the candidate's employer or university.
export function skillEvidence(result, { blind = false } = {}) {
  if (blind || !result) return [];
  return (result.evidence || [])
    .filter((e) => e?.supported && e.skill)
    .map((e) => ({ skill: e.skill, quote: String(e.evidence?.[0]?.evidence || "").trim().slice(0, 240) }))
    .filter((e) => e.quote)
    .slice(0, 12);
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
    strengths: r.strengths || [],
    weaknesses: r.weaknesses || [],
    red_flags: r.red_flags || [],
    standout_factors: r.standout_factors || [],
    interview_questions: r.interview_questions || [],
    requirements_met: r.requirements_met || [],
    skill_evidence: skillEvidence(r, { blind }),
    // Why this score may be less reliable than usual (vague job, AI
    // assessment unavailable, CV cut short) - see scoreCandidate.
    warnings: r.warnings || [],

    experience_breakdown: ex.experience_breakdown || [],
    cv_quality_issues: ex.cv_quality_issues || [],
    // An amber prompt to check the specifics at interview, for a CV that
    // clearly reads as AI-written. Never part of the score.
    ai_writing: aiWritingNotice(ex),
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

function textList(items, max = 8) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const text = asText(item);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    out.push(text.slice(0, 300));
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
