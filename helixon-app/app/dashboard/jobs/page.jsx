"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getMockData } from "@/lib/mock-data";

async function fetchDashboardData() {
  return new Promise((resolve) => setTimeout(() => resolve(getMockData()), 200));
}

function scoreColor(score) {
  if (score === null || score === undefined) return "#8aaa9a";
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return "#c9922e";
  return "#c0392b";
}

export default function JobsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData().then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []);

  const jobStats = useMemo(() => {
    if (!data) return [];
    return data.jobs.map((job) => {
      const items = data.recentAnalyses.filter((a) => a.job.id === job.id);
      const completed = items.filter((a) => a.status === "completed");
      const placed = items.filter((a) => a.stage === "placed");
      const avgScore = completed.length ? Math.round(completed.reduce((s, a) => s + a.score, 0) / completed.length) : 0;
      const topCandidate = [...completed].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      return { ...job, applicants: items.length, placed: placed.length, avgScore, topCandidate };
    });
  }, [data]);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav email={data?.email} />

      <section className="max-w-[1200px] mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Job specs</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              Roles you're recruiting for
            </h1>
          </div>
          <button className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-3 rounded-[10px] text-white shrink-0" style={{ background: "var(--forest)" }}>
            + Add job spec
          </button>
        </div>
      </section>

      {!data ? (
        <div className="max-w-[1200px] mx-auto px-6"><p className="text-xs" style={{ color: "#5a7a6a" }}>Loading…</p></div>
      ) : (
        <section className="max-w-[1200px] mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {jobStats.map((job) => (
              <div key={job.id} className="rounded-[16px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#13201b" }}>{job.title}</p>
                    <p className="text-[11px]" style={{ color: "#5a7a6a" }}>{job.company} · {job.seniority} · {job.location}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-[10px] p-2.5 text-center" style={{ background: "var(--mist)" }}>
                    <p className="text-base font-semibold" style={{ fontFamily: "var(--font-mono)", color: "#13201b" }}>{job.applicants}</p>
                    <p className="text-[9px]" style={{ color: "#8aaa9a" }}>Applicants</p>
                  </div>
                  <div className="rounded-[10px] p-2.5 text-center" style={{ background: "var(--mist)" }}>
                    <p className="text-base font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--forest)" }}>{job.placed}</p>
                    <p className="text-[9px]" style={{ color: "#8aaa9a" }}>Placed</p>
                  </div>
                  <div className="rounded-[10px] p-2.5 text-center" style={{ background: "var(--mist)" }}>
                    <p className="text-base font-semibold" style={{ fontFamily: "var(--font-mono)", color: scoreColor(job.avgScore) }}>{job.avgScore || "—"}</p>
                    <p className="text-[9px]" style={{ color: "#8aaa9a" }}>Avg score</p>
                  </div>
                </div>
                {job.topCandidate && (
                  <Link href={`/analyse/${job.topCandidate.id}`} className="flex items-center justify-between text-[11px] px-3 py-2 rounded-[8px]" style={{ background: "var(--mint)" }}>
                    <span style={{ color: "var(--forest)" }}>Top match: {job.topCandidate.candidate.name}</span>
                    <span className="font-semibold" style={{ color: "var(--forest)", fontFamily: "var(--font-mono)" }}>{job.topCandidate.score}</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
