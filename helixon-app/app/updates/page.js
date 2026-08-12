"use client";
import { useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Helixon — What's new.
// Signature element: entries carry the same "stage" language as the
// live-scan demo on the homepage (New / Improved / Fixed act like the
// scan's own status pills) so the changelog feels like part of the same
// product, not a bolted-on blog template.
// ═══════════════════════════════════════════════════════════════════════════

const TYPES = {
  new: { label: "New", color: "var(--forest)", bg: "var(--mint)" },
  improved: { label: "Improved", color: "#b45309", bg: "#fdf3e0" },
  fixed: { label: "Fixed", color: "#5a7a6a", bg: "var(--mist)" },
};

const UPDATES = [
  {
    date: "4 August 2026",
    month: "August 2026",
    version: "2.9",
    title: "Bulk CV upload for Team plans",
    type: "new",
    body: "Drag in up to 25 CVs at once and score them all against the same job description. Results land in one shortlist, ranked by match score.",
  },
  {
    date: "29 July 2026",
    month: "July 2026",
    version: "2.8.2",
    title: "Faster scoring on longer CVs",
    type: "improved",
    body: "Analyses on multi-page CVs now complete in under 20 seconds on average, down from 35 — no change needed on your end.",
  },
  {
    date: "22 July 2026",
    month: "July 2026",
    version: "2.8.1",
    title: "Fixed: red flags occasionally duplicated in the summary",
    type: "fixed",
    body: "A small number of analyses showed the same red flag twice in the results panel. This is resolved for all new and re-run analyses.",
  },
  {
    date: "15 July 2026",
    month: "July 2026",
    version: "2.8",
    title: "Editable email drafts before sending",
    type: "improved",
    body: "The candidate follow-up email Helixon drafts is now editable inline before you copy or send it, so you can adjust tone without leaving the results screen.",
  },
  {
    date: "3 July 2026",
    month: "July 2026",
    version: "2.7",
    title: "Shared job description library",
    type: "new",
    body: "Save a job description once and reuse it across analyses. Team plans can share the library across every seat.",
  },
  {
    date: "24 June 2026",
    month: "June 2026",
    version: "2.6.3",
    title: "Fixed: PDF uploads with rotated pages failed to parse",
    type: "fixed",
    body: "CVs scanned or exported with a rotated page now parse correctly instead of returning a low-confidence score.",
  },
  {
    date: "11 June 2026",
    month: "June 2026",
    version: "2.6",
    title: "Analysis history & search",
    type: "new",
    body: "Every past analysis is now searchable by candidate name, role, or score, with filters for date range and outcome.",
  },
];

const MONTHS = [...new Set(UPDATES.map((u) => u.month))];

export default function AppUpdatesPage() {
  const [filter, setFilter] = useState("all");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const filtered = useMemo(
    () => (filter === "all" ? UPDATES : UPDATES.filter((u) => u.type === filter)),
    [filter]
  );
  const groupedMonths = useMemo(() => [...new Set(filtered.map((u) => u.month))], [filtered]);

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
      {/* ── Nav (shared shell) ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
              <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "#8aaa9a" }}>Screen candidates in seconds</span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-1 text-xs font-medium" style={{ color: "#5a7a6a" }}>
            <a href="/#how" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>How it works</a>
            <a href="/#pricing" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Pricing</a>
            <a href="/login" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Login</a>
          </div>

          <div className="flex items-center gap-2">
            <a href="/" className="text-xs font-semibold px-4 py-1.5 rounded-[10px] transition-colors text-white hidden sm:block" style={{ background: "var(--forest)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--forest-deep)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}>
              Try now
            </a>
            <button type="button" onClick={() => setMobileNavOpen((v) => !v)} aria-expanded={mobileNavOpen} aria-label="Open menu"
              className="sm:hidden w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ color: "#13201b" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileNavOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
              </svg>
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="sm:hidden border-t px-4 py-3 flex flex-col gap-0.5 bg-white" style={{ borderColor: "var(--border)" }}>
            {[["How it works", "/#how"], ["Pricing", "/#pricing"], ["Login", "/login"]].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-2.5 rounded-[8px]" style={{ color: "#5a7a6a" }}>{label}</a>
            ))}
          </div>
        )}
      </nav>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 pt-14 pb-8">
          <p className="text-[11px] font-medium mb-3" style={{ color: "#8aaa9a" }}>
            <a href="/" className="hover:underline">Helixon</a> <span className="mx-1">/</span> What&apos;s new
          </p>
          <h1 className="text-3xl sm:text-[38px] font-semibold tracking-tight leading-tight mb-4" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
            What&apos;s new in Helixon
          </h1>
          <p className="text-sm leading-relaxed max-w-xl" style={{ color: "#5a7a6a" }}>
            Every scoring improvement, new feature, and fix — in one place. Shipped continuously, logged here weekly.
          </p>
        </div>
      </header>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="sticky top-[56px] z-30 bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setFilter("all")}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors shrink-0"
            style={{
              background: filter === "all" ? "#13201b" : "transparent",
              color: filter === "all" ? "white" : "#5a7a6a",
              border: filter === "all" ? "none" : "1px solid var(--border)",
            }}
          >
            All updates
          </button>
          {Object.entries(TYPES).map(([key, t]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full transition-colors shrink-0"
              style={{
                background: filter === key ? t.color : "transparent",
                color: filter === key ? "white" : t.color,
                border: filter === key ? "none" : `1px solid ${t.color}`,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Timeline ────────────────────────────────────────────────────── */}
      <div className="max-w-[760px] mx-auto px-6 py-14">
        {groupedMonths.length === 0 && (
          <p className="text-sm text-center py-16" style={{ color: "#8aaa9a" }}>No updates in this category yet.</p>
        )}

        {groupedMonths.map((month) => (
          <div key={month} className="mb-12 last:mb-0">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest mb-5 sticky top-[104px]" style={{ color: "#8aaa9a" }}>
              {month}
            </h2>

            <div className="space-y-5">
              {filtered.filter((u) => u.month === month).map((u) => {
                const t = TYPES[u.type];
                return (
                  <article
                    key={u.version}
                    className="rounded-[14px] p-6 bg-white border transition-shadow hover:shadow-[0_12px_28px_-16px_rgba(19,32,27,0.18)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
                        style={{ background: t.bg, color: t.color }}
                      >
                        {t.label}
                      </span>
                      <span className="text-[11px]" style={{ color: "#8aaa9a" }}>{u.date}</span>
                      <span className="text-[11px] ml-auto" style={{ fontFamily: "var(--font-mono)", color: "#b0c4ba" }}>v{u.version}</span>
                    </div>
                    <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#13201b" }}>{u.title}</h3>
                    <p className="text-[13px] leading-relaxed" style={{ color: "#5a7a6a" }}>{u.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-14 pt-8 border-t text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs mb-3" style={{ color: "#8aaa9a" }}>Have a feature request?</p>
          <a
            href="mailto:feedback@helixon.io"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-[10px]"
            style={{ background: "var(--mint)", color: "var(--forest)" }}
          >
            Tell us what you need
          </a>
        </div>
      </div>

      {/* ── Footer (shared shell) ───────────────────────────────────────── */}
      <footer className="border-t bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px]" style={{ color: "#8aaa9a" }}>© {new Date().getFullYear()} Helixon. Screen candidates in seconds.</span>
          <div className="flex gap-4 text-[11px]" style={{ color: "#8aaa9a" }}>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/dpa">DPA</a>
            <a href="/updates" style={{ color: "var(--forest)", fontWeight: 600 }}>What&apos;s new</a>
          </div>
        </div>
      </footer>
    </main>
  );
}