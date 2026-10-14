"use client";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Helixon - What's new.
// Signature element: entries carry the same "stage" language as the
// live-scan demo on the homepage (New / Improved / Fixed act like the
// scan's own status pills) so the changelog feels like part of the same
// product, not a bolted-on blog template.
// ═══════════════════════════════════════════════════════════════════════════

const TYPES = {
  new: { label: "New", color: "var(--forest)", bg: "var(--mint)" },
  improved: { label: "Improved", color: "var(--score-mid)", bg: "var(--ui-warn-soft)" },
  fixed: { label: "Fixed", color: "var(--ink-soft)", bg: "var(--mist)" },
};

const UPDATES = [
  {
    date: "4 August 2026",
    month: "August 2026",
    version: "2.9",
    title: "Bulk CV upload",
    type: "new",
    body: "Drag in a batch of CVs and score them all against the same job description - up to 50 at once on either plan (it launched at 25). Results land in one shortlist, ranked by match score.",
  },
  {
    date: "29 July 2026",
    month: "July 2026",
    version: "2.8.2",
    title: "Faster scoring on longer CVs",
    type: "improved",
    body: "Analyses on multi-page CVs now complete in under 20 seconds on average, down from 35 - no change needed on your end.",
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
    body: "Save a job description once and reuse it across analyses. On the Agency plan, everyone in the team shares the library.",
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

  const filtered = useMemo(
    () => (filter === "all" ? UPDATES : UPDATES.filter((u) => u.type === filter)),
    [filter]
  );
  const groupedMonths = useMemo(() => [...new Set(filtered.map((u) => u.month))], [filtered]);

  return (
    <div className="min-h-screen" style={{ background: "var(--mist)" }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MarketingNav active="updates" />
      <main id="main-content">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 pt-14 pb-8">
          <p className="text-11 font-medium mb-3" style={{ color: "var(--ink-faint)" }}>
            <Link href="/" className="hover:underline">Helixon</Link> <span className="mx-1">/</span> What&apos;s new
          </p>
          <h1 className="text-3xl sm:text-40 font-semibold tracking-tight leading-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            What&apos;s new in Helixon
          </h1>
          <p className="text-sm leading-relaxed max-w-xl" style={{ color: "var(--ink-soft)" }}>
            Every scoring improvement, new feature, and fix - in one place. Shipped continuously, logged here weekly.
          </p>
        </div>
      </header>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="sticky top-[56px] z-30 bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-3 flex items-center gap-2 overflow-x-auto">
          <button type="button"
            onClick={() => setFilter("all")}
            className="text-11 font-semibold px-3 py-1.5 rounded-full transition-colors shrink-0"
            style={{
              background: filter === "all" ? "var(--ink)" : "transparent",
              color: filter === "all" ? "white" : "var(--ink-soft)",
              border: filter === "all" ? "none" : "1px solid var(--border)",
            }}
          >
            All updates
          </button>
          {Object.entries(TYPES).map(([key, t]) => (
            <button type="button"
              key={key}
              onClick={() => setFilter(key)}
              className="text-11 font-semibold px-3 py-1.5 rounded-full transition-colors shrink-0"
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
          <p className="text-sm text-center py-16" style={{ color: "var(--ink-faint)" }}>No updates in this category yet.</p>
        )}

        {groupedMonths.map((month) => (
          <div key={month} className="mb-12 last:mb-0">
            <h2 className="text-11 font-semibold uppercase tracking-widest mb-5 sticky top-[104px]" style={{ color: "var(--ink-faint)" }}>
              {month}
            </h2>

            <div className="space-y-5">
              {filtered.filter((u) => u.month === month).map((u) => {
                const t = TYPES[u.type];
                return (
                  <article
                    key={u.version}
                    className="rounded-card p-6 bg-white border transition-shadow hover:shadow-[0_12px_28px_-16px_rgba(19,32,27,0.18)]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-2.5 mb-3">
                      <span
                        className="text-11 font-bold uppercase tracking-wide px-2 py-1 rounded-full"
                        style={{ background: t.bg, color: t.color }}
                      >
                        {t.label}
                      </span>
                      <span className="text-11" style={{ color: "var(--ink-faint)" }}>{u.date}</span>
                      <span className="text-11 ml-auto" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-faint)" }}>v{u.version}</span>
                    </div>
                    <h3 className="text-sm font-semibold mb-1.5" style={{ color: "var(--ink)" }}>{u.title}</h3>
                    <p className="text-13 leading-relaxed" style={{ color: "var(--ink-soft)" }}>{u.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-14 pt-8 border-t text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs mb-3" style={{ color: "var(--ink-faint)" }}>Have a feature request?</p>
          <a
            href="mailto:hello@helixon.co.uk"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-btn"
            style={{ background: "var(--mint)", color: "var(--forest)" }}
          >
            Tell us what you need
          </a>
        </div>
      </div>

      </main>
      <MarketingFooter />
    </div>
  );
}