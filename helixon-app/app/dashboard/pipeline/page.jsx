"use client";

/* ------------------------------------------------------------------------
 * ASSUMPTIONS
 * ------------------------------------------------------------------------
 * - Route: /dashboard/pipeline. Already linked from the existing dashboard
 *   ("View pipeline", "Open pipeline →", per-stage links) and from
 *   DashboardNav — same reconciliation note as the Jobs/Analytics pages if
 *   a real implementation already exists here.
 * - Only candidates with status "completed" have a stage, so this board
 *   only shows those — processing/failed candidates live in the
 *   candidate database's status filter instead.
 * - Move-forward/back buttons call the same updateCandidateStage mock
 *   mutation the candidate profile page uses. No drag-and-drop — button-
 *   based movement is more robust for a first pass and fully keyboard-
 *   accessible without extra work.
 * ---------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { getCandidates, getJobs, getRecruiters, STAGE_LABELS, STAGE_ORDER, updateCandidateStage } from "@/lib/mock-data";
import { INK, INK_MUTED, INK_FAINT, CARD, scoreColor, initials } from "@/lib/candidate-format";

async function fetchPipeline(query) {
  try {
    return await new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(getCandidates(query).items);
        } catch (err) {
          reject(err);
        }
      }, 200);
    });
  } catch (err) {
    throw new Error("Failed to load pipeline");
  }
}

function Select({ value, onChange, options, ariaLabel }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ border: "1px solid var(--border)", color: INK }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function Avatar({ name }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-semibold"
      style={{ background: "white", color: "var(--forest)" }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

function PipelineCard({ candidate, onMove }) {
  const stageIdx = STAGE_ORDER.indexOf(candidate.stage);
  const canGoBack = stageIdx > 0;
  const canGoForward = stageIdx < STAGE_ORDER.length - 1;

  return (
    <div className="rounded-[10px] p-3 bg-white" style={{ border: "1px solid var(--border)" }}>
      <Link
        href={`/dashboard/candidates/${candidate.id}`}
        className="flex items-center gap-2 mb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
      >
        <Avatar name={candidate.fullName} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold truncate" style={{ color: INK }}>
            {candidate.fullName}
          </p>
          <p className="text-[11px] truncate" style={{ color: INK_MUTED }}>
            {candidate.jobTitle}
          </p>
        </div>
        <span className="text-[12px] font-semibold tabular-nums shrink-0" style={{ fontFamily: "var(--font-mono)", color: scoreColor(candidate.score) }}>
          {candidate.score ?? "—"}
        </span>
      </Link>
      <div className="flex items-center justify-between">
        <span className="text-[10px] truncate" style={{ color: INK_FAINT }}>
          {candidate.recruiterName ?? "Unassigned"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => onMove(candidate.id, STAGE_ORDER[stageIdx - 1])}
            aria-label={`Move ${candidate.fullName} back a stage`}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] disabled:opacity-30 hover:bg-[var(--mist)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: INK_MUTED }}
          >
            ←
          </button>
          <button
            type="button"
            disabled={!canGoForward}
            onClick={() => onMove(candidate.id, STAGE_ORDER[stageIdx + 1])}
            aria-label={`Move ${candidate.fullName} forward a stage`}
            className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] disabled:opacity-30 hover:bg-[var(--mist)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: "var(--forest)" }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

function Block({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

function PipelineSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" aria-busy="true" aria-label="Loading pipeline">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[14px] p-3" style={CARD}>
          <Block className="h-4 w-16 mb-3" />
          <Block className="h-20 w-full mb-2" />
          <Block className="h-20 w-full" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="rounded-[16px] p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1" style={{ color: INK }}>
        Unable to load pipeline
      </p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: INK_MUTED }}>
        Something went wrong while loading the candidate pipeline.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--forest)", color: "white" }}
      >
        Try again
      </button>
    </div>
  );
}

export default function PipelinePage() {
  // The dashboard's per-stage pipeline bars link here as
  // "/dashboard/pipeline?stage=shortlisted" etc. — that stage's column
  // gets a highlighted border on arrival so the link actually lands
  // somewhere meaningful rather than just opening the general board.
  const searchParams = useSearchParams();
  const highlightStage = searchParams?.get("stage");

  const [jobId, setJobId] = useState("all");
  const [recruiterId, setRecruiterId] = useState("all");
  const [candidates, setCandidates] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const jobs = useMemo(() => getJobs(), []);
  const recruiters = useMemo(() => getRecruiters(), []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchPipeline({ jobId, recruiterId, status: "completed", sortBy: "score_desc", page: 1, pageSize: 500 })
      .then((items) => {
        if (cancelled) return;
        setCandidates(items);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, recruiterId, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const handleMove = useCallback(
    (id, newStage) => {
      updateCandidateStage(id, newStage, "You");
      retry();
    },
    [retry]
  );

  const byStage = useMemo(() => {
    const map = {};
    STAGE_ORDER.forEach((k) => (map[k] = []));
    (candidates ?? []).forEach((c) => {
      if (map[c.stage]) map[c.stage].push(c);
    });
    return map;
  }, [candidates]);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Candidate pipeline
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Pipeline
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select ariaLabel="Filter by job" value={jobId} onChange={setJobId} options={[{ value: "all", label: "Any job" }, ...jobs.map((j) => ({ value: j.id, label: j.title }))]} />
            <Select
              ariaLabel="Filter by recruiter"
              value={recruiterId}
              onChange={setRecruiterId}
              options={[{ value: "all", label: "Any recruiter" }, ...recruiters.map((r) => ({ value: r.id, label: r.name }))]}
            />
            <Link
              href="/dashboard"
              className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK }}
            >
              ← Dashboard
            </Link>
          </div>
        </header>

        {status === "loading" && <PipelineSkeleton />}
        {status === "error" && <ErrorState onRetry={retry} />}
        {status === "ready" && candidates && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-start">
            {STAGE_ORDER.map((key) => (
              <div
                key={key}
                className="rounded-[14px] p-3"
                style={key === highlightStage ? { ...CARD, border: "1.5px solid var(--forest)" } : CARD}
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: key === highlightStage ? "var(--forest)" : INK_MUTED }}>
                    {STAGE_LABELS[key]}
                  </span>
                  <span className="text-[11px] tabular-nums font-semibold" style={{ fontFamily: "var(--font-mono)", color: INK_FAINT }}>
                    {byStage[key].length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[40px]">
                  {byStage[key].length === 0 ? (
                    <p className="text-[11px] text-center py-4" style={{ color: INK_FAINT }}>
                      Empty
                    </p>
                  ) : (
                    byStage[key].map((c) => <PipelineCard key={c.id} candidate={c} onMove={handleMove} />)
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
