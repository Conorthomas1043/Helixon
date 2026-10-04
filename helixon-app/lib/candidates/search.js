// The Candidates search box ("Search candidates, jobs or recruiters…"):
// one free-text term matched against the person (name, current title and
// company, location, email, skills), the job they were screened for (title
// or client) and the recruiter who owns them.
//
// Jobs and recruiters live in other tables, so the route looks those up
// first and passes in the matching ids; everything is then one PostgREST
// .or() filter on candidates. Every value is quoted (see quoted()), so a
// typed term can never become filter syntax.

export const SEARCH_MAX_LEN = 100;

// Person columns on `candidates` the term is matched against.
// extracted->>skills is the parsed CV's skills array as text, so "react"
// finds anyone whose CV lists React.
export const CANDIDATE_SEARCH_COLUMNS = [
  "full_name",
  "name",
  "current_title",
  "current_company",
  "location",
  "email",
  "extracted->>skills",
];

// Quoted PostgREST filter value: inside double quotes, commas, dots and
// parentheses are literal; only backslash and double quote need escaping.
export function quoted(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

// The term, trimmed and capped, or "" when there's nothing to search for.
export function cleanSearchTerm(raw) {
  return String(raw ?? "").trim().slice(0, SEARCH_MAX_LEN);
}

// LIKE wildcards escaped so "50%" is a literal search, not a wildcard scan.
export function likePattern(term) {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}

// The .or() filter string: any person column matching, or the candidate
// belonging to one of `jobIds` / `recruiterIds`.
export function buildCandidateSearchFilter(term, { jobIds = [], recruiterIds = [] } = {}) {
  const pattern = quoted(likePattern(term));
  const parts = CANDIDATE_SEARCH_COLUMNS.map((c) => `${c}.ilike.${pattern}`);
  if (jobIds.length) parts.push(`job_id.in.(${jobIds.map(quoted).join(",")})`);
  if (recruiterIds.length) parts.push(`recruiter_id.in.(${recruiterIds.map(quoted).join(",")})`);
  return parts.join(",");
}

// Recruiter ids whose display name contains the term (case-insensitive).
// `team` is [{ id, name }].
export function matchingRecruiterIds(team, term) {
  const needle = term.toLowerCase();
  return (team || []).filter((r) => r.id && r.name && r.name.toLowerCase().includes(needle)).map((r) => r.id);
}
