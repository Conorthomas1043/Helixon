// The actions the ⌘K palette can run (components/dashboard/NavTools.jsx),
// alongside what it finds. Matched on every word typed, against the label
// and a few other words people use for the same thing ("upload", "score").

export const COMMANDS = [
  { id: "screen", title: "Screen a CV", hint: "Score a CV against a role", href: "/analyse", words: "analyse upload score new candidate" },
  { id: "bulk", title: "Screen a batch of CVs", hint: "Up to 50 against one role", href: "/analyse?mode=bulk", words: "bulk many zip upload rank" },
  { id: "job", title: "Add a job", hint: "Start a pipeline for a role", href: "/dashboard/jobs?new=1", words: "new role vacancy create" },
  { id: "sample", title: "Try a sample CV", hint: "See a full report first", href: "/analyse?sample=1", words: "demo example" },
  { id: "go-overview", title: "Go to Overview", href: "/dashboard", words: "home today dashboard" },
  { id: "go-candidates", title: "Go to Candidates", href: "/dashboard/candidates", words: "people list" },
  { id: "go-pipeline", title: "Go to Pipeline", href: "/dashboard/pipeline", words: "board stages kanban" },
  { id: "go-jobs", title: "Go to Jobs", href: "/dashboard/jobs", words: "roles vacancies" },
  { id: "go-clients", title: "Go to Clients", href: "/dashboard/clients", words: "companies accounts" },
  { id: "go-interviews", title: "Go to Interviews", href: "/dashboard/interviews", words: "calendar schedule" },
  { id: "go-placements", title: "Go to Placements", href: "/dashboard/placements", words: "invoices fees revenue" },
  { id: "go-talent", title: "Go to Talent pool", href: "/dashboard/talent-pool", words: "saved later" },
  { id: "go-analytics", title: "Go to Analytics", href: "/dashboard/analytics", words: "reports stats performance" },
  { id: "go-settings", title: "Go to Settings", href: "/dashboard/settings", words: "account preferences team" },
];

// Shown before anything's typed, after the recently viewed.
export const SUGGESTED = ["screen", "bulk", "job"];

/** @param {string} q @param {number} [limit] */
export function matchCommands(q, limit = 5) {
  const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return COMMANDS.filter((c) => SUGGESTED.includes(c.id));
  return COMMANDS.map((c) => {
    const title = c.title.toLowerCase();
    const hay = `${title} ${c.words}`;
    if (!terms.every((t) => hay.includes(t))) return null;
    // Title words that start with what was typed rank first.
    const rank = terms.every((t) => title.split(/\s+/).some((w) => w.startsWith(t))) ? 0 : 1;
    return { c, rank };
  })
    .filter(Boolean)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map(({ c }) => c);
}
