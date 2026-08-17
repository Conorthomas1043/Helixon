"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getMockData, STAGES, STAGE_LABELS } from "@/lib/mock-data";

async function fetchDashboardData() {
  return new Promise((resolve) => setTimeout(() => resolve(getMockData()), 200));
}

function scoreColor(score) {
  if (score === null || score === undefined) return "#8aaa9a";
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return "#c9922e";
  return "#c0392b";
}

const VISIBLE_STAGES = STAGES.filter((s) => s !== "rejected");

export default function PipelinePage() {
  const [data, setData] = useState(null);
  const [jobFilter, setJobFilter] = useState("all");
  const [recruiterFilter, setRecruiterFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData().then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.recentAnalyses.filter((a) => a.status === "completed" &&
      (jobFilter === "all" || a.job.id === jobFilter) &&
      (recruiterFilter === "all" || a.recruiterId === recruiterFilter));
  }, [data, jobFilter, recruiterFilter]);

  const byStage = useMemo(() => {
    const map = {};
    VISIBLE_STAGES.forEach((s) => { map[s] = []; });
    filtered.forEach((a) => { if (map[a.stage]) map[a.stage].push(a); });
    return map;
  }, [filtered]);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav email={data?.email} />

      <section className="max-w-[1400px] mx-auto px-6 pt-10 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Pipeline</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              Every candidate, by stage
            </h1>
          </div>
          <div className="flex gap-2">
            <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="text-xs px-3 py-2.5 rounded-[10px]" style={{ border: "1px solid var(--border)", background: "white", color: "#13201b" }}>
              <option value="all">All jobs</option>
              {data?.jobs.map((j) => <option key={j.id} value={j.id}>{j.title} — {j.company}</option>)}
            </select>
            <select value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)} className="text-xs px-3 py-2.5 rounded-[10px]" style={{ border: "1px solid var(--border)", background: "white", color: "#13201b" }}>
              <option value="all">All recruiters</option>
              {data?.recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </div>
      </section>

      {!data ? (
        <div className="max-w-[1400px] mx-auto px-6"><p className="text-xs" style={{ color: "#5a7a6a" }}>Loading…</p></div>
      ) : (
        <section className="max-w-[1400px] mx-auto px-6 pb-24 overflow-x-auto">
          <div className="flex gap-4 min-w-[1200px]">
            {VISIBLE_STAGES.map((stage) => (
              <div key={stage} className="flex-1 min-w-[220px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-semibold" style={{ color: "#13201b" }}>{STAGE_LABELS[stage]}</h3>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>{byStage[stage].length}</span>
                </div>
                <div className="space-y-2">
                  {byStage[stage].map((a) => (
                    <Link key={a.id} href={`/analyse/${a.id}`} className="block rounded-[12px] p-3" style={{ background: "white", border: "1px solid var(--border)" }}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-[11px] font-semibold truncate" style={{ color: "#13201b" }}>{a.candidate.name}</p>
                        <span className="text-xs font-semibold shrink-0" style={{ fontFamily: "var(--font-mono)", color: scoreColor(a.score) }}>{a.score}</span>
                      </div>
                      <p className="text-[10px] truncate" style={{ color: "#8aaa9a" }}>{a.job.title} @ {a.job.company}</p>
                      <p className="text-[10px] mt-1" style={{ color: "#5a7a6a" }}>{a.recruiterName} · {a.timeInStageDays}d in stage</p>
                    </Link>
                  ))}
                  {byStage[stage].length === 0 && (
                    <div className="rounded-[12px] p-4 text-center" style={{ border: "1px dashed var(--border)" }}>
                      <p className="text-[10px]" style={{ color: "#8aaa9a" }}>Empty</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
