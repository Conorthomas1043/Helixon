"use client";
import { useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Helixon - Job description library (in-app, behind login).
// Signature element: each card shows a live "used in N analyses" count and
// last-used date - the library's job is to get reused, so recency/frequency
// is the one signal worth surfacing, not a generic card grid.
// ═══════════════════════════════════════════════════════════════════════════

const JOB_DESCRIPTIONS = [
  { id: 1, title: "Senior Sales Executive", team: "Revenue", uses: 14, lastUsed: "2 days ago", updated: "3 Jul 2026", tags: ["Sales", "Senior"] },
  { id: 2, title: "Software Engineer, Backend", team: "Engineering", uses: 9, lastUsed: "5 days ago", updated: "28 Jun 2026", tags: ["Engineering", "Mid-level"] },
  { id: 3, title: "Operations Manager", team: "Operations", uses: 6, lastUsed: "1 week ago", updated: "14 Jun 2026", tags: ["Operations"] },
  { id: 4, title: "Customer Success Manager", team: "Customer Success", uses: 22, lastUsed: "Yesterday", updated: "30 Jul 2026", tags: ["Customer Success", "Senior"] },
  { id: 5, title: "Marketing Coordinator", team: "Marketing", uses: 3, lastUsed: "3 weeks ago", updated: "9 May 2026", tags: ["Marketing", "Junior"] },
  { id: 6, title: "Head of Finance", team: "Finance", uses: 1, lastUsed: "1 month ago", updated: "2 Apr 2026", tags: ["Finance", "Leadership"] },
];

const TEAMS = ["All teams", ...new Set(JOB_DESCRIPTIONS.map((j) => j.team))];

export default function JobDescriptionLibraryPage() {
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("All teams");
  const [sort, setSort] = useState("recent");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = JOB_DESCRIPTIONS.filter((j) => j.title.toLowerCase().includes(query.toLowerCase()));
    if (team !== "All teams") list = list.filter((j) => j.team === team);
    if (sort === "most-used") list = [...list].sort((a, b) => b.uses - a.uses);
    return list;
  }, [query, team, sort]);

  return (
    <main
      className="min-h-screen"
      style={{
        background: "var(--mist)",
        "--forest": "#0b6e4f",
        "--forest-deep": "#085a41",
        "--mint": "#e3f0e9",
        "--mist": "#f6f8f6",
        "--border": "#dde6e1",
        "--signal": "#f59e0b",
        "--font-display": "'Fraunces', Georgia, serif",
        "--font-mono": "'IBM Plex Mono', monospace",
      }}
    >
      {/* ── App nav (logged-in shell) ───────────────────────────────────── */}
      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <a href="/dashboard" className="flex items-center gap-3 group" aria-label="Helixon home">
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
          </a>

          <div className="hidden md:flex items-center gap-1 text-xs font-medium" style={{ color: "#5a7a6a" }}>
            <a href="/dashboard" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Dashboard</a>
            <a href="/analyses" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Analyses</a>
            <a href="/job-descriptions" className="px-3 py-1.5 rounded-[8px]" style={{ background: "var(--mint)", color: "var(--forest)", fontWeight: 600 }}>Job descriptions</a>
            <a href="/settings" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Settings</a>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex w-7 h-7 rounded-full items-center justify-center text-[10px] font-bold" style={{ background: "var(--forest)", color: "white" }}>RO</div>
            <button type="button" onClick={() => setMobileNavOpen((v) => !v)} aria-expanded={mobileNavOpen} aria-label="Open menu"
              className="md:hidden w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ color: "#13201b" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileNavOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
              </svg>
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="md:hidden border-t px-4 py-3 flex flex-col gap-0.5 bg-white" style={{ borderColor: "var(--border)" }}>
            {[["Dashboard", "/dashboard"], ["Analyses", "/analyses"], ["Job descriptions", "/job-descriptions"], ["Settings", "/settings"]].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-2.5 rounded-[8px]" style={{ color: "#5a7a6a" }}>{label}</a>
            ))}
          </div>
        )}
      </nav>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="max-w-[1100px] mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight mb-1.5" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              Job description library
            </h1>
            <p className="text-[13px]" style={{ color: "#5a7a6a" }}>
              Save a job description once, reuse it across every analysis. {JOB_DESCRIPTIONS.length} saved.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-2.5 rounded-[10px] text-white transition-all shrink-0"
            style={{ background: "var(--forest)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--forest-deep)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            New job description
          </button>
        </div>
      </header>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="max-w-[1100px] mx-auto px-6 pb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8aaa9a" strokeWidth="2" strokeLinecap="round" className="absolute left-3.5 top-1/2 -translate-y-1/2">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search job descriptions…"
            className="w-full text-[13px] pl-10 pr-4 py-2.5 rounded-[10px] outline-none bg-white"
            style={{ border: "1px solid var(--border)", color: "#13201b" }}
          />
        </div>
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="text-[13px] px-4 py-2.5 rounded-[10px] bg-white outline-none"
          style={{ border: "1px solid var(--border)", color: "#13201b" }}
        >
          {TEAMS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="text-[13px] px-4 py-2.5 rounded-[10px] bg-white outline-none"
          style={{ border: "1px solid var(--border)", color: "#13201b" }}
        >
          <option value="recent">Recently used</option>
          <option value="most-used">Most used</option>
        </select>
      </div>

      {/* ── Cards ───────────────────────────────────────────────────────── */}
      <div className="max-w-[1100px] mx-auto px-6 pb-20">
        {filtered.length === 0 ? (
          <div className="rounded-[14px] border bg-white py-16 text-center" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm font-semibold mb-1" style={{ color: "#13201b" }}>No job descriptions found</p>
            <p className="text-xs" style={{ color: "#8aaa9a" }}>Try a different search or team filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((jd) => (
              <article
                key={jd.id}
                className="rounded-[14px] p-5 bg-white border transition-shadow hover:shadow-[0_12px_28px_-16px_rgba(19,32,27,0.18)] flex flex-col"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-[13px] font-semibold leading-snug" style={{ color: "#13201b" }}>{jd.title}</h3>
                  <button aria-label="More options" className="shrink-0 w-6 h-6 rounded-[6px] flex items-center justify-center" style={{ color: "#8aaa9a" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-4">
                  {jd.tags.map((t) => (
                    <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>{t}</span>
                  ))}
                </div>

                <div className="mt-auto pt-3 border-t flex items-center justify-between text-[11px]" style={{ borderColor: "var(--border)", color: "#8aaa9a" }}>
                  <span>Used in <strong style={{ fontFamily: "var(--font-mono)", color: "#5a7a6a" }}>{jd.uses}</strong> analyses</span>
                  <span>{jd.lastUsed}</span>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    className="flex-1 text-[11px] font-semibold py-2 rounded-[8px] text-white transition-colors"
                    style={{ background: "var(--forest)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--forest-deep)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}
                  >
                    Use for new analysis
                  </button>
                  <button className="text-[11px] font-semibold px-3 py-2 rounded-[8px]" style={{ border: "1px solid var(--border)", color: "#5a7a6a" }}>
                    Edit
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}