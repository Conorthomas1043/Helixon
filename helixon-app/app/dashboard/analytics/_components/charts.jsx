"use client";

// Part of the analytics page (../page.jsx): stat cards, the over-time charts
// and the screening-quality charts.

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { INK, INK_MUTED, INK_FAINT, AMBER, RED, CARD } from "@/lib/candidates/format";
import { axisMoney, niceTicks } from "@/lib/analytics/chart-ticks";

// "▲ 4 pts vs previous 30 days". Up isn't always good news (more failed
// analyses), so the arrow carries direction and the text stays neutral ink.
export function Delta({ value, unit = "", against }) {
  if (typeof value !== "number") return null;
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "–";
  const amount = value === 0 ? "No change" : `${Math.abs(value).toLocaleString("en-GB")}${unit}`;
  return (
    <p className="text-12 mt-1 tabular-nums" style={{ color: INK_MUTED }}>
      <span aria-hidden="true" style={{ color: value > 0 ? "var(--forest)" : value < 0 ? RED : INK_FAINT }}>{arrow}</span>{" "}
      <span className="sr-only">{value > 0 ? "Up " : value < 0 ? "Down " : ""}</span>
      {amount} {against}
    </p>
  );
}

export function StatCard({ label, value, sub, delta }) {
  return (
    <div className="rounded-card p-5" style={CARD}>
      <p className="text-12 font-semibold uppercase tracking-widest mb-2" style={{ color: INK_FAINT }}>
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: INK }}>
        {value}
      </p>
      {sub && (
        <p className="text-12 mt-1" style={{ color: INK_MUTED }}>
          {sub}
        </p>
      )}
      {delta}
    </div>
  );
}

export const money = (n) => `£${Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

// Fill for every bar except the one being highlighted. Labels on it are ink:
// white measured 1.9:1 against it.
export const MUTED_BAR = "#a9c4b5";

export function TrendTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-13" style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <p style={{ color: INK_FAINT }}>{label}</p>
      <p className="font-semibold tabular-nums" style={{ color: INK }}>{format(payload[0].value)}</p>
    </div>
  );
}

// One small chart per measure - analysed, placed and fees are on very
// different scales, so they never share an axis.
export function TrendChart({ title, points, dataKey, format, total }) {
  const ticks = niceTicks(Math.max(0, ...points.map((p) => p[dataKey] || 0)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-13 font-semibold" style={{ color: INK }}>{title}</p>
        <p className="text-13 tabular-nums" style={{ color: INK_MUTED, fontFamily: "var(--font-mono)" }}>{format(total)}</p>
      </div>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: INK_FAINT }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: INK_FAINT }} width={dataKey === "fees" ? 48 : 28} allowDecimals={false} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} interval={0} tickFormatter={dataKey === "fees" ? axisMoney : undefined} />
            <Tooltip cursor={{ fill: "rgba(var(--forest-rgb),0.06)" }} content={<TrendTooltip format={format} />} />
            <Bar dataKey={dataKey} fill="var(--forest)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function Trends({ trends }) {
  const points = trends?.points || [];
  if (points.length === 0) {
    return <p className="text-14" style={{ color: INK_MUTED }}>Nothing in this period yet.</p>;
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
      <details className="mt-4 text-13" style={{ color: INK_MUTED }}>
        <summary className="cursor-pointer font-semibold" style={{ color: "var(--forest)" }}>Show as a table</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full">
            <thead>
              <tr style={{ color: INK_FAINT }}>
                <th scope="col" className="text-left font-semibold pb-1">{trends.unit === "week" ? "Week of" : "Month"}</th>
                <th scope="col" className="text-right font-semibold pb-1">Analysed</th>
                <th scope="col" className="text-right font-semibold pb-1">Placed</th>
                <th scope="col" className="text-right font-semibold pb-1">Fees</th>
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

export function FunnelChart({ funnel }) {
  const max = funnel[0]?.count || 1;
  return (
    <div className="space-y-2.5">
      {funnel.map((stage, i) => {
        const pct = Math.max(4, Math.round((stage.count / max) * 100));
        const prevCount = i > 0 ? funnel[i - 1].count : stage.count;
        const dropOff = i > 0 && prevCount > 0 ? Math.round(((prevCount - stage.count) / prevCount) * 100) : 0;
        return (
          <div key={stage.key} className="flex items-center gap-3">
            <span className="text-12 w-20 shrink-0 truncate" style={{ color: INK_MUTED }}>
              {stage.label}
            </span>
            <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: "var(--mist)" }}>
              <div
                className="h-full rounded-md flex items-center justify-end px-2"
                style={{ width: `${pct}%`, background: stage.key === "Placed" ? "var(--forest)" : MUTED_BAR }}
              >
                <span className="text-12 font-semibold tabular-nums" style={{ color: stage.key === "Placed" ? "white" : INK }}>{stage.count}</span>
              </div>
            </div>
            <span className="text-12 w-16 text-right shrink-0" style={{ color: INK_FAINT }}>
              {i > 0 && dropOff > 0 ? `-${dropOff}%` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function QualityDistribution({ quality }) {
  const total = quality.scoredCount || 1;
  const segments = [
    { key: "strong", label: "80+ Strong match", count: quality.strong, color: "var(--forest)" },
    { key: "moderate", label: "60–79 Worth reviewing", count: quality.moderate, color: AMBER },
    { key: "weak", label: "Below 60 Weak match", count: quality.weak, color: RED },
  ];
  return (
    <div>
      {/* A gap between segments, so the bands don't depend on telling red
          from green apart; each is also labelled with its count below. */}
      <div className="h-3 rounded-full overflow-hidden flex gap-[2px] mb-3" style={{ background: "var(--mist)" }}>
        {segments.map((s) =>
          s.count > 0 ? <div key={s.key} style={{ width: `${(s.count / total) * 100}%`, background: s.color }} /> : null
        )}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-13" style={{ color: INK_MUTED }}>
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
export function RecruiterVerdicts({ verdicts }) {
  if (!verdicts) return null;
  return (
    <div className="mt-5 pt-5" style={{ borderTop: "1px solid var(--border)" }}>
      <p className="text-12 font-semibold uppercase tracking-wide mb-1" style={{ color: INK_FAINT }}>
        Recruiter verdicts
      </p>
      {verdicts.total === 0 ? (
        <p className="text-14" style={{ color: INK_MUTED }}>
          No verdicts yet. Use the thumbs up / down under each analysis to record whether it got the candidate right.
        </p>
      ) : (
        <>
          <p className="text-14" style={{ color: INK }}>
            <span className="font-semibold tabular-nums">{verdicts.agreeRate}%</span> of rated analyses were marked
            accurate ({verdicts.up} of {verdicts.total}).
          </p>
          {verdicts.topReasons.length > 0 && (
            <ul className="mt-2 space-y-1">
              {verdicts.topReasons.map((r) => (
                <li key={r.reason} className="text-14 flex justify-between gap-3" style={{ color: INK_MUTED }}>
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

export function ScoreCalibration({ calibration }) {
  if (!calibration.hasEnoughData) {
    return (
      <p className="text-14" style={{ color: INK_MUTED }}>
        Not enough resolved outcomes yet to check this ({calibration.sampleSize} of{" "}
        {calibration.minSample} needed). This fills in as candidates are marked Placed
        or Rejected - the numbers below will always be this agency&apos;s own history,
        never a generic claim.
      </p>
    );
  }
  return (
    <div>
      <p className="text-13 mb-4" style={{ color: INK_MUTED }}>
        Of the {calibration.sampleSize} candidates who reached a final outcome (Placed
        or Rejected), how often did each score band actually get placed:
      </p>
      <div className="space-y-2.5">
        {calibration.bands.map((band) => (
          <div key={band.key} className="flex items-center gap-3">
            <span className="text-12 w-16 shrink-0" style={{ color: INK_MUTED }}>
              {band.label}
            </span>
            <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ background: "var(--mist)" }}>
              {band.total > 0 && (
                <div
                  className="h-full rounded-md flex items-center justify-end px-2"
                  style={{ width: `${Math.max(4, band.placementRate)}%`, background: "var(--forest)" }}
                >
                  <span className="text-12 font-semibold tabular-nums text-white">
                    {band.placementRate}%
                  </span>
                </div>
              )}
            </div>
            <span className="text-12 w-24 text-right shrink-0" style={{ color: INK_FAINT }}>
              {band.total > 0 ? `${band.placed}/${band.total} placed` : "no data"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
