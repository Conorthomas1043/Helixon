"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

// ═══════════════════════════════════════════════════════════════════════════
// Agency dashboard — lands here after email verification. Same nav/footer/
// tokens as the landing page, but authenticated (no "Try now" CTA).
//
// NOTE: this is scaffolded with placeholder data + fetch stubs. Swap the
// `fetchDashboardData()` stub for a real API route (e.g. GET /api/agency/me)
// once you have one — it currently returns mock data so the page renders.
// ═══════════════════════════════════════════════════════════════════════════

async function fetchDashboardData() {
  // TODO: replace with a real call, e.g.:
  // const res = await fetch("/api/agency/me");
  // if (!res.ok) throw new Error("Failed to load dashboard");
  // return res.json();
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          agencyName: "Your Agency",
          email: "you@example.com",
          plan: "trial",
          analysesUsed: 0,
          analysesLimit: 3,
          recentAnalyses: [],
        }),
      300
    )
  );
}

function DashboardNav({ email }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
        <Link href="/analyse" className="flex items-center gap-3 group" aria-label="Helixon home">
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
        </Link>

        <div className="hidden md:flex items-center gap-1 text-xs font-medium" style={{ color: "#5a7a6a" }}>
          <Link href="/dashboard" className="px-3 py-1.5 rounded-[8px]" style={{ background: "var(--mint)", color: "var(--forest)", fontWeight: 600 }}>Dashboard</Link>
          <Link href="/analyse" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>New analysis</Link>
          <Link href="/contact" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>Contact</Link>
        </div>

        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-colors"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: "var(--forest)" }}>
              {(email || "?").charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] font-medium hidden sm:block" style={{ color: "#13201b" }}>{email}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-44 rounded-[12px] p-1.5 bg-white" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 24px -12px rgba(19,32,27,0.25)" }}>
              <Link href="/account" className="block text-xs px-3 py-2 rounded-[8px]" style={{ color: "#13201b" }} onClick={() => setMenuOpen(false)}>Account settings</Link>
              <Link href="/billing" className="block text-xs px-3 py-2 rounded-[8px]" style={{ color: "#13201b" }} onClick={() => setMenuOpen(false)}>Billing</Link>
              <a href="/api/auth/logout" className="block text-xs px-3 py-2 rounded-[8px]" style={{ color: "#b91c1c" }}>Log out</a>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-[14px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>{label}</p>
      <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "#13201b" }}>{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: "#5a7a6a" }}>{sub}</p>}
    </div>
  );
}

function EmptyAnalyses() {
  return (
    <div className="rounded-[16px] p-10 text-center" style={{ background: "white", border: "1px dashed var(--border)" }}>
      <div className="w-11 h-11 rounded-[12px] flex items-center justify-center mx-auto mb-4" style={{ background: "var(--mint)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#13201b" }}>No analyses yet</h3>
      <p className="text-xs max-w-xs mx-auto mb-5" style={{ color: "#5a7a6a" }}>
        Upload your first CV against a job spec to see a match score, standout factors, and a ready-to-send email.
      </p>
      <Link
        href="/analyse"
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-[10px] text-white"
        style={{ background: "var(--forest)" }}
      >
        Run your first analysis
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </Link>
    </div>
  );
}

function scoreColor(score) {
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return "#c9922e";
  return "#c0392b";
}

function AnalysesList({ items }) {
  return (
    <div className="rounded-[16px] overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }}>
      {items.map((a, i) => (
        <Link
          key={a.id}
          href={`/analyse/${a.id}`}
          className="flex items-center gap-4 px-5 py-4 transition-colors"
          style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none" }}
        >
          <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "var(--mint)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate" style={{ color: "#13201b" }}>{a.candidateName}</p>
            <p className="text-[11px]" style={{ color: "#8aaa9a" }}>vs {a.role} · {a.createdAt}</p>
          </div>
          <span className="text-lg font-semibold shrink-0" style={{ fontFamily: "var(--font-mono)", color: scoreColor(a.score) }}>{a.score}</span>
        </Link>
      ))}
    </div>
  );
}

export default function AgencyDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData()
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError("Couldn't load your dashboard. Please refresh."); });
    return () => { cancelled = true; };
  }, []);

  const used = data?.analysesUsed ?? 0;
  const limit = data?.analysesLimit ?? 3;
  const remaining = Math.max(limit - used, 0);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav email={data?.email} />

      <section className="max-w-[1100px] mx-auto px-6 pt-12 pb-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>
              {data?.plan === "trial" ? "Free trial" : data?.plan || "\u00A0"}
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              {data ? `Welcome back${data.agencyName ? `, ${data.agencyName}` : ""}` : "Loading your dashboard…"}
            </h1>
          </div>
          <Link
            href="/analyse"
            className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-3 rounded-[10px] text-white shrink-0"
            style={{ background: "var(--forest)", boxShadow: "0 8px 20px -8px rgba(11,110,79,0.5)" }}
          >
            New analysis
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
      </section>

      {error && (
        <section className="max-w-[1100px] mx-auto px-6 pb-4">
          <div role="alert" className="flex items-start gap-2.5 p-3 rounded-[10px]" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
            <p className="text-xs" style={{ color: "#b91c1c" }}>{error}</p>
          </div>
        </section>
      )}

      <section className="max-w-[1100px] mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Analyses used" value={data ? used : "—"} sub={data ? `of ${limit} on your plan` : undefined} />
          <StatCard label="Remaining" value={data ? remaining : "—"} sub={data?.plan === "trial" ? "on your free trial" : undefined} />
          <StatCard label="Plan" value={data ? (data.plan === "trial" ? "Free" : data.plan) : "—"} sub={data?.plan === "trial" ? "Upgrade anytime" : undefined} />
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "#13201b" }}>Recent analyses</h2>
          {data?.recentAnalyses?.length > 0 && (
            <Link href="/analyse/history" className="text-xs font-semibold" style={{ color: "var(--forest)" }}>View all</Link>
          )}
        </div>
        {!data ? (
          <div className="rounded-[16px] p-10 text-center" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "#5a7a6a" }}>Loading…</p>
          </div>
        ) : data.recentAnalyses.length === 0 ? (
          <EmptyAnalyses />
        ) : (
          <AnalysesList items={data.recentAnalyses} />
        )}
      </section>

      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px]" style={{ color: "#8aaa9a" }}>© {new Date().getFullYear()} Helixon. Screen candidates in seconds.</span>
          <div className="flex gap-4 text-[11px]" style={{ color: "#8aaa9a" }}>
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}