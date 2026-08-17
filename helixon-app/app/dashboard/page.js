"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getMockData, STAGE_LABELS } from "@/lib/mock-data";

// TODO: replace with `await fetch("/api/agency/me")` once the backend exists.
async function fetchDashboardData() {
  return new Promise((resolve) => setTimeout(() => resolve(getMockData()), 200));
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-[14px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>{label}</p>
      <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: accent || "#13201b" }}>{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: "#5a7a6a" }}>{sub}</p>}
    </div>
  );
}

function scoreColor(score) {
  if (score === null || score === undefined) return "#8aaa9a";
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return "#c9922e";
  return "#c0392b";
}

function statusBadge(status) {
  const map = {
    completed: { bg: "#eef7f1", fg: "var(--forest)", label: "Completed" },
    processing: { bg: "#fff8e6", fg: "#c9922e", label: "Processing" },
    failed: { bg: "#fef2f2", fg: "#b91c1c", label: "Failed" },
  };
  const s = map[status] || map.completed;
  return <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.fg }}>{s.label}</span>;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AgencyDashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData().then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const items = data.recentAnalyses;
    const completed = items.filter((a) => a.status === "completed");
    const placed = items.filter((a) => a.stage === "placed");
    const avgScore = completed.length ? Math.round(completed.reduce((s, a) => s + a.score, 0) / completed.length) : 0;
    const last7 = items.filter((a) => Date.now() - new Date(a.createdAt).getTime() < 7 * 86400000);
    return { total: items.length, placed: placed.length, avgScore, last7: last7.length };
  }, [data]);

  const recent = data?.recentAnalyses.slice(0, 8) ?? [];

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav email={data?.email} />

      <section className="max-w-[1200px] mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>
              {data?.plan === "trial" ? "Free trial" : data?.plan || "\u00A0"}
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              {data ? `Welcome back${data.agencyName ? `, ${data.agencyName}` : ""}` : "Loading your dashboard…"}
            </h1>
          </div>
          <Link href="/analyse" className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-3 rounded-[10px] text-white shrink-0" style={{ background: "var(--forest)", boxShadow: "0 8px 20px -8px rgba(11,110,79,0.5)" }}>
            New analysis
          </Link>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 pb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total analyses" value={data ? stats.total : "—"} sub={data ? `of ${data.analysesLimit} on your plan` : undefined} />
          <StatCard label="Placed" value={data ? stats.placed : "—"} sub="all time" accent="var(--forest)" />
          <StatCard label="Avg match score" value={data ? `${stats.avgScore}` : "—"} accent={data ? scoreColor(stats.avgScore) : undefined} />
          <StatCard label="Last 7 days" value={data ? stats.last7 : "—"} sub="new analyses" />
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/dashboard/pipeline" className="rounded-[14px] p-5 block" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#13201b" }}>Candidate pipeline →</p>
            <p className="text-[11px]" style={{ color: "#5a7a6a" }}>See every candidate by stage, from new to placed.</p>
          </Link>
          <Link href="/dashboard/analytics" className="rounded-[14px] p-5 block" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#13201b" }}>Analytics →</p>
            <p className="text-[11px]" style={{ color: "#5a7a6a" }}>Recruiter performance and candidate quality trends.</p>
          </Link>
          <Link href="/dashboard/jobs" className="rounded-[14px] p-5 block" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#13201b" }}>Job specs →</p>
            <p className="text-[11px]" style={{ color: "#5a7a6a" }}>Manage roles and see applicant volume per job.</p>
          </Link>
        </div>
      </section>

      <section className="max-w-[1200px] mx-auto px-6 pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: "#13201b" }}>Recent analyses</h2>
          <Link href="/dashboard/pipeline" className="text-xs font-semibold" style={{ color: "var(--forest)" }}>View all</Link>
        </div>
        {!data ? (
          <div className="rounded-[16px] p-10 text-center" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "#5a7a6a" }}>Loading…</p>
          </div>
        ) : (
          <div className="rounded-[16px] overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }}>
            {recent.map((a, i) => (
              <Link key={a.id} href={`/analyse/${a.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors" style={{ borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold truncate" style={{ color: "#13201b" }}>{a.candidate.name}</p>
                    {statusBadge(a.status)}
                    <span className="text-[10px]" style={{ color: "#8aaa9a" }}>{STAGE_LABELS[a.stage]}</span>
                  </div>
                  <p className="text-[11px] truncate" style={{ color: "#8aaa9a" }}>vs {a.job.title} @ {a.job.company} · {formatDate(a.createdAt)} · {a.recruiterName}</p>
                </div>
                <span className="text-lg font-semibold shrink-0" style={{ fontFamily: "var(--font-mono)", color: scoreColor(a.score) }}>{a.score ?? "—"}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1200px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
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
