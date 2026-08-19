"use client";

/* ------------------------------------------------------------------------
 * ASSUMPTIONS
 * ------------------------------------------------------------------------
 * - Route: /dashboard/team. Not previously linked from DashboardNav — a
 *   "Team" tab was added there so this page is reachable; drop that tab if
 *   this project already has a different team/settings surface.
 * - "Recruiter" here means anyone in RECRUITERS in lib/mock-data.js,
 *   without a distinct permissions/role system — see that file's
 *   `role: "manager" | "recruiter"` field, which isn't used for access
 *   control anywhere yet (per the brief: don't build permissions gating
 *   that doesn't have a real auth model to hang off).
 * - "Overdue" mirrors the same rule used on the candidate profile page:
 *   nextAction.dueAt in the past and not completed.
 * ---------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getRecruiters } from "@/lib/mock-data";
import { INK, INK_MUTED, INK_FAINT, RED_STRONG, RED_BG, CARD, initials } from "@/lib/candidate-format";

async function fetchRecruiters() {
  try {
    return await new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(getRecruiters());
        } catch (err) {
          reject(err);
        }
      }, 200);
    });
  } catch (err) {
    throw new Error("Failed to load team");
  }
}

function Avatar({ name }) {
  return (
    <div
      className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-[13px] font-semibold"
      style={{ background: "var(--mist)", color: "var(--forest)" }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

function Metric({ label, value, accent }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: accent ?? INK }}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide" style={{ color: INK_FAINT }}>
        {label}
      </p>
    </div>
  );
}

function RecruiterCard({ recruiter }) {
  return (
    <div className="rounded-[14px] p-5" style={CARD}>
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={recruiter.name} />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: INK }}>
            {recruiter.name}
          </p>
          <p className="text-[11px] uppercase tracking-wide" style={{ color: INK_FAINT }}>
            {recruiter.role === "manager" ? "Manager" : "Recruiter"}
          </p>
        </div>
        {recruiter.overdue > 0 && (
          <span
            className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: RED_BG, color: RED_STRONG }}
          >
            {recruiter.overdue} overdue
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <Metric label="Active" value={recruiter.activeCandidates} />
        <Metric label="To review" value={recruiter.awaitingReview} />
        <Metric label="Interview" value={recruiter.interviewing} />
        <Metric label="Placed" value={recruiter.placed} accent="var(--forest)" />
      </div>

      <Link
        href={`/dashboard/candidates?recruiterId=${recruiter.id}`}
        className="inline-flex items-center text-[12px] font-semibold mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
        style={{ color: "var(--forest)" }}
      >
        View {recruiter.name.split(" ")[0]}'s candidates →
      </Link>
    </div>
  );
}

function Block({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

function TeamSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" aria-busy="true" aria-label="Loading team">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-[14px] p-5" style={CARD}>
          <Block className="h-11 w-11 rounded-full mb-4" />
          <Block className="h-14 w-full" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="rounded-[16px] p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1" style={{ color: INK }}>
        Unable to load team
      </p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: INK_MUTED }}>
        Something went wrong while loading recruiter workload.
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

export default function TeamPage() {
  const [recruiters, setRecruiters] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchRecruiters()
      .then((r) => {
        if (cancelled) return;
        setRecruiters(r);
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

  const totalOverdue = recruiters?.reduce((sum, r) => sum + r.overdue, 0) ?? 0;
  const totalActive = recruiters?.reduce((sum, r) => sum + r.activeCandidates, 0) ?? 0;

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Team workspace
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Team
            </h1>
            {status === "ready" && (
              <p className="text-[13px] mt-1" style={{ color: INK_MUTED }}>
                {totalActive} active candidates across the team
                {totalOverdue > 0 ? ` · ${totalOverdue} overdue follow-up${totalOverdue === 1 ? "" : "s"}` : ""}
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

        {status === "loading" && <TeamSkeleton />}
        {status === "error" && <ErrorState onRetry={retry} />}
        {status === "ready" && recruiters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recruiters.map((r) => (
              <RecruiterCard key={r.id} recruiter={r} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

