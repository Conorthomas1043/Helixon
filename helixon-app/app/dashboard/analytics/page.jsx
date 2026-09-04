"use client";

/* ------------------------------------------------------------------------
 * ASSUMPTIONS
 * ------------------------------------------------------------------------
 * - Route: /dashboard/analytics. DashboardNav already linked here before
 *   any of this work started - if a real analytics page already exists,
 *   treat this as a reference implementation to reconcile, not a
 *   replacement.
 * - Every number here comes from getAnalyticsSnapshot() in
 *   lib/mock-data.js, computed over the current in-memory candidate set -
 *   nothing on this page is a fabricated/static figure. See that
 *   function's comment for the production caveat (server-side
 *   aggregation, not client-side reduction over the full table).
 * - No charting library is used, to match the existing dashboard's
 *   hand-rolled bar/funnel visuals (plain divs) rather than introducing a
 *   new dependency for this pass.
 * ---------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getAnalyticsSnapshot, STAGE_LABELS } from "@/lib/mock-data";
import { INK, INK_MUTED, INK_FAINT, AMBER, RED, GREEN_BG, CARD } from "@/lib/candidate-format";

async function fetchAnalytics() {
  try {
    return await new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(getAnalyticsSnapshot());
        } catch (err) {
          reject(err);
        }
      }, 200);
    });
  } catch (err) {
    throw new Error("Failed to load analytics");
  }
}

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
          {eyebrow}
        </p>
        <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-[14px] p-5" style={CARD}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: INK_FAINT }}>
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: INK }}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] mt-1" style={{ color: INK_MUTED }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function FunnelChart({ funnel }) {
  const max = funnel[0]?.count || 1;
  return (
    <div className="space-y-2.5">
      {funnel.map((stage, i) => {
        const pct = Math.max(4, Math.round((stage.count / max) * 100));
        const prevCount = i > 0 ? funnel[i - 1].count : stage.count;
        const dropOff = i > 0 && prevCount > 0 ? Math.round(((prevCount - stage.count) / prevCount) * 100) : 0;
        return (
          <div key={stage.key} className="flex items-center gap-3">
            <span className="text-[11px] w-20 shrink-0 truncate" style={{ color: INK_MUTED }}>
              {stage.label}
            </span>
            <div className="flex-1 h-6 rounded-[6px] overflow-hidden" style={{ background: "var(--mist)" }}>
              <div
                className="h-full rounded-[6px] flex items-center justify-end px-2"
                style={{ width: `${pct}%`, background: stage.key === "placed" ? "var(--forest)" : "#a9c4b5" }}
              >
                <span className="text-[11px] font-semibold tabular-nums text-white">{stage.count}</span>
              </div>
            </div>
            <span className="text-[10px] w-16 text-right shrink-0" style={{ color: INK_FAINT }}>
              {i > 0 && dropOff > 0 ? `-${dropOff}%` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function QualityDistribution({ quality }) {
  const total = quality.scoredCount || 1;
  const segments = [
    { key: "strong", label: "80+ Strong", count: quality.strong, color: "var(--forest)" },
    { key: "moderate", label: "60–79 Moderate", count: quality.moderate, color: AMBER },
    { key: "weak", label: "Below 60", count: quality.weak, color: RED },
  ];
  return (
    <div>
      <div className="h-3 rounded-full overflow-hidden flex mb-3" style={{ background: "var(--mist)" }}>
        {segments.map((s) =>
          s.count > 0 ? <div key={s.key} style={{ width: `${(s.count / total) * 100}%`, background: s.color }} /> : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-[12px]" style={{ color: INK_MUTED }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
            {s.label} <span style={{ color: INK, fontFamily: "var(--font-mono)" }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PipelineBar({ pipeline }) {
  const stages = Object.keys(STAGE_LABELS);
  const max = Math.max(1, ...stages.map((k) => pipeline.stageCounts[k] ?? 0));
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {stages.map((key) => {
        const count = pipeline.stageCounts[key] ?? 0;
        const heightPct = Math.max(6, Math.round((count / max) * 100));
        const isPlaced = key === "placed";
        return (
          <div key={key} className="flex flex-col items-center">
            <span className="text-base font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: INK }}>
              {count}
            </span>
            <div className="w-full rounded-full mt-2 mb-2 flex items-end" style={{ height: 36, background: "var(--mist)" }}>
              <div className="w-full rounded-full" style={{ height: `${heightPct}%`, background: isPlaced ? "var(--forest)" : "#a9c4b5" }} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-center leading-tight" style={{ color: INK_MUTED }}>
              {STAGE_LABELS[key]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Block({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[14px] p-5" style={CARD}>
            <Block className="h-3 w-20 mb-3" />
            <Block className="h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="rounded-[14px] p-6" style={CARD}>
        <Block className="h-4 w-40 mb-5" />
        <Block className="h-40 w-full" />
      </div>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="rounded-[16px] p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1" style={{ color: INK }}>
        Unable to load analytics
      </p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: INK_MUTED }}>
        Something went wrong while loading recruitment analytics.
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

export default function AnalyticsPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchAnalytics()
      .then((s) => {
        if (cancelled) return;
        setSnapshot(s);
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

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Recruitment analytics
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Analytics
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 self-start"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            ← Dashboard
          </Link>
        </header>

        {status === "loading" && <AnalyticsSkeleton />}
        {status === "error" && <ErrorState onRetry={retry} />}

        {status === "ready" && snapshot && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Candidates analysed" value={snapshot.totals.completed} sub={`${snapshot.totals.processing} processing · ${snapshot.totals.failed} failed`} />
              <StatCard label="Avg. match score" value={snapshot.quality.avgScore} sub={`${snapshot.quality.strong} strong matches`} />
              <StatCard label="Shortlist rate" value={`${snapshot.conversion.shortlistRate}%`} sub="of analysed candidates" />
              <StatCard label="Placement rate" value={`${snapshot.conversion.placementRate}%`} sub="of analysed candidates" />
            </div>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <SectionHeading eyebrow="Funnel" title="Analysed → Placed" />
              <FunnelChart funnel={snapshot.funnel} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
                <SectionHeading eyebrow="Candidate quality" title="Score distribution" />
                <QualityDistribution quality={snapshot.quality} />
              </div>
              <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
                <SectionHeading eyebrow="Conversion" title="Stage conversion rates" />
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Interview rate" value={`${snapshot.conversion.interviewRate}%`} />
                  <StatCard label="Offer rate" value={`${snapshot.conversion.offerRate}%`} />
                </div>
              </div>
            </div>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <SectionHeading
                eyebrow="Pipeline health"
                title="Candidates by stage"
                action={
                  snapshot.pipeline.stalled > 0 && (
                    <span className="text-[12px] font-semibold" style={{ color: AMBER }}>
                      {snapshot.pipeline.stalled} stalled 5+ days
                    </span>
                  )
                }
              />
              <PipelineBar pipeline={snapshot.pipeline} />
            </div>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <SectionHeading
                eyebrow="Team"
                title="Recruiter summary"
                action={
                  <Link href="/dashboard/team" className="text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded" style={{ color: "var(--forest)" }}>
                    Full team view →
                  </Link>
                }
              />
              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                {snapshot.team.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <p className="text-sm font-semibold truncate" style={{ color: INK }}>
                      {r.name}
                    </p>
                    <div className="flex items-center gap-4 text-[12px] shrink-0" style={{ color: INK_MUTED }}>
                      <span>
                        <strong style={{ color: INK, fontFamily: "var(--font-mono)" }}>{r.activeCandidates}</strong> active
                      </span>
                      <span>
                        <strong style={{ color: "var(--forest)", fontFamily: "var(--font-mono)" }}>{r.placed}</strong> placed
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
