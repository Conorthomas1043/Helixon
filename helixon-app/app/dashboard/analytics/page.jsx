"use client";

// /dashboard/analytics - every figure is computed from the agency's own data:
// app/api/analytics/snapshot works out the funnel, conversion, quality,
// trends and changes vs the previous period server-side, and
// app/api/analytics/timing adds the time-based, commercial, feedback and
// recruiter-verdict figures. Nothing here is a static or generic number.
// Bars and funnels are plain divs; the over-time charts use recharts.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DashboardNav from "@/components/DashboardNav";
import { getAnalyticsSnapshot as fetchAnalytics, getClients, getJobs, getRecruiters } from "@/lib/dashboard-api";
import { useOffices } from "@/components/dashboard/use-offices";
import { downloadCsv } from "@/lib/csv";
import { analyticsCsvRows } from "@/lib/analytics-csv";
import { printSection } from "@/lib/print";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { INK, INK_MUTED, INK_FAINT, AMBER, RED, GREEN_BG, CARD } from "@/lib/candidate-format";

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
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

// "▲ 4 pts vs previous 30 days". Up isn't always good news (more failed
// analyses), so the arrow carries direction and the text stays neutral ink.
function Delta({ value, unit = "", against }) {
  if (typeof value !== "number") return null;
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "–";
  const amount = value === 0 ? "No change" : `${Math.abs(value).toLocaleString("en-GB")}${unit}`;
  return (
    <p className="text-[12px] mt-1 tabular-nums" style={{ color: INK_MUTED }}>
      <span aria-hidden="true" style={{ color: value > 0 ? "var(--forest)" : value < 0 ? RED : INK_FAINT }}>{arrow}</span>{" "}
      <span className="sr-only">{value > 0 ? "Up " : value < 0 ? "Down " : ""}</span>
      {amount} {against}
    </p>
  );
}

function StatCard({ label, value, sub, delta }) {
  return (
    <div className="rounded-[14px] p-5" style={CARD}>
      <p className="text-[12px] font-semibold uppercase tracking-widest mb-2" style={{ color: INK_FAINT }}>
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: INK }}>
        {value}
      </p>
      {sub && (
        <p className="text-[12px] mt-1" style={{ color: INK_MUTED }}>
          {sub}
        </p>
      )}
      {delta}
    </div>
  );
}

const money = (n) => `£${Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

function TrendTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[8px] px-3 py-2 text-[13px]" style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <p style={{ color: INK_FAINT }}>{label}</p>
      <p className="font-semibold tabular-nums" style={{ color: INK }}>{format(payload[0].value)}</p>
    </div>
  );
}

// One small chart per measure - analysed, placed and fees are on very
// different scales, so they never share an axis.
function TrendChart({ title, points, dataKey, format, total }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-[13px] font-semibold" style={{ color: INK }}>{title}</p>
        <p className="text-[13px] tabular-nums" style={{ color: INK_MUTED, fontFamily: "var(--font-mono)" }}>{format(total)}</p>
      </div>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: INK_FAINT }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: INK_FAINT }} width={dataKey === "fees" ? 48 : 28} allowDecimals={false} tickFormatter={dataKey === "fees" ? (v) => (v >= 1000 ? `£${Math.round(v / 1000)}k` : `£${v}`) : undefined} />
            <Tooltip cursor={{ fill: "rgba(var(--forest-rgb),0.06)" }} content={<TrendTooltip format={format} />} />
            <Bar dataKey={dataKey} fill="var(--forest)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Trends({ trends }) {
  const points = trends?.points || [];
  if (points.length === 0) {
    return <p className="text-[14px]" style={{ color: INK_MUTED }}>Nothing in this period yet.</p>;
  }
  const sum = (k) => points.reduce((n, p) => n + (p[k] || 0), 0);
  const count = (n) => Number(n || 0).toLocaleString("en-GB");
  const hasFees = sum("fees") > 0;
  return (
    <>
      <div className={`grid grid-cols-1 ${hasFees ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-6`}>
        <TrendChart title="Candidates analysed" points={points} dataKey="analysed" format={count} total={sum("analysed")} />
        <TrendChart title="Placements" points={points} dataKey="placed" format={count} total={sum("placed")} />
        {hasFees && <TrendChart title="Fees placed" points={points} dataKey="fees" format={money} total={sum("fees")} />}
      </div>
      <details className="mt-4 text-[13px]" style={{ color: INK_MUTED }}>
        <summary className="cursor-pointer font-semibold" style={{ color: "var(--forest)" }}>Show as a table</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full">
            <thead>
              <tr style={{ color: INK_FAINT }}>
                <th className="text-left font-semibold pb-1">{trends.unit === "week" ? "Week of" : "Month"}</th>
                <th className="text-right font-semibold pb-1">Analysed</th>
                <th className="text-right font-semibold pb-1">Placed</th>
                <th className="text-right font-semibold pb-1">Fees</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.start}>
                  <td className="py-0.5">{p.label}</td>
                  <td className="py-0.5 text-right tabular-nums">{count(p.analysed)}</td>
                  <td className="py-0.5 text-right tabular-nums">{count(p.placed)}</td>
                  <td className="py-0.5 text-right tabular-nums">{money(p.fees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
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
            <span className="text-[12px] w-20 shrink-0 truncate" style={{ color: INK_MUTED }}>
              {stage.label}
            </span>
            <div className="flex-1 h-6 rounded-[6px] overflow-hidden" style={{ background: "var(--mist)" }}>
              <div
                className="h-full rounded-[6px] flex items-center justify-end px-2"
                style={{ width: `${pct}%`, background: stage.key === "Placed" ? "var(--forest)" : "#a9c4b5" }}
              >
                <span className="text-[12px] font-semibold tabular-nums text-white">{stage.count}</span>
              </div>
            </div>
            <span className="text-[12px] w-16 text-right shrink-0" style={{ color: INK_FAINT }}>
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
    { key: "strong", label: "80+ Strong match", count: quality.strong, color: "var(--forest)" },
    { key: "moderate", label: "60–79 Worth reviewing", count: quality.moderate, color: AMBER },
    { key: "weak", label: "Below 60 Weak match", count: quality.weak, color: RED },
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
          <div key={s.key} className="flex items-center gap-1.5 text-[13px]" style={{ color: INK_MUTED }}>
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
// The thumbs up/down recruiters give each analysis on the Analyse screen -
// collected all along, but never shown anywhere until now.
function RecruiterVerdicts({ verdicts }) {
  if (!verdicts) return null;
  return (
    <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
      <p className="text-[12px] font-semibold uppercase tracking-wide mb-1" style={{ color: INK_FAINT }}>
        Recruiter verdicts
      </p>
      {verdicts.total === 0 ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>
          No verdicts yet. Use the thumbs up / down under each analysis to record whether it got the candidate right.
        </p>
      ) : (
        <>
          <p className="text-[14px]" style={{ color: INK }}>
            <span className="font-semibold tabular-nums">{verdicts.agreeRate}%</span> of rated analyses were marked
            accurate ({verdicts.up} of {verdicts.total}).
          </p>
          {verdicts.topReasons.length > 0 && (
            <ul className="mt-2 space-y-1">
              {verdicts.topReasons.map((r) => (
                <li key={r.reason} className="text-[13.5px] flex justify-between gap-3" style={{ color: INK_MUTED }}>
                  <span>{r.reason}</span>
                  <span className="tabular-nums">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ScoreCalibration({ calibration }) {
  if (!calibration.hasEnoughData) {
    return (
      <p className="text-[14px]" style={{ color: INK_MUTED }}>
        Not enough resolved outcomes yet to check this ({calibration.sampleSize} of{" "}
        {calibration.minSample} needed). This fills in as candidates are marked Placed
        or Rejected - the numbers below will always be this agency&apos;s own history,
        never a generic claim.
      </p>
    );
  }
  return (
    <div>
      <p className="text-[13px] mb-4" style={{ color: INK_MUTED }}>
        Of the {calibration.sampleSize} candidates who reached a final outcome (Placed
        or Rejected), how often did each score band actually get placed:
      </p>
      <div className="space-y-2.5">
        {calibration.bands.map((band) => (
          <div key={band.key} className="flex items-center gap-3">
            <span className="text-[12px] w-16 shrink-0" style={{ color: INK_MUTED }}>
              {band.label}
            </span>
            <div className="flex-1 h-6 rounded-[6px] overflow-hidden" style={{ background: "var(--mist)" }}>
              {band.total > 0 && (
                <div
                  className="h-full rounded-[6px] flex items-center justify-end px-2"
                  style={{ width: `${Math.max(4, band.placementRate)}%`, background: "var(--forest)" }}
                >
                  <span className="text-[12px] font-semibold tabular-nums text-white">
                    {band.placementRate}%
                  </span>
                </div>
              )}
            </div>
            <span className="text-[12px] w-24 text-right shrink-0" style={{ color: INK_FAINT }}>
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
      <p className="text-[14px]" style={{ color: INK_MUTED }}>
        Fills in as candidates move through stages - this reads real stage-change history, not just current position.
      </p>
    );
  }
  const max = Math.max(1, ...withData.map((s) => s.medianDays || 0));
  return (
    <div className="space-y-2.5">
      {withData.map((s) => (
        <div key={s.key} className="flex items-center gap-3">
          <span className="text-[12px] w-20 shrink-0 truncate" style={{ color: INK_MUTED }}>
            {s.label}
          </span>
          <div className="flex-1 h-6 rounded-[6px] overflow-hidden" style={{ background: "var(--mist)" }}>
            <div
              className="h-full rounded-[6px] flex items-center justify-end px-2"
              style={{ width: `${Math.max(4, Math.round(((s.medianDays || 0) / max) * 100))}%`, background: "#a9c4b5" }}
            >
              <span className="text-[12px] font-semibold tabular-nums text-white">{s.medianDays}d</span>
            </div>
          </div>
          <span className="text-[12px] w-20 text-right shrink-0" style={{ color: INK_FAINT }}>
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
      <p className="text-[14px]" style={{ color: INK_MUTED }}>
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
            <span className="text-[13px] w-32 shrink-0 truncate" style={{ color: INK_MUTED }}>
              {item.label}
            </span>
            <div className="flex-1 h-6 rounded-[6px] overflow-hidden" style={{ background: "var(--mist)" }}>
              <div
                className="h-full rounded-[6px] flex items-center justify-end px-2"
                style={{ width: `${pct}%`, background: "#a9c4b5" }}
              >
                <span className="text-[12px] font-semibold tabular-nums text-white">{value}</span>
              </div>
            </div>
            {rateLabel && item.placementRate !== null && item.placementRate !== undefined && (
              <span className="text-[12px] w-24 text-right shrink-0" style={{ color: INK_FAINT }}>
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
      <p className="text-[14px]" style={{ color: INK_MUTED }}>
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
      <p className="text-[14px]" style={{ color: INK_MUTED }}>
        Log clicks/spend per channel on a job&apos;s page to see apply rate and cost per applicant here.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
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
              <td className="py-2 text-right tabular-nums" style={{ color: INK_MUTED }}>{row.spend == null ? "—" : `£${row.spend.toLocaleString()}`}</td>
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
              <span className="text-[14px] font-medium" style={{ color: INK }}>{r.name}</span>
              <span className="text-[13px]" style={{ color: INK_MUTED }}>
                <strong style={{ color: "var(--forest)", fontFamily: "var(--font-mono)" }}>{fmt(r.total)}</strong> · {r.placements} placement{r.placements === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] mt-3" style={{ color: INK_FAINT }}>
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
            <span className="text-[12px] font-semibold uppercase tracking-wide text-center leading-tight" style={{ color: INK_MUTED }}>
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
        className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--forest)", color: "white" }}
      >
        Try again
      </button>
    </div>
  );
}

const PERIODS = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
  { value: "custom", label: "Custom range…" },
];

const DATE_INPUT_CLASS = "text-[13.5px] px-3 py-2 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function fmtDay(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
}

function FilterSelect({ value, onChange, options, ariaLabel }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[13.5px] font-semibold px-3.5 py-2 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ border: `1px solid ${value !== "all" ? "var(--forest)" : "var(--border)"}`, color: INK }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function AnalyticsPage() {
  const [snapshot, setSnapshot] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [period, setPeriod] = useState("all");
  const [jobId, setJobId] = useState("all");
  const [recruiterId, setRecruiterId] = useState("all");
  const [clientId, setClientId] = useState("all");
  const [officeId, setOfficeId] = useState("all");
  const offices = useOffices();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [jobs, setJobs] = useState([]);
  const [recruiters, setRecruiters] = useState([]);
  const [clients, setClients] = useState([]);

  useEffect(() => {
    getJobs().then(setJobs).catch(() => {});
    getRecruiters().then(setRecruiters).catch(() => {});
    getClients().then((c) => setClients(c || [])).catch(() => {});
  }, []);

  // A custom range waits until at least one end is picked.
  const customPending = period === "custom" && !from && !to;
  const effectivePeriod = customPending ? "all" : period;
  const periodLabel =
    effectivePeriod === "custom"
      ? from && to
        ? `${fmtDay(from)} to ${fmtDay(to)}`
        : from
          ? `since ${fmtDay(from)}`
          : `until ${fmtDay(to)}`
      : effectivePeriod !== "all" && PERIODS.find((p) => p.value === effectivePeriod)?.label.toLowerCase();
  const filtered = effectivePeriod !== "all" || jobId !== "all" || recruiterId !== "all" || clientId !== "all" || officeId !== "all";
  const filterLabel = [
    periodLabel,
    officeId !== "all" && (offices.find((o) => o.id === officeId)?.name || "One office"),
    clientId !== "all" && (clients.find((c) => c.id === clientId)?.name || "One client"),
    jobId !== "all" && (jobs.find((j) => j.id === jobId)?.title || "One job"),
    recruiterId !== "all" && (recruiters.find((r) => r.id === recruiterId)?.name || "One recruiter"),
  ]
    .filter(Boolean)
    .join(" · ");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
    setStatus("loading");
    fetchAnalytics({ period: effectivePeriod, from, to, jobId, recruiterId, clientId, officeId })
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
  }, [reloadKey, effectivePeriod, from, to, jobId, recruiterId, clientId, officeId]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const previousRange = snapshot?.filters?.previous;
  const against = previousRange
    ? effectivePeriod === "custom"
      ? `vs ${fmtDay(previousRange.from)} to ${fmtDay(new Date(new Date(previousRange.to).getTime() - 86400000).toISOString())}`
      : `vs previous ${PERIODS.find((p) => p.value === effectivePeriod)?.label.replace(/^Last /, "").toLowerCase()}`
    : "";

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
              Recruitment analytics
            </p>
            <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
              Analytics
            </h1>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 self-start"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            ← Dashboard
          </Link>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect ariaLabel="Period" value={period} onChange={setPeriod} options={PERIODS} />
          {period === "custom" && (
            <>
              <input type="date" aria-label="From" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={DATE_INPUT_CLASS} style={{ border: "1px solid var(--border)", color: INK }} />
              <span className="text-[13px]" style={{ color: INK_FAINT }}>to</span>
              <input type="date" aria-label="To" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={DATE_INPUT_CLASS} style={{ border: "1px solid var(--border)", color: INK }} />
            </>
          )}
          {offices.length > 0 && (
            <FilterSelect
              ariaLabel="Office"
              value={officeId}
              onChange={(next) => {
                setOfficeId(next);
                setJobId("all");
              }}
              options={[{ value: "all", label: "All offices" }, ...offices.map((o) => ({ value: o.id, label: o.name }))]}
            />
          )}
          {clients.length > 0 && (
            <FilterSelect
              ariaLabel="Client"
              value={clientId}
              onChange={(next) => {
                setClientId(next);
                setJobId("all");
              }}
              options={[{ value: "all", label: "All clients" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            />
          )}
          <FilterSelect
            ariaLabel="Job"
            value={jobId}
            onChange={setJobId}
            options={[{ value: "all", label: "All jobs" }, ...jobs.filter((j) => (clientId === "all" || j.client_id === clientId) && (officeId === "all" || j.officeId === officeId)).map((j) => ({ value: j.id, label: j.title }))]}
          />
          <FilterSelect
            ariaLabel="Recruiter"
            value={recruiterId}
            onChange={setRecruiterId}
            options={[{ value: "all", label: "Everyone" }, ...recruiters.map((r) => ({ value: r.id, label: r.name }))]}
          />
          {filtered && (
            <button
              type="button"
              onClick={() => {
                setPeriod("all");
                setFrom("");
                setTo("");
                setJobId("all");
                setRecruiterId("all");
                setClientId("all");
                setOfficeId("all");
              }}
              className="text-[13.5px] font-semibold px-2"
              style={{ color: "var(--forest)" }}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            disabled={status !== "ready"}
            onClick={() => printSection("analytics-report")}
            className="ml-auto inline-flex items-center gap-1.5 text-[13.5px] font-semibold px-3.5 py-2 rounded-full bg-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK_MUTED }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z" />
            </svg>
            Save as PDF
          </button>
          <button
            type="button"
            disabled={status !== "ready"}
            onClick={() =>
              downloadCsv(`analytics-${new Date().toISOString().slice(0, 10)}.csv`, analyticsCsvRows(snapshot, filterLabel || "All time"))
            }
            className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold px-3.5 py-2 rounded-full bg-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK_MUTED }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3v13m0 0-4-4m4 4 4-4M5 21h14" />
            </svg>
            Export CSV
          </button>
        </div>
        {filtered && (
          <p className="text-[13px] -mt-3" style={{ color: INK_FAINT }}>
            Showing candidates for {filterLabel}. Channel figures follow the job and client filters; client and candidate feedback is agency-wide.
          </p>
        )}
        {customPending && (
          <p className="text-[13px] -mt-3" style={{ color: INK_FAINT }}>
            Pick a start or end date - showing all time until then.
          </p>
        )}

        {status === "loading" && <AnalyticsSkeleton />}
        {status === "error" && <ErrorState onRetry={retry} />}

        {status === "ready" && snapshot && (
          <div id="analytics-report" className="space-y-6">
            <div className="hidden print:block">
              <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>Recruitment analytics</h2>
              <p className="text-[13px]" style={{ color: INK_MUTED }}>
                {filterLabel || "All time"} · generated {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>

            {snapshot.truncated && (
              <p role="status" className="rounded-[12px] px-4 py-3 text-[14px]" style={{ background: GREEN_BG, color: INK }}>
                This is more data than can be counted at once, so the oldest candidates are left out. Narrow the period or pick a job to see exact figures.
              </p>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Candidates analysed"
                value={snapshot.totals.completed}
                sub={`${snapshot.totals.processing} processing · ${snapshot.totals.failed} failed`}
                delta={<Delta value={snapshot.deltas?.completed} against={against} />}
              />
              <StatCard
                label="Avg. match score"
                value={snapshot.quality.avgScore}
                sub={`${snapshot.quality.strong} strong matches`}
                delta={<Delta value={snapshot.deltas?.avgScore} against={against} />}
              />
              <StatCard
                label="Shortlist rate"
                value={`${snapshot.conversion.shortlistRate}%`}
                sub="of analysed candidates"
                delta={<Delta value={snapshot.deltas?.shortlistRate} unit=" pts" against={against} />}
              />
              <StatCard
                label="Placement rate"
                value={`${snapshot.conversion.placementRate}%`}
                sub="of analysed candidates"
                delta={<Delta value={snapshot.deltas?.placementRate} unit=" pts" against={against} />}
              />
            </div>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <SectionHeading
                eyebrow="Over time"
                title={snapshot.trends?.unit === "week" ? "Week by week" : "Month by month"}
                action={
                  typeof snapshot.placedInPeriod === "number" && (
                    <span className="text-[13px]" style={{ color: INK_MUTED }}>
                      <strong style={{ color: INK, fontFamily: "var(--font-mono)" }}>{snapshot.placedInPeriod}</strong> placed in this period
                    </span>
                  )
                }
              />
              <Trends trends={snapshot.trends} />
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
                  <StatCard label="Interview rate" value={`${snapshot.conversion.interviewRate}%`} delta={<Delta value={snapshot.deltas?.interviewRate} unit=" pts" against={against} />} />
                  <StatCard label="Offer rate" value={`${snapshot.conversion.offerRate}%`} delta={<Delta value={snapshot.deltas?.offerRate} unit=" pts" against={against} />} />
                </div>
                <p className="text-[12px] mt-3" style={{ color: INK_FAINT }}>
                  Counts how far each candidate got, including those later rejected.
                </p>
              </div>
            </div>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <SectionHeading eyebrow="Does the score work?" title="Score vs. actual outcome" />
              <ScoreCalibration calibration={snapshot.calibration} />
              <RecruiterVerdicts verdicts={snapshot.timing?.recruiterVerdicts} />
            </div>

            <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
              <SectionHeading
                eyebrow="Pipeline health"
                title="Candidates by stage"
                action={
                  snapshot.pipeline.stalled > 0 && (
                    <span className="text-[13px] font-semibold" style={{ color: AMBER }}>
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
                  <Link href="/dashboard/team" className="text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded" style={{ color: "var(--forest)" }}>
                    Full team view →
                  </Link>
                }
              />
              {snapshot.team.length === 0 && (
                <p className="text-[14px]" style={{ color: INK_MUTED }}>No candidates assigned to anyone for these filters.</p>
              )}
              <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                {snapshot.team.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                    <p className="text-sm font-semibold truncate" style={{ color: INK }}>
                      {r.name}
                    </p>
                    <div className="flex items-center gap-4 text-[13px] shrink-0" style={{ color: INK_MUTED }}>
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
              {snapshot.timing?.financial ? (
                <FinancialRow financial={snapshot.timing.financial} />
              ) : snapshot.timing?.financialsHidden ? (
                <p className="text-[14px]" style={{ color: INK_MUTED }}>Fee income and margins are only visible to the owner and admins.</p>
              ) : null}
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
          </div>
        )}
      </div>
    </main>
  );
}
