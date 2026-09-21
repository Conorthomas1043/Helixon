"use client";

/* ------------------------------------------------------------------------
 * ASSUMPTIONS
 * ------------------------------------------------------------------------
 * - Route: /dashboard/analytics. DashboardNav already linked here before
 *   any of this work started - if a real analytics page already exists,
 *   treat this as a reference implementation to reconcile, not a
 *   replacement.
 * - Every number here comes from getAnalyticsSnapshot() in
 *   lib/dashboard-api.js, reduced client-side over the agency's real
 *   candidate rows (fetched in full via getAllCandidates(), not a mock) -
 *   nothing on this page is a fabricated/static figure. See that
 *   function's comment for the production caveat (server-side
 *   aggregation, not client-side reduction, at real scale).
 * - No charting library is used, to match the existing dashboard's
 *   hand-rolled bar/funnel visuals (plain divs) rather than introducing a
 *   new dependency for this pass.
 * ---------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getAnalyticsSnapshot as fetchAnalytics } from "@/lib/dashboard-api";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { INK, INK_MUTED, INK_FAINT, AMBER, RED, GREEN_BG, CARD } from "@/lib/candidate-format";

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
                style={{ width: `${pct}%`, background: stage.key === "Placed" ? "var(--forest)" : "#a9c4b5" }}
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

// The one place in the product that checks whether the match score is
// actually worth anything, using this agency's own resolved outcomes
// (Placed or Rejected) rather than a generic, once-off accuracy claim
// measured on unrelated data. Stays honestly blank below the minimum
// sample size instead of showing a rate two data points can't support.
function ScoreCalibration({ calibration }) {
  if (!calibration.hasEnoughData) {
    return (
      <p className="text-[13px]" style={{ color: INK_MUTED }}>
        Not enough resolved outcomes yet to check this ({calibration.sampleSize} of{" "}
        {calibration.minSample} needed). This fills in as candidates are marked Placed
        or Rejected - the numbers below will always be this agency&apos;s own history,
        never a generic claim.
      </p>
    );
  }
  return (
    <div>
      <p className="text-[12px] mb-4" style={{ color: INK_MUTED }}>
        Of the {calibration.sampleSize} candidates who reached a final outcome (Placed
        or Rejected), how often did each score band actually get placed:
      </p>
      <div className="space-y-2.5">
        {calibration.bands.map((band) => (
          <div key={band.key} className="flex items-center gap-3">
            <span className="text-[11px] w-16 shrink-0" style={{ color: INK_MUTED }}>
              {band.label}
            </span>
            <div className="flex-1 h-6 rounded-[6px] overflow-hidden" style={{ background: "var(--mist)" }}>
              {band.total > 0 && (
                <div
                  className="h-full rounded-[6px] flex items-center justify-end px-2"
                  style={{ width: `${Math.max(4, band.placementRate)}%`, background: "var(--forest)" }}
                >
                  <span className="text-[11px] font-semibold tabular-nums text-white">
                    {band.placementRate}%
                  </span>
                </div>
              )}
            </div>
            <span className="text-[10px] w-24 text-right shrink-0" style={{ color: INK_FAINT }}>
              {band.total > 0 ? `${band.placed}/${band.total} placed` : "no data"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// "Time to fill"/"time to hire" and time-in-stage answer questions the
// rest of this page can't: not just how many candidates convert, but how
// long that actually takes, and where along the way. Median (not mean) -
// see app/api/analytics/timing's own comment on why.
function TimingRow({ timing }) {
  const fmtDays = (d) => (d === null || d === undefined ? "—" : `${d}d`);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard
        label="Time to fill"
        value={fmtDays(timing?.timeToFillDays)}
        sub={timing?.timeToFillSampleSize ? `median · ${timing.timeToFillSampleSize} role${timing.timeToFillSampleSize === 1 ? "" : "s"} filled` : "no placements yet"}
      />
      <StatCard
        label="Time to hire"
        value={fmtDays(timing?.timeToHireDays)}
        sub={timing?.timeToHireSampleSize ? `median · ${timing.timeToHireSampleSize} placement${timing.timeToHireSampleSize === 1 ? "" : "s"}` : "no placements yet"}
      />
      <StatCard
        label="Offer acceptance"
        value={timing?.offerAcceptance?.rate === null || timing?.offerAcceptance?.rate === undefined ? "—" : `${timing.offerAcceptance.rate}%`}
        sub={
          timing?.offerAcceptance
            ? `${timing.offerAcceptance.accepted} accepted, ${timing.offerAcceptance.declined} declined${timing.offerAcceptance.pending ? `, ${timing.offerAcceptance.pending} pending` : ""}`
            : undefined
        }
      />
    </div>
  );
}

function TimeInStage({ timeInStage }) {
  const withData = (timeInStage || []).filter((s) => s.count > 0);
  if (withData.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: INK_MUTED }}>
        Fills in as candidates move through stages - this reads real stage-change history, not just current position.
      </p>
    );
  }
  const max = Math.max(1, ...withData.map((s) => s.medianDays || 0));
  return (
    <div className="space-y-2.5">
      {withData.map((s) => (
        <div key={s.key} className="flex items-center gap-3">
          <span className="text-[11px] w-20 shrink-0 truncate" style={{ color: INK_MUTED }}>
            {s.label}
          </span>
          <div className="flex-1 h-6 rounded-[6px] overflow-hidden" style={{ background: "var(--mist)" }}>
            <div
              className="h-full rounded-[6px] flex items-center justify-end px-2"
              style={{ width: `${Math.max(4, Math.round(((s.medianDays || 0) / max) * 100))}%`, background: "#a9c4b5" }}
            >
              <span className="text-[11px] font-semibold tabular-nums text-white">{s.medianDays}d</span>
            </div>
          </div>
          <span className="text-[10px] w-20 text-right shrink-0" style={{ color: INK_FAINT }}>
            {s.count} sample{s.count === 1 ? "" : "s"}
          </span>
        </div>
      ))}
    </div>
  );
}

// Reusable "label · count (rate%)" bar list - source of hire, rejection
// reasons, both shaped the same way by app/api/analytics/timing.
function RankedList({ items, emptyLabel, rateLabel }) {
  if (!items || items.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: INK_MUTED }}>
        {emptyLabel}
      </p>
    );
  }
  const max = Math.max(1, ...items.map((i) => i.count ?? i.total ?? 0));
  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const value = item.count ?? item.total ?? 0;
        const pct = Math.max(4, Math.round((value / max) * 100));
        return (
          <div key={item.key} className="flex items-center gap-3">
            <span className="text-[12px] w-32 shrink-0 truncate" style={{ color: INK_MUTED }}>
              {item.label}
            </span>
            <div className="flex-1 h-6 rounded-[6px] overflow-hidden" style={{ background: "var(--mist)" }}>
              <div
                className="h-full rounded-[6px] flex items-center justify-end px-2"
                style={{ width: `${pct}%`, background: "#a9c4b5" }}
              >
                <span className="text-[11px] font-semibold tabular-nums text-white">{value}</span>
              </div>
            </div>
            {rateLabel && item.placementRate !== null && item.placementRate !== undefined && (
              <span className="text-[10px] w-24 text-right shrink-0" style={{ color: INK_FAINT }}>
                {item.placementRate}% {rateLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function OutreachRow({ outreach }) {
  if (!outreach || outreach.total === 0) {
    return (
      <p className="text-[13px]" style={{ color: INK_MUTED }}>
        No outreach logged yet - use &quot;Log a call/email/meeting&quot; on a candidate&apos;s profile.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {outreach.byType.map((t) => (
        <StatCard key={t.key} label={t.label} value={t.count} />
      ))}
    </div>
  );
}

function AdvertisingTable({ advertising }) {
  if (!advertising || advertising.length === 0) {
    return (
      <p className="text-[13px]" style={{ color: INK_MUTED }}>
        Log clicks/spend per channel on a job&apos;s page to see apply rate and cost per applicant here.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead>
          <tr style={{ color: INK_FAINT }}>
            <th className="text-left font-semibold pb-2">Channel</th>
            <th className="text-right font-semibold pb-2">Clicks</th>
            <th className="text-right font-semibold pb-2">Spend</th>
            <th className="text-right font-semibold pb-2">Applicants</th>
            <th className="text-right font-semibold pb-2">Apply rate</th>
            <th className="text-right font-semibold pb-2">Cost/applicant</th>
          </tr>
        </thead>
        <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
          {advertising.map((row) => (
            <tr key={row.key}>
              <td className="py-2 font-medium" style={{ color: INK }}>{row.label}</td>
              <td className="py-2 text-right tabular-nums" style={{ color: INK_MUTED }}>{row.clicks}</td>
              <td className="py-2 text-right tabular-nums" style={{ color: INK_MUTED }}>£{row.spend.toLocaleString()}</td>
              <td className="py-2 text-right tabular-nums" style={{ color: INK_MUTED }}>{row.applicants}</td>
              <td className="py-2 text-right tabular-nums" style={{ color: INK_MUTED }}>{row.applyRate !== null ? `${row.applyRate}%` : "—"}</td>
              <td className="py-2 text-right tabular-nums" style={{ color: INK_MUTED }}>{row.costPerApplicant !== null ? `£${row.costPerApplicant.toLocaleString()}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FinancialRow({ financial }) {
  const fmt = (n) => (n === null || n === undefined ? "—" : `£${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard label="Fee income" value={fmt(financial.totalFee)} sub={`${financial.placementsWithFee} placement${financial.placementsWithFee === 1 ? "" : "s"} reported`} />
        <StatCard label="Cost attributed" value={fmt(financial.totalCost)} />
        <StatCard label="Margin" value={fmt(financial.margin)} sub={financial.margin === null ? "no cost entries yet" : undefined} />
        <StatCard label="Avg fee / placement" value={fmt(financial.avgFee)} />
      </div>
      {financial.byRecruiter.length > 0 && (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {financial.byRecruiter.map((r) => (
            <li key={r.name} className="flex items-center justify-between gap-3 py-2">
              <span className="text-[13px] font-medium" style={{ color: INK }}>{r.name}</span>
              <span className="text-[12px]" style={{ color: INK_MUTED }}>
                <strong style={{ color: "var(--forest)", fontFamily: "var(--font-mono)" }}>{fmt(r.total)}</strong> · {r.placements} placement{r.placements === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] mt-3" style={{ color: INK_FAINT }}>
        Self-reported, entered per placement on the candidate&apos;s profile - Helixon has no independent way to verify these.
      </p>
    </>
  );
}

function RetentionAndReuse({ retention, reuse }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="30-day retention"
        value={retention.thirtyDay.rate === null ? "—" : `${retention.thirtyDay.rate}%`}
        sub={retention.thirtyDay.rate === null ? "no check-ins yet" : `${retention.thirtyDay.retained} retained, ${retention.thirtyDay.left} left`}
      />
      <StatCard
        label="90-day retention"
        value={retention.ninetyDay.rate === null ? "—" : `${retention.ninetyDay.rate}%`}
        sub={retention.ninetyDay.rate === null ? "no check-ins yet" : `${retention.ninetyDay.retained} retained, ${retention.ninetyDay.left} left`}
      />
      <StatCard
        label="Candidate reuse"
        value={reuse.rate === null ? "—" : `${reuse.rate}%`}
        sub={reuse.totalPeople ? `${reuse.reused} of ${reuse.totalPeople} submitted to 2+ roles` : "matched by email"}
      />
    </div>
  );
}

function FeedbackRow({ feedback }) {
  const nps = feedback.candidateNps;
  const client = feedback.clientSatisfaction;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <StatCard
          label="Candidate NPS"
          value={nps.score === null ? "—" : nps.score}
          sub={nps.responses ? `${nps.responses} response${nps.responses === 1 ? "" : "s"} · ${nps.promoters} promoters, ${nps.detractors} detractors` : "no responses yet"}
        />
      </div>
      <div>
        <StatCard
          label="Client satisfaction"
          value={client.avgRating === null ? "—" : `${client.avgRating}/5`}
          sub={client.responses ? `${client.responses} response${client.responses === 1 ? "" : "s"}` : "no responses yet"}
        />
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
        const isPlaced = key === "Placed";
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

            <div>
              <SectionHeading eyebrow="Speed & efficiency" title="How long it actually takes" />
              <TimingRow timing={snapshot.timing} />
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
              <SectionHeading eyebrow="Does the score work?" title="Score vs. actual outcome" />
              <ScoreCalibration calibration={snapshot.calibration} />
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
              <SectionHeading eyebrow="Bottlenecks" title="Median time spent in each stage" />
              <TimeInStage timeInStage={snapshot.timing?.timeInStage} />
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

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <SectionHeading eyebrow="Activity" title="Outreach logged" />
              <OutreachRow outreach={snapshot.timing?.outreach} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
                <SectionHeading eyebrow="Sourcing" title="Source of hire" />
                <RankedList items={snapshot.timing?.source} emptyLabel="No candidates have a source set yet - set one from a candidate's profile." rateLabel="placed" />
              </div>
              <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
                <SectionHeading eyebrow="Diagnosis" title="Why candidates fall through" />
                <RankedList items={snapshot.timing?.rejectionReasons} emptyLabel="No rejection reasons recorded yet." />
              </div>
            </div>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <SectionHeading eyebrow="Sourcing" title="Advertising & campaign performance" />
              <AdvertisingTable advertising={snapshot.timing?.advertising} />
            </div>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <SectionHeading eyebrow="Commercial" title="Financials" />
              {snapshot.timing?.financial && <FinancialRow financial={snapshot.timing.financial} />}
            </div>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <SectionHeading eyebrow="Quality" title="Retention & reuse" />
              {snapshot.timing?.retention && snapshot.timing?.reuse && (
                <RetentionAndReuse retention={snapshot.timing.retention} reuse={snapshot.timing.reuse} />
              )}
            </div>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <SectionHeading eyebrow="Sentiment" title="Candidate & client feedback" />
              {snapshot.timing?.feedback && <FeedbackRow feedback={snapshot.timing.feedback} />}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
