"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { useDashboardData } from "@/lib/DashboardDataContext";
import { STAGES, STAGE_LABELS } from "@/lib/mock-data";
import { downloadCsv } from "@/lib/csv";

// All stages including rejected — nothing hidden from the board anymore.
const VISIBLE_STAGES = STAGES;

function scoreColor(score) {
  if (score === null || score === undefined) return "#8aaa9a";
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return "#c9922e";
  return "#c0392b";
}

export default function PipelinePage() {
  const { data, error } = useDashboardData();
  const [jobFilter, setJobFilter] = useState("all");
  const [recruiterFilter, setRecruiterFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set());
  // In-memory stage overrides for this session — bulk "move" only makes
  // sense against a real backend; this simulates it locally so the UI is
  // testable, and logs what a real PATCH /api/analyses/:id call would send.
  const [stageOverrides, setStageOverrides] = useState({});

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.recentAnalyses
      .filter((a) => a.status === "completed")
      .filter((a) => jobFilter === "all" || a.job.id === jobFilter)
      .filter((a) => recruiterFilter === "all" || a.recruiterId === recruiterFilter)
      .filter((a) => {
        if (!q) return true;
        const haystack = [a.candidate.name, a.job.title, a.job.company, ...(a.candidate.skills || [])].join(" ").toLowerCase();
        return haystack.includes(q);
      })
      .map((a) => ({ ...a, stage: stageOverrides[a.id] || a.stage }));
  }, [data, jobFilter, recruiterFilter, query, stageOverrides]);

  const byStage = useMemo(() => {
    const map = {};
    VISIBLE_STAGES.forEach((s) => { map[s] = []; });
    filtered.forEach((a) => { if (map[a.stage]) map[a.stage].push(a); });
    return map;
  }, [filtered]);

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function bulkMove(targetStage) {
    if (selected.size === 0) return;
    // TODO real backend: PATCH /api/analyses/bulk { ids: [...selected], stage: targetStage }
    setStageOverrides((prev) => {
      const next = { ...prev };
      selected.forEach((id) => { next[id] = targetStage; });
      return next;
    });
    setSelected(new Set());
  }

  function exportCsv() {
    const rows = filtered.map((a) => ({
      candidate: a.candidate.name,
      email: a.candidate.email,
      stage: STAGE_LABELS[a.stage],
      score: a.score ?? "",
      job: a.job.title,
      company: a.job.company,
      recruiter: a.recruiterName,
      createdAt: a.createdAt,
    }));
    downloadCsv("pipeline-export.csv", rows);
  }

  if (error) {
    return (
      <main className="min-h-screen" style={{ background: "var(--mist)" }}>
        <DashboardNav />
        <p className="max-w-[1400px] mx-auto px-6 pt-10 text-xs" style={{ color: "#b91c1c" }}>{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav email={data?.email} />

      <section className="max-w-[1400px] mx-auto px-6 pt-10 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Pipeline</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              Every candidate, by stage
            </h1>
          </div>
          <button onClick={exportCsv} disabled={!data} className="text-xs font-semibold px-4 py-2.5 rounded-[10px]" style={{ border: "1px solid var(--border)", color: "#13201b", background: "white" }}>
            Export CSV
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mb-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search candidate, skill, role, or company…"
            className="flex-1 text-xs px-3 py-2.5 rounded-[10px] outline-none"
            style={{ border: "1px solid var(--border)", color: "#13201b" }}
          />
          <select value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className="text-xs px-3 py-2.5 rounded-[10px]" style={{ border: "1px solid var(--border)", background: "white", color: "#13201b" }}>
            <option value="all">All jobs</option>
            {data?.jobs.map((j) => <option key={j.id} value={j.id}>{j.title} — {j.company}</option>)}
          </select>
          <select value={recruiterFilter} onChange={(e) => setRecruiterFilter(e.target.value)} className="text-xs px-3 py-2.5 rounded-[10px]" style={{ border: "1px solid var(--border)", background: "white", color: "#13201b" }}>
            <option value="all">All recruiters</option>
            {data?.recruiters.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-[10px] mb-2" style={{ background: "var(--mint)" }}>
            <span className="text-[11px] font-semibold" style={{ color: "var(--forest)" }}>{selected.size} selected</span>
            <select
              onChange={(e) => { if (e.target.value) { bulkMove(e.target.value); e.target.value = ""; } }}
              defaultValue=""
              className="text-[11px] px-2 py-1.5 rounded-[8px]"
              style={{ border: "1px solid var(--border)", background: "white" }}
            >
              <option value="" disabled>Move to…</option>
              {VISIBLE_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            <button onClick={() => setSelected(new Set())} className="text-[11px] font-medium" style={{ color: "var(--forest)" }}>Clear</button>
          </div>
        )}
      </section>

      {!data ? (
        <div className="max-w-[1400px] mx-auto px-6"><p className="text-xs" style={{ color: "#5a7a6a" }}>Loading…</p></div>
      ) : filtered.length === 0 ? (
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="rounded-[16px] p-10 text-center" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-xs" style={{ color: "#5a7a6a" }}>No candidates match your search or filters.</p>
          </div>
        </div>
      ) : (
        <section className="max-w-[1400px] mx-auto px-6 pb-24 overflow-x-auto">
          <div className="flex gap-4 min-w-[1400px]">
            {VISIBLE_STAGES.map((stage) => (
              <div key={stage} className="flex-1 min-w-[220px]">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-semibold" style={{ color: stage === "rejected" ? "#b91c1c" : "#13201b" }}>{STAGE_LABELS[stage]}</h3>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: stage === "rejected" ? "#fef2f2" : "var(--mint)", color: stage === "rejected" ? "#b91c1c" : "var(--forest)" }}>{byStage[stage].length}</span>
                </div>
                <div className="space-y-2">
                  {byStage[stage].map((a) => (
                    <div key={a.id} className="rounded-[12px] p-3 relative" style={{ background: "white", border: "1px solid var(--border)" }}>
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          className="mt-0.5"
                          aria-label={`Select ${a.candidate.name}`}
                        />
                        <Link href={`/analyse/${a.id}`} className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-[11px] font-semibold truncate" style={{ color: "#13201b" }}>{a.candidate.name}</p>
                            <span className="text-xs font-semibold shrink-0" style={{ fontFamily: "var(--font-mono)", color: scoreColor(a.score) }}>{a.score}</span>
                          </div>
                          <p className="text-[10px] truncate" style={{ color: "#8aaa9a" }}>{a.job.title} @ {a.job.company}</p>
                          <p className="text-[10px] mt-1" style={{ color: "#5a7a6a" }}>{a.recruiterName} · {a.timeInStageDays}d in stage</p>
                        </Link>
                      </div>
                    </div>
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