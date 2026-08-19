"use client";

/* ------------------------------------------------------------------------
 * ASSUMPTIONS
 * ------------------------------------------------------------------------
 * - Route: /dashboard/jobs. The existing dashboard's "All jobs →" link and
 *   DashboardNav's "Jobs" tab both already point here — if a real
 *   /dashboard/jobs page already exists in this project, treat this file
 *   as a reference implementation to reconcile against rather than a
 *   blind overwrite; it wasn't possible to check from this conversation.
 * - Jobs are real entities in lib/mock-data.js now (not derived from
 *   candidates), so requirements/status have somewhere honest to live.
 *   getJobs() aggregates live candidate counts per job on every call.
 * ---------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getJobs } from "@/lib/mock-data";
import { INK, INK_MUTED, INK_FAINT, GREEN_BG, CARD } from "@/lib/candidate-format";

async function fetchJobs() {
  try {
    return await new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(getJobs());
        } catch (err) {
          reject(err);
        }
      }, 200);
    });
  } catch (err) {
    throw new Error("Failed to load jobs");
  }
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <p className="text-base font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: accent ?? INK }}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: INK_FAINT }}>
        {label}
      </p>
    </div>
  );
}

function Chip({ children }) {
  return (
    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_MUTED }}>
      {children}
    </span>
  );
}

function JobCard({ job }) {
  return (
    <Link
      href={`/dashboard/jobs/${job.id}`}
      className="block rounded-[14px] p-5 transition-colors hover:bg-[var(--mist)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={CARD}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: INK }}>
            {job.title}
          </p>
          <p className="text-[12px] truncate" style={{ color: INK_MUTED }}>
            {job.company} · {job.location}
          </p>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: job.status === "open" ? GREEN_BG : "var(--mist)", color: job.status === "open" ? "var(--forest)" : INK_MUTED }}
        >
          {job.status === "open" ? "Open" : "Closed"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <Chip>{job.seniority}</Chip>
        <Chip>{job.employmentType}</Chip>
        <Chip>{job.salaryRange}</Chip>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center pt-3" style={{ borderTop: "1px solid var(--border)" }}>
        <Stat label="Candidates" value={job.candidateCount} />
        <Stat label="Strong" value={job.strongMatches} accent="var(--forest)" />
        <Stat label="Interview" value={job.interviewing} />
        <Stat label="Placed" value={job.placed} accent="var(--forest)" />
      </div>
    </Link>
  );
}

function Block({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

function JobsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true" aria-label="Loading jobs">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-[14px] p-5" style={CARD}>
          <Block className="h-4 w-32 mb-2" />
          <Block className="h-3 w-40 mb-4" />
          <Block className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="rounded-[16px] p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1" style={{ color: INK }}>
        Unable to load jobs
      </p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: INK_MUTED }}>
        Something went wrong while loading your open roles.
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

function EmptyState() {
  return (
    <div className="rounded-[16px] flex flex-col items-center text-center py-14 px-6" style={CARD}>
      <p className="text-sm font-semibold mb-1" style={{ color: INK }}>
        No jobs yet
      </p>
      <p className="text-[13px] max-w-sm" style={{ color: INK_MUTED }}>
        Jobs will appear here once roles are added to Helixon.
      </p>
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchJobs()
      .then((j) => {
        if (cancelled) return;
        setJobs(j);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const totalOpen = jobs?.filter((j) => j.status === "open").length ?? 0;
  const totalCandidates = jobs?.reduce((sum, j) => sum + j.candidateCount, 0) ?? 0;

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Job workspace
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Jobs
            </h1>
            {status === "ready" && (
              <p className="text-[13px] mt-1" style={{ color: INK_MUTED }}>
                {totalOpen} open role{totalOpen === 1 ? "" : "s"} · {totalCandidates} candidates in play
              </p>
            )}
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 self-start"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            ← Dashboard
          </Link>
        </header>

        {status === "loading" && <JobsSkeleton />}
        {status === "error" && <ErrorState onRetry={retry} />}
        {status === "ready" && jobs && jobs.length === 0 && <EmptyState />}
        {status === "ready" && jobs && jobs.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
