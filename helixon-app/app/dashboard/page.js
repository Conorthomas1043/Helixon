"use client";

import { useState, useEffect, useRef } from "react";

const AGENCY_ID = "YOUR-SEED-AGENCY-ID"; // replace with real auth later

// ═══════════════════════════════════════════════════════════════════════════
// Shared app nav — same shell as the landing page's <nav>, extended with
// product links (Scoring / Dashboard) and an account menu.
// ═══════════════════════════════════════════════════════════════════════════
function AppNav({ active }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const navLink = (label, href, key) => (
    <a
      key={key}
      href={href}
      className="px-3 py-1.5 rounded-[8px] transition-colors"
      style={{ color: active === key ? "#13201b" : "#5a7a6a", background: active === key ? "var(--mint)" : "transparent", fontWeight: active === key ? 600 : 500 }}
      onMouseEnter={(e) => { if (active !== key) e.currentTarget.style.background = "var(--mint)"; }}
      onMouseLeave={(e) => { if (active !== key) e.currentTarget.style.background = "transparent"; }}
    >
      {label}
    </a>
  );

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight hidden sm:block" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
          </a>
          <div className="hidden sm:flex items-center gap-1 text-xs">
            {navLink("Scoring", "/", "scoring")}
            {navLink("Dashboard", "/dashboard", "dashboard")}
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition-colors"
            style={{ border: "1px solid var(--border)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center" style={{ background: "var(--forest)" }}>
              AV
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8aaa9a" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {menuOpen && (
            <div role="menu" className="absolute right-0 mt-2 w-52 rounded-[14px] py-1.5 z-50" style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 16px 32px -14px rgba(19,32,27,0.25)" }}>
              <div className="px-3.5 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-sm font-medium truncate" style={{ color: "#13201b" }}>Acme Recruiting</p>
                <p className="text-xs truncate" style={{ color: "#8aaa9a" }}>agency@acme.com</p>
              </div>
              <a href="/account" role="menuitem" className="block px-3.5 py-2 text-sm" style={{ color: "#5a7a6a" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                Account settings
              </a>
              <a href="/billing" role="menuitem" className="block px-3.5 py-2 text-sm" style={{ color: "#5a7a6a" }} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                Billing
              </a>
              <div className="border-t mt-1 pt-1" style={{ borderColor: "var(--border)" }}>
                <a href="/logout" role="menuitem" className="block px-3.5 py-2 text-sm" style={{ color: "#dc2626" }} onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  Log out
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

// ── Small icon set (inline, matches the landing page's line-icon style) ──
const ICONS = {
  analyses: <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  all_time: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  candidates: <><circle cx="9" cy="8" r="3" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 8.5a3 3 0 110 6" /><path d="M17.5 14.5c2.5.5 4 2 4 5.5" /></>,
  accuracy: <path d="M4 6l1.5 1.5L8 4M4 12l1.5 1.5L8 10M4 18l1.5 1.5L8 16M12 6h8M12 12h8M12 18h8" />,
  strong: <><path d="M12 2l2.6 6.2L21 9l-5 4.5L17.4 21 12 17.6 6.6 21 8 13.5 3 9l6.4-.8z" /></>,
  review: <><circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 1.5" /></>,
  summaries: <><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
  emails: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
};

function MetricCardSkeleton() {
  return (
    <div className="rounded-[14px] p-5 animate-pulse" style={{ background: "white", border: "1px solid var(--border)" }}>
      <div className="w-8 h-8 rounded-[9px] mb-4" style={{ background: "var(--mist)" }} />
      <div className="h-6 w-16 rounded" style={{ background: "var(--border)" }} />
      <div className="h-2.5 w-24 rounded mt-3" style={{ background: "var(--mist)" }} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[16px] py-16 px-6 text-center" style={{ background: "white", border: "1.5px dashed var(--border)" }}>
      <div className="w-12 h-12 rounded-[12px] flex items-center justify-center mx-auto mb-4" style={{ background: "var(--mint)" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.6" strokeLinecap="round">
          {ICONS.analyses}
        </svg>
      </div>
      <h2 className="font-semibold mb-1.5" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>No analyses yet</h2>
      <p className="text-sm max-w-xs mx-auto mb-6" style={{ color: "#5a7a6a" }}>
        Run your first CV against a job description and your analytics will show up here.
      </p>
      <a
        href="/"
        className="inline-flex items-center gap-1.5 text-sm font-semibold px-5 py-3 rounded-[10px] text-white transition-transform hover:scale-[1.02]"
        style={{ background: "var(--forest)", boxShadow: "0 8px 20px -8px rgba(11,110,79,0.5)" }}
      >
        Score your first CV
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </a>
    </div>
  );
}

function StatCard({ label, value, icon, accent }) {
  return (
    <div
      className="rounded-[14px] p-5 transition-transform hover:-translate-y-0.5"
      style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 12px 24px -18px rgba(19,32,27,0.25)" }}
    >
      <div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-4" style={{ background: "var(--mint)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accent || "var(--forest)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </div>
      <div className="text-2xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "#13201b" }}>{value ?? 0}</div>
      <div className="text-[10px] font-medium uppercase tracking-wide mt-1.5" style={{ color: "#8aaa9a" }}>{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, [days]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?agencyId=${AGENCY_ID}&days=${days}`);
      let json;
      try {
        json = await res.json();
      } catch {
        throw new Error(`Server returned an unexpected response (status ${res.status}).`);
      }
      if (!res.ok || !json.ok) {
        throw new Error(json?.error || `Couldn't load analytics (status ${res.status}).`);
      }
      setData(json.analytics);
    } catch (err) {
      setError(err.message || "Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (!data?.time_series) return;
    const rows = [
      "Date,Analyses,Avg Score",
      ...data.time_series.map((r) => `${r.date},${r.count},${r.avg}`),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    a.download = `helixon-${days}days.csv`;
    a.click();
  }

  const metrics = data
    ? [
        { label: "Analyses (period)", value: data.totals.period, icon: ICONS.analyses },
        { label: "All time analyses", value: data.totals.all_time, icon: ICONS.all_time },
        { label: "Candidates", value: data.totals.candidates, icon: ICONS.candidates },
        { label: "Accuracy rate", value: data.accuracy.rate !== null ? `${data.accuracy.rate}%` : "No feedback", icon: ICONS.accuracy },
        { label: "Strong matches", value: data.recommendations["Strong match"], icon: ICONS.strong, accent: "var(--forest)" },
        { label: "Worth reviewing", value: data.recommendations["Worth reviewing"], icon: ICONS.review, accent: "#b45309" },
        { label: "Summaries", value: data.totals.summaries, icon: ICONS.summaries },
        { label: "Emails drafted", value: data.totals.emails, icon: ICONS.emails },
      ]
    : [];

  const isEmpty = data && data.totals.all_time === 0;
  const rangeLabel = { 7: "last 7 days", 30: "last 30 days", 90: "last 90 days" }[days];

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <AppNav active="dashboard" />

      {/* ── Page header — echoes the landing hero's eyebrow + heading rhythm ── */}
      <section className="max-w-[1100px] mx-auto px-6 pt-12 pb-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-4" style={{ background: "var(--mint)", color: "var(--forest)" }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "var(--forest)" }} />
              {loading ? "Loading overview…" : `Showing ${rangeLabel}`}
            </span>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              Your screening, at a glance.
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label="Date range"
              disabled={loading}
              className="text-xs font-medium rounded-[10px] px-3 py-3 disabled:opacity-50 focus:outline-none"
              style={{ border: "1px solid var(--border)", color: "#13201b", background: "white" }}
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={exportCSV}
              disabled={!data?.time_series?.length}
              className="text-xs font-semibold px-4 py-3 rounded-[10px] transition-colors disabled:opacity-40 whitespace-nowrap"
              style={{ border: "1px solid var(--border)", color: "#5a7a6a", background: "white" }}
              onMouseEnter={(e) => { if (data?.time_series?.length) e.currentTarget.style.background = "var(--mint)"; }}
              onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
            >
              Export CSV
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-[1100px] mx-auto px-6 pb-20">

        {error && (
          <div role="alert" className="mb-6 flex items-start justify-between gap-4 p-4 rounded-[14px]" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm" style={{ color: "#b91c1c" }}>{error}</p>
            </div>
            <button onClick={load} className="text-sm font-semibold whitespace-nowrap hover:underline" style={{ color: "#b91c1c" }}>
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <MetricCardSkeleton key={i} />)}
          </div>
        ) : isEmpty ? (
          <EmptyState />
        ) : data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {metrics.map((m) => <StatCard key={m.label} {...m} />)}
            </div>

            {data.time_series.length > 0 && (
              <div className="rounded-[16px] p-6 mb-6" style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 12px 24px -18px rgba(19,32,27,0.25)" }}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold" style={{ color: "#13201b" }}>Analyses over time</h2>
                  <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "#8aaa9a" }}>{rangeLabel}</span>
                </div>
                <div className="flex items-end gap-1 h-28">
                  {data.time_series.map((day, i) => {
                    const max = Math.max(...data.time_series.map((d) => d.count), 1);
                    const heightPct = Math.max((day.count / max) * 100, 3);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center group relative">
                        <div
                          className="w-full rounded-[3px] transition-colors"
                          style={{ height: `${heightPct}%`, background: "var(--forest)" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--forest-deep)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}
                        />
                        <span className="pointer-events-none absolute bottom-full mb-1.5 hidden group-hover:block whitespace-nowrap text-white text-[10px] px-2 py-1 rounded-[6px]" style={{ background: "#13201b" }}>
                          {day.date}: {day.count} analyses
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-3">
                  <span className="text-[10px]" style={{ color: "#8aaa9a" }}>{data.time_series[0]?.date}</span>
                  <span className="text-[10px]" style={{ color: "#8aaa9a" }}>{data.time_series[data.time_series.length - 1]?.date}</span>
                </div>
              </div>
            )}

            {data.top_roles.length > 0 && (
              <div className="rounded-[16px] p-6" style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 12px 24px -18px rgba(19,32,27,0.25)" }}>
                <h2 className="text-sm font-semibold mb-5" style={{ color: "#13201b" }}>Most screened roles</h2>
                <div className="space-y-3.5">
                  {data.top_roles.map((role, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="text-[10px] font-bold w-5 h-5 rounded-full shrink-0 flex items-center justify-center"
                          style={{ background: i === 0 ? "var(--mint)" : "var(--mist)", color: i === 0 ? "var(--forest)" : "#8aaa9a" }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm font-medium truncate" style={{ color: "#13201b" }}>{role.title}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-[11px]" style={{ color: "#8aaa9a" }}>{role.count} CVs</span>
                        <span
                          className="text-sm font-semibold"
                          style={{ fontFamily: "var(--font-mono)", color: role.avg >= 70 ? "var(--forest)" : role.avg >= 50 ? "#b45309" : "#dc2626" }}
                        >
                          avg {role.avg}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}