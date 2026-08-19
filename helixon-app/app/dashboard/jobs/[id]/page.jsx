"use client";

/* ------------------------------------------------------------------------
 * ASSUMPTIONS
 * ------------------------------------------------------------------------
 * - Route: /dashboard/jobs/[id]. `params` read synchronously — see the
 *   candidate profile page's header comment for the Next.js 15 note.
 * - Candidate ranking reuses getJobCandidates(jobId) from lib/mock-data.js
 *   (already sorted by score, descending).
 * ---------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getJobById, getJobCandidates, STAGE_LABELS } from "@/lib/mock-data";
import { INK, INK_MUTED, INK_FAINT, GREEN_BG, CARD, scoreColor, scoreLabel, initials } from "@/lib/candidate-format";

async function fetchJob(id) {
  try {
    return await new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          const job = getJobById(id);
          resolve(job ? { job, candidates: getJobCandidates(id) } : null);
        } catch (err) {
          reject(err);
        }
      }, 200);
    });
  } catch (err) {
    throw new Error("Failed to load job");
  }
}

function FieldLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>
      {children}
    </p>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-[10px] p-3 text-center" style={{ background: "var(--mist)" }}>
      <p className="text-lg font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: accent ?? INK }}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color: INK_FAINT }}>
        {label}
      </p>
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-[11px] font-semibold"
      style={{ background: "var(--mist)", color: "var(--forest)" }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

function StageBadge({ stage, status }) {
  if (status !== "completed") {
    return (
      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_FAINT }}>
        {status === "failed" ? "Failed" : "Processing"}
      </span>
    );
  }
  if (!stage || !STAGE_LABELS[stage]) return null;
  const isPlaced = stage === "placed";
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: isPlaced ? GREEN_BG : "var(--mist)", color: isPlaced ? "var(--forest)" : INK_MUTED }}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

function RankedCandidateRow({ candidate, rank }) {
  return (
    <li>
      <Link
        href={`/dashboard/candidates/${candidate.id}`}
        className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-[10px] transition-colors hover:bg-[var(--mist)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="w-5 text-[12px] tabular-nums text-right shrink-0" style={{ fontFamily: "var(--font-mono)", color: INK_FAINT }}>
          {rank}
        </span>
        <Avatar name={candidate.fullName} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: INK }}>
            {candidate.fullName}
          </p>
          <p className="text-[12px] truncate" style={{ color: INK_MUTED }}>
            {candidate.recruiterName ?? "Unassigned"}
          </p>
        </div>
        <div className="hidden sm:block shrink-0">
          <StageBadge stage={candidate.stage} status={candidate.status} />
        </div>
        <div className="text-right shrink-0 w-10">
          <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: scoreColor(candidate.score) }}>
            {candidate.score ?? "—"}
          </span>
        </div>
      </Link>
    </li>
  );
}

function Block({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

function JobDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading job">
      <div className="rounded-[16px] p-8" style={CARD}>
        <Block className="h-4 w-32 mb-4" />
        <Block className="h-6 w-64 mb-2" />
        <Block className="h-4 w-40" />
      </div>
      <div className="rounded-[14px] p-6" style={CARD}>
        <Block className="h-4 w-40 mb-4" />
        <Block className="h-24 w-full" />
      </div>
    </div>
  );
}

function StateMessage({ title, body, onRetry }) {
  return (
    <div className="rounded-[16px] p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1" style={{ color: INK }}>
        {title}
      </p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: INK_MUTED }}>
        {body}
      </p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--forest)", color: "white" }}
          >
            Try again
          </button>
        )}
        <Link
          href="/dashboard/jobs"
          className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Back to jobs
        </Link>
      </div>
    </div>
  );
}

export default function JobDetailPage({ params }) {
  const { id } = params;
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [stageFilter, setStageFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchJob(id)
      .then((d) => {
        if (cancelled) return;
        if (!d) {
          setStatus("not-found");
          return;
        }
        setData(d);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const job = data?.job;
  const candidates = data?.candidates ?? [];
  const filteredCandidates = stageFilter === "all" ? candidates : candidates.filter((c) => c.stage === stageFilter);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        {status === "loading" && <JobDetailSkeleton />}
        {status === "error" && <StateMessage title="Unable to load job" body="Something went wrong while loading this role." onRetry={retry} />}
        {status === "not-found" && <StateMessage title="Job not found" body="This role may have been removed, or the link is out of date." />}

        {status === "ready" && job && (
          <>
            <div className="flex items-center justify-between">
              <Link href="/dashboard/jobs" className="text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded" style={{ color: "var(--forest)" }}>
                ← All jobs
              </Link>
              <Link
                href={`/dashboard/candidates?jobId=${job.id}`}
                className="text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
                style={{ color: "var(--forest)" }}
              >
                Open in candidate database →
              </Link>
            </div>

            <header className="rounded-[16px] p-6 sm:p-8" style={CARD}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold leading-tight" style={{ fontFamily: "var(--font-display)", color: INK }}>
                    {job.title}
                  </h1>
                  <p className="text-sm mt-1" style={{ color: INK_MUTED }}>
                    {job.company} · {job.location}
                  </p>
                </div>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: job.status === "open" ? GREEN_BG : "var(--mist)", color: job.status === "open" ? "var(--forest)" : INK_MUTED }}
                >
                  {job.status === "open" ? "Open" : "Closed"}
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
                <Stat label="Candidates" value={job.candidateCount} />
                <Stat label="Strong" value={job.strongMatches} accent="var(--forest)" />
                <Stat label="Shortlisted" value={job.shortlisted} />
                <Stat label="Interview" value={job.interviewing} />
                <Stat label="Offer" value={job.offers} />
                <Stat label="Placed" value={job.placed} accent="var(--forest)" />
              </div>

              <div className="grid sm:grid-cols-2 gap-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
                <div>
                  <FieldLabel>Role details</FieldLabel>
                  <ul className="text-[13px] space-y-1" style={{ color: INK }}>
                    <li>{job.seniority} · {job.employmentType}</li>
                    <li>{job.salaryRange}</li>
                    <li>{job.minYearsExperience}+ years' experience</li>
                  </ul>
                </div>
                <div>
                  <FieldLabel>Required skills</FieldLabel>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {job.requiredSkills.map((s) => (
                      <span key={s} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_MUTED }}>
                        {s}
                      </span>
                    ))}
                  </div>
                  {job.preferredSkills.length > 0 && (
                    <>
                      <FieldLabel>Preferred skills</FieldLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {job.preferredSkills.map((s) => (
                          <span key={s} className="text-[11px] px-2 py-0.5 rounded-full" style={{ border: "1px dashed var(--border)", color: INK_MUTED }}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </header>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
                  Candidates ranked by fit
                </h2>
                <select
                  aria-label="Filter by stage"
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ border: "1px solid var(--border)", color: INK }}
                >
                  <option value="all">All stages</option>
                  {Object.entries(STAGE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {filteredCandidates.length === 0 ? (
                <p className="text-[13px] py-6 text-center" style={{ color: INK_MUTED }}>
                  No candidates match this filter yet.
                </p>
              ) : (
                <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {filteredCandidates.map((c, i) => (
                    <RankedCandidateRow key={c.id} candidate={c} rank={i + 1} />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

