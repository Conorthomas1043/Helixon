// Pure helpers behind the compare page (app/analyse/compare): who each
// column is, the requirement-by-requirement grid, must-haves, which score
// wins each row, and a plain-English verdict. Kept free of React so it can
// be unit tested.

const LETTERS = ["A", "B", "C", "D"];

// Blind-screened candidates stay anonymous here too.
export function columnLabels(candidates) {
  return candidates.map((c, i) => (c.blind ? `Candidate ${LETTERS[i]}` : c.name || `Candidate ${LETTERS[i]}`));
}

const IMPORTANCE_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

// How a candidate stands on one skill: the depth the CV shows it at
// (skill_credit.basis from scoring), or missing.
const BASIS_STATE = {
  Expert: { state: "strong", label: "Expert" },
  Used: { state: "strong", label: "Used" },
  Evidenced: { state: "strong", label: "Used" },
  Judged: { state: "strong", label: "Shown in CV" },
  Mentioned: { state: "weak", label: "Listed only" },
  Unevidenced: { state: "weak", label: "Listed only" },
};

function lower(list = []) {
  return new Set(list.map((s) => String(s).toLowerCase()));
}

export function skillStatus(candidate, skill) {
  const key = skill.toLowerCase();
  const credit = (candidate.skillCredit || []).find((c) => String(c.skill).toLowerCase() === key);
  const quote = (candidate.semanticMatches || []).find(
    (m) => String(m.skill).toLowerCase() === key && m.method === "cv_evidence"
  )?.via;

  if (credit) {
    const base = BASIS_STATE[credit.basis] || { state: "strong", label: "Matched" };
    return { ...base, stale: !!credit.stale, evidence: quote || null };
  }
  if (lower(candidate.matchedSkills).has(key)) return { state: "strong", label: "Matched", evidence: quote || null };
  if (lower(candidate.missingRequired).has(key) || lower(candidate.missingPreferred).has(key)) {
    return { state: "missing", label: "Missing" };
  }
  return { state: "unknown", label: "Not assessed" };
}

// Rows for the role's required (or preferred) skills, most important first.
// Falls back to the union of what the analyses mention when the saved role
// has no parsed skill list (older jobs).
export function skillRows(job, candidates, kind = "required") {
  let skills = kind === "required" ? job?.requiredSkills || [] : job?.preferredSkills || [];
  if (!skills.length && kind === "required") {
    const seen = new Map();
    for (const c of candidates) {
      for (const s of [...(c.matchedSkills || []), ...(c.missingRequired || [])]) {
        if (!seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
      }
    }
    skills = [...seen.values()];
  }
  const importance = job?.skillImportance || {};
  const rows = skills.map((skill) => ({
    skill,
    importance: kind === "required" ? importance[skill] || null : null,
    cells: candidates.map((c) => skillStatus(c, skill)),
  }));
  if (kind === "required") {
    rows.sort((a, b) => (IMPORTANCE_ORDER[a.importance] ?? 2) - (IMPORTANCE_ORDER[b.importance] ?? 2));
  }
  return rows;
}

export function coverage(rows, index) {
  const assessed = rows.filter((r) => r.cells[index].state !== "unknown");
  return { met: assessed.filter((r) => r.cells[index].state !== "missing").length, of: assessed.length };
}

// Must-haves (knockouts and recruiter-added requirements), unioned across
// candidates by their wording.
export function mustHaveRows(candidates) {
  const byText = new Map();
  candidates.forEach((c, i) => {
    for (const r of c.requirementsMet || []) {
      const text = r.requirement;
      if (!byText.has(text)) byText.set(text, candidates.map(() => null));
      const status = r.status || (r.met ? "met" : "not_met");
      byText.get(text)[i] = status;
    }
  });
  return [...byText.entries()].map(([requirement, cells]) => ({ requirement, cells }));
}

// Index(es) of the best value in a row - none when tied across the board or
// fewer than two values exist.
export function winners(values, { lowerIsBetter = false } = {}) {
  const nums = values.map((v) => (typeof v === "number" ? v : null));
  const present = nums.filter((v) => v != null);
  if (present.length < 2) return [];
  const best = lowerIsBetter ? Math.min(...present) : Math.max(...present);
  if (present.every((v) => v === best)) return [];
  return nums.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
}

function listJoin(items) {
  if (items.length <= 1) return items[0] || "";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

// A short, factual read of the comparison - every sentence traceable to a
// number or a grid cell on the page, nothing invented.
export function verdict(candidates, labels, requiredRows, mustHaves) {
  const scored = candidates.map((c, i) => ({ i, score: c.matchScore })).filter((x) => typeof x.score === "number");
  if (scored.length < 2) return [];

  // Has the skill at all - listed-only still beats missing it entirely.
  const has = (cell) => cell.state === "strong" || cell.state === "weak";

  const lines = [];
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const [first, second] = sorted;
  const gap = first.score - second.score;

  if (gap <= 3) {
    lines.push(`${labels[first.i]} and ${labels[second.i]} are level on overall score (${first.score} vs ${second.score}) - the detail below decides it.`);
  } else {
    lines.push(`${labels[first.i]} leads overall with ${first.score}, ${gap} points ahead of ${labels[second.i]}.`);
  }

  // Required skills only the leader has - most important first.
  const leaderOnly = requiredRows
    .filter((r) => has(r.cells[first.i]) && r.cells.some((c, j) => j !== first.i && c.state === "missing"))
    .slice(0, 3)
    .map((r) => r.skill);
  if (leaderOnly.length) {
    lines.push(`${labels[first.i]} shows ${listJoin(leaderOnly)}, which ${candidates.length > 2 ? "not everyone" : labels[second.i]} does.`);
  }

  // Where someone else is stronger - so the leader's gaps aren't hidden.
  for (const other of sorted.slice(1)) {
    const edge = requiredRows
      .filter((r) => has(r.cells[other.i]) && r.cells[first.i].state === "missing")
      .slice(0, 2)
      .map((r) => r.skill);
    if (edge.length) {
      lines.push(`${labels[other.i]} has ${listJoin(edge)}, which ${labels[first.i]} is missing.`);
    }
  }

  const years = candidates.map((c) => c.relevantYears);
  const yearWinners = winners(years);
  if (yearWinners.length === 1 && years.filter((y) => typeof y === "number").length >= 2) {
    const w = yearWinners[0];
    const others = years.filter((y, j) => j !== w && typeof y === "number");
    lines.push(`${labels[w]} has the most relevant experience (${years[w]} years vs ${listJoin(others.map(String))}).`);
  }

  const failing = mustHaves.filter((r) => r.cells.some((c) => c === "not_met"));
  for (const row of failing.slice(0, 2)) {
    const who = row.cells.map((c, j) => (c === "not_met" ? labels[j] : null)).filter(Boolean);
    lines.push(`${listJoin(who)} ${who.length === 1 ? "doesn't" : "don't"} meet "${row.requirement}".`);
  }
  const toConfirm = mustHaves.filter((r) => r.cells.some((c) => c === "unverified"));
  if (toConfirm.length) {
    lines.push(`${toConfirm.length} must-have${toConfirm.length === 1 ? "" : "s"} can't be checked from a CV - confirm at interview.`);
  }

  const otherRole = candidates.map((c, j) => (c.otherRole ? labels[j] : null)).filter(Boolean);
  if (otherRole.length) {
    lines.push(`${listJoin(otherRole)} ${otherRole.length === 1 ? "was" : "were"} scored against a different role, so their numbers aren't like-for-like.`);
  }

  return lines;
}
