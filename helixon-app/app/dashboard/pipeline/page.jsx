"use client";

/* ------------------------------------------------------------------------
 * /dashboard/pipeline - kanban board of every completed candidate by stage.
 *
 * - Loads EVERY matching candidate (getPipelineCandidates pages through the
 *   API, 200 at a time). It used to request pageSize: 500 and silently show
 *   only the top 50 by score.
 * - Moves are optimistic: the card jumps immediately, and snaps back with a
 *   visible error if the server refuses. Previously each move reloaded the
 *   whole board (skeleton flash, lost scroll) and failures were swallowed.
 * - Cards can be dragged between columns on desktop, or moved with the
 *   arrow buttons (keyboard/touch). Dropping on "Rejected" rejects; the
 *   arrows only walk the funnel.
 * - "?stage=Shortlisted" (from the dashboard's funnel bars) highlights and
 *   scrolls to that column. Reads useSearchParams(), so the content sits in
 *   a <Suspense> boundary as Next.js requires.
 * ---------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { subStageLabel, useCustomisation } from "@/components/dashboard/custom-fields";
import { getPipelineCandidates, getJobs, getRecruiters, updateCandidateStage } from "@/lib/dashboard-api";
import { STAGE_LABELS, FUNNEL_ORDER, STAGE_COLORS as STAGE_ACCENT } from "@/lib/stage-labels";
import { INK, INK_MUTED, INK_FAINT, CARD, scoreColor, formatRelativeTime } from "@/lib/candidate-format";

const BOARD_STAGES = [...FUNNEL_ORDER, "Rejected"];

function scoreBg(score) {
  if (score === null || score === undefined) return "var(--mist)";
  if (score >= 80) return "var(--mint)";
  if (score >= 60) return "#fff8e6";
  return "#fef2f2";
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

function PipelineCard({ candidate, subStage, onMove, pending }) {
  const stageIdx = FUNNEL_ORDER.indexOf(candidate.stage);
  const canGoBack = stageIdx > 0;
  const canGoForward = stageIdx >= 0 && stageIdx < FUNNEL_ORDER.length - 1;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", candidate.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group rounded-[12px] p-3 bg-white cursor-grab active:cursor-grabbing transition-shadow hover:shadow-[var(--shadow-sm)]"
      style={{ border: "1px solid var(--border)", opacity: pending ? 0.6 : 1 }}
    >
      <Link
        href={`/dashboard/candidates/${candidate.id}`}
        className="flex items-start gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
        draggable={false}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold truncate leading-tight" style={{ color: INK }}>
            {candidate.fullName}
          </p>
          <p className="text-[11px] truncate mt-0.5" style={{ color: INK_MUTED }}>
            {candidate.jobTitle}
          </p>
          {subStage && (
            <span className="inline-block text-[11px] font-semibold mt-1 px-1.5 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_MUTED }}>
              {subStage}
            </span>
          )}
        </div>
        <span
          className="text-[12px] font-semibold tabular-nums shrink-0 px-1.5 py-0.5 rounded-md"
          style={{ fontFamily: "var(--font-mono)", color: scoreColor(candidate.score), background: scoreBg(candidate.score) }}
          aria-label={candidate.score == null ? "No score" : `Score ${candidate.score}`}
        >
          {candidate.score ?? "–"}
        </span>
      </Link>
      <div className="flex items-center justify-between mt-2.5 gap-2">
        <span className="text-[11px] truncate" style={{ color: INK_FAINT }}>
          {candidate.recruiterName ?? "Unassigned"}
          {candidate.lastActivityAt || candidate.createdAt ? ` · ${formatRelativeTime(candidate.lastActivityAt || candidate.createdAt)}` : ""}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Any stage, Rejected included - the arrows only walk the funnel,
              so without this a card could only be rejected (or brought back
              from Rejected) by dragging, which touch and keyboard can't do. */}
          <label className="relative w-6 h-6 rounded-full flex items-center justify-center hover:bg-[var(--mist)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2" title="Move to…">
            <span className="sr-only">Move {candidate.fullName} to</span>
            <span aria-hidden="true" className="text-[13px] leading-none" style={{ color: INK_MUTED }}>⋯</span>
            <select
              value=""
              disabled={pending}
              onChange={(e) => e.target.value && onMove(candidate.id, e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
            >
              <option value="">Move to…</option>
              {BOARD_STAGES.filter((s) => s !== candidate.stage).map((s) => (
                <option key={s} value={s}>
                  {s === "Rejected" ? "Reject" : STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!canGoBack || pending}
            onClick={() => onMove(candidate.id, FUNNEL_ORDER[stageIdx - 1])}
            aria-label={`Move ${candidate.fullName} back to ${FUNNEL_ORDER[stageIdx - 1] ?? "previous stage"}`}
            className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] disabled:opacity-25 hover:bg-[var(--mist)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: INK_MUTED }}
          >
            ←
          </button>
          <button
            type="button"
            disabled={!canGoForward || pending}
            onClick={() => onMove(candidate.id, FUNNEL_ORDER[stageIdx + 1])}
            aria-label={`Move ${candidate.fullName} forward to ${FUNNEL_ORDER[stageIdx + 1] ?? "next stage"}`}
            className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] disabled:opacity-25 hover:bg-[var(--mint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
  return <div className={`shimmer-block rounded-[10px] ${className}`} />;
}

function PipelineSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label="Loading pipeline">
      {BOARD_STAGES.map((s) => (
        <div key={s} className="rounded-[14px] p-3 w-[264px] shrink-0 lg:flex-1 lg:w-auto lg:min-w-0" style={CARD}>
          <Block className="h-4 w-20 mb-3" />
          <Block className="h-[74px] w-full mb-2" />
          <Block className="h-[74px] w-full" />
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

// Stacked bar of the whole funnel - each segment's width is its share of
// active (non-rejected) candidates.
function FunnelStrip({ byStage }) {
  const active = FUNNEL_ORDER.reduce((n, s) => n + byStage[s].length, 0);
  if (active === 0) return null;
  return (
    <div className="rounded-[14px] p-4" style={CARD}>
      <div className="flex h-2.5 rounded-full overflow-hidden" style={{ background: "var(--mist)" }} role="img" aria-label="Share of active candidates in each stage">
        {FUNNEL_ORDER.map((s) =>
          byStage[s].length ? (
            <div key={s} style={{ width: `${(byStage[s].length / active) * 100}%`, background: STAGE_ACCENT[s], transition: "width .4s cubic-bezier(0.16,1,0.3,1)" }} />
          ) : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
        {BOARD_STAGES.map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-[11px]" style={{ color: INK_MUTED }}>
            <span className="w-2 h-2 rounded-full" style={{ background: STAGE_ACCENT[s] }} />
            {STAGE_LABELS[s]} <b className="tabular-nums" style={{ color: INK }}>{byStage[s].length}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function PipelineContent() {
  const searchParams = useSearchParams();
  const customisation = useCustomisation();
  const rawStage = searchParams?.get("stage") || "";
  // Accept "shortlisted" as well as "Shortlisted" in the deep link.
  const highlightStage = BOARD_STAGES.find((s) => s.toLowerCase() === rawStage.toLowerCase()) || null;

  const [jobId, setJobId] = useState("all");
  const [recruiterId, setRecruiterId] = useState("all");
  const [search, setSearch] = useState("");
  const [hideRejected, setHideRejected] = useState(false);
  const [candidates, setCandidates] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [moveError, setMoveError] = useState("");
  const [dragOver, setDragOver] = useState(null);

  const [jobs, setJobs] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const columnRefs = useRef({});

  useEffect(() => {
    Promise.all([getJobs(), getRecruiters()])
      .then(([j, r]) => {
        setJobs(j);
        setRecruiters(r);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPipelineCandidates({ jobId, recruiterId, status: "completed", sortBy: "score_desc" })
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

  // Bring the deep-linked column into view once the board has rendered.
  useEffect(() => {
    if (status !== "ready" || !highlightStage) return;
    columnRefs.current[highlightStage]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [status, highlightStage]);

  const retry = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);

  const handleMove = useCallback(
    (id, newStage) => {
      const current = candidates?.find((c) => c.id === id);
      if (!current || !newStage || current.stage === newStage) return;
      const previousStage = current.stage;
      setMoveError("");
      setCandidates((list) => list.map((c) => (c.id === id ? { ...c, stage: newStage } : c)));
      setPendingIds((s) => new Set(s).add(id));
      updateCandidateStage(id, newStage)
        .catch((err) => {
          setCandidates((list) => list.map((c) => (c.id === id ? { ...c, stage: previousStage } : c)));
          setMoveError(`Couldn't move ${current.fullName} to ${STAGE_LABELS[newStage]}: ${err.message || "please try again"}.`);
        })
        .finally(() =>
          setPendingIds((s) => {
            const next = new Set(s);
            next.delete(id);
            return next;
          })
        );
    },
    [candidates]
  );

  const byStage = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = {};
    BOARD_STAGES.forEach((k) => (map[k] = []));
    (candidates ?? []).forEach((c) => {
      if (q && !`${c.fullName} ${c.jobTitle} ${c.company ?? ""} ${c.recruiterName ?? ""} ${c.currentTitle ?? ""} ${c.currentCompany ?? ""}`.toLowerCase().includes(q)) return;
      if (map[c.stage]) map[c.stage].push(c);
    });
    return map;
  }, [candidates, search]);

  const columns = hideRejected ? FUNNEL_ORDER : BOARD_STAGES;
  const total = candidates?.length ?? 0;

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-5">
        <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Candidate pipeline
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Pipeline {status === "ready" && <span className="text-base font-medium tabular-nums" style={{ color: INK_FAINT }}>· {total}</span>}
            </h1>
            <p className="text-[12px] mt-1 hidden lg:block" style={{ color: INK_FAINT }}>
              Drag a card to another column, use the arrows to move it a stage, or ⋯ to move it anywhere (including Rejected).
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap xl:justify-end">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidate or role"
              aria-label="Search pipeline"
              className="text-[12px] px-3 py-1.5 rounded-full bg-white w-full sm:w-52 focus:outline-none focus-visible:ring-2"
              style={{ border: "1px solid var(--border)", color: INK }}
            />
            <Select ariaLabel="Filter by job" value={jobId} onChange={(v) => { setStatus("loading"); setJobId(v); }} options={[{ value: "all", label: "Any job" }, ...jobs.map((j) => ({ value: j.id, label: j.title }))]} />
            <Select
              ariaLabel="Filter by recruiter"
              value={recruiterId}
              onChange={(v) => { setStatus("loading"); setRecruiterId(v); }}
              options={[{ value: "all", label: "Any recruiter" }, ...recruiters.map((r) => ({ value: r.id, label: r.name }))]}
            />
            <label className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white cursor-pointer" style={{ border: "1px solid var(--border)", color: INK_MUTED }}>
              <input type="checkbox" checked={hideRejected} onChange={(e) => setHideRejected(e.target.checked)} className="accent-[var(--forest)]" />
              Hide rejected
            </label>
            <Link
              href="/analyse"
              className="inline-flex items-center text-[12px] font-semibold px-3.5 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "var(--forest)", color: "white" }}
            >
              + New analysis
            </Link>
          </div>
        </header>

        {moveError && (
          <div role="alert" className="rounded-[12px] px-4 py-2.5 text-[13px] flex items-center justify-between gap-3" style={{ background: "#fdf1f0", color: "#c0392b", border: "1px solid #f4d4d2" }}>
            {moveError}
            <button type="button" onClick={() => setMoveError("")} aria-label="Dismiss" className="font-semibold">×</button>
          </div>
        )}

        {status === "loading" && <PipelineSkeleton />}
        {status === "error" && <ErrorState onRetry={retry} />}
        {status === "ready" && candidates && (
          <>
            <FunnelStrip byStage={byStage} />
            {total === 0 ? (
              <div className="rounded-[16px] p-10 text-center" style={CARD}>
                <p className="text-base font-semibold mb-1" style={{ color: INK }}>No candidates yet</p>
                <p className="text-sm mb-5" style={{ color: INK_MUTED }}>Analyse a CV and the candidate will land in Screened.</p>
                <Link href="/analyse" className="inline-flex text-[13px] font-semibold px-4 py-2.5 rounded-full" style={{ background: "var(--forest)", color: "white" }}>
                  Analyse a CV
                </Link>
              </div>
            ) : (
              <div className="flex gap-3 items-start overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
                {columns.map((key) => {
                  const items = byStage[key];
                  const scored = items.filter((c) => c.score != null);
                  const avg = scored.length ? Math.round(scored.reduce((n, c) => n + c.score, 0) / scored.length) : null;
                  const highlighted = key === highlightStage;
                  const over = dragOver === key;
                  return (
                    <section
                      key={key}
                      ref={(el) => (columnRefs.current[key] = el)}
                      aria-label={`${STAGE_LABELS[key]} - ${items.length} candidates`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOver !== key) setDragOver(key);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOver(null);
                        handleMove(e.dataTransfer.getData("text/plain"), key);
                      }}
                      className="rounded-[14px] p-2.5 w-[264px] shrink-0 snap-start lg:flex-1 lg:w-auto lg:min-w-0 transition-colors"
                      style={{
                        background: over ? "var(--mint)" : "rgba(255,255,255,0.6)",
                        border: highlighted || over ? "1.5px solid var(--forest)" : "1px solid var(--border)",
                        borderTop: `3px solid ${STAGE_ACCENT[key]}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-2.5 px-1.5 pt-0.5">
                        <span className="text-[12px] font-semibold" style={{ color: highlighted ? "var(--forest)" : INK }}>
                          {STAGE_LABELS[key]}
                          <span className="ml-1.5 tabular-nums font-medium" style={{ color: INK_FAINT }}>{items.length}</span>
                        </span>
                        {avg !== null && (
                          <span className="text-[11px] tabular-nums" style={{ color: INK_FAINT }} title="Average match score">
                            avg <b style={{ color: scoreColor(avg) }}>{avg}</b>
                          </span>
                        )}
                      </div>
                      <div className="space-y-2 min-h-[64px] max-h-[70vh] overflow-y-auto">
                        {items.length === 0 ? (
                          <p className="text-[11px] text-center py-6 rounded-[10px]" style={{ color: INK_FAINT, border: "1px dashed var(--border)" }}>
                            {over ? "Drop here" : "No candidates"}
                          </p>
                        ) : (
                          items.map((c) => (
                            <PipelineCard key={c.id} candidate={c} subStage={subStageLabel(customisation, c.stage, c.subStage)} onMove={handleMove} pending={pendingIds.has(c.id)} />
                          ))
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function PipelineFallback() {
  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        <PipelineSkeleton />
      </div>
    </main>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<PipelineFallback />}>
      <PipelineContent />
    </Suspense>
  );
}
