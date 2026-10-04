"use client";

// Part of the dashboard home (app/dashboard/page.js).

import CountUp from "@/components/dashboard/CountUp";
import Link from "next/link";
import { FUNNEL_ORDER, STAGE_COLORS, STAGE_LABELS } from "@/lib/stage-labels";
import { STRONG_MATCH_MIN, scoreBandLabel } from "@/lib/scoreBands";
import { SectionHeading } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";
import { useNow } from "@/lib/hooks/useNow";
import { useRouter } from "next/navigation";
import { ACCENT, ACCENT_BG, ACCENT_FG, BORDER, BORDER2, CARD, GREEN_BG, GREEN_FG, RED, SURFACE2, TEXT, TEXT_FAINT, TEXT_SUB, formatDate, formatNumber, scoreColor } from "./shared";
import { EmptyState } from "./states";
import { useHydrated } from "@/lib/hooks/useHydrated";

export function scoreLabel(score) {
  return scoreBandLabel(score);
}

/* ─── Shared components ─────────────────────────────────────────────────── */

export function ScorePill({ score }) {
  const color = scoreColor(score);
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span style={{ fontFamily: "var(--font-mono)", color, fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {score === null || score === undefined ? "-" : score}
      </span>
      <span style={{ color: TEXT_FAINT, fontSize: 12 }}>{scoreLabel(score)}</span>
    </div>
  );
}

export function StageBadge({ stage }) {
  if (!stage || !STAGE_LABELS[stage]) {
    return <span style={{ color: TEXT_FAINT, fontSize: 12 }}>No stage</span>;
  }
  const isPlaced = stage === FUNNEL_ORDER[FUNNEL_ORDER.length - 1];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      fontSize: 12,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 9999,
      background: isPlaced ? GREEN_BG : ACCENT_BG,
      color: isPlaced ? GREEN_FG : ACCENT_FG,
      border: `1px solid rgba(var(--forest-rgb),0.2)`,
    }}>
      {STAGE_LABELS[stage]}
    </span>
  );
}

/* ─── Pipeline ──────────────────────────────────────────────────────────── */

// Funnel of where every candidate stands, plus the share that made it from
// each stage to the next. "Reached" counts a candidate in their current
// stage and every stage before it (someone in Interview has, by definition,
// been Screened and Shortlisted), so the conversion between two stages is
// reached(next) / reached(this).
export function PipelineSnapshot({ stageOrder, stageCounts, maxCount, rejected = 0 }) {
  // Bars grow in from 0 on mount instead of appearing at final height -
  // same two-step pattern as KpiCard's meter.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 150);
    return () => clearTimeout(t);
  }, []);

  const reached = stageOrder.map((_, i) => stageOrder.slice(i).reduce((n, k) => n + (stageCounts[k] ?? 0), 0));
  const active = reached[0] ?? 0;

  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow="Candidate pipeline"
        title="Where candidates stand"
        action={
          <Link href="/dashboard/pipeline" style={{ fontSize: 13, fontWeight: 600, color: ACCENT_FG, textDecoration: "none" }}>
            Open pipeline →
          </Link>
        }
      />
      {maxCount === 0 ? (
        <EmptyState title="No candidates in progress" body="Candidates will appear here once analyses complete." actionLabel="Screen a CV" actionHref="/analyse" />
      ) : (
        <>
          <div className="flex items-stretch gap-1.5 overflow-x-auto pb-1">
            {stageOrder.map((stageKey, i) => {
              const count = stageCounts[stageKey] ?? 0;
              const heightPct = maxCount > 0 ? Math.max(6, Math.round((count / maxCount) * 100)) : 0;
              const conversion = i > 0 && reached[i - 1] > 0 ? Math.round((reached[i] / reached[i - 1]) * 100) : null;
              return (
                <div key={stageKey} className="flex items-stretch gap-1.5 flex-1 min-w-[92px]">
                  {conversion !== null && (
                    <div className="flex flex-col items-center justify-center shrink-0 w-9" title={`${conversion}% of candidates who reached ${STAGE_LABELS[stageOrder[i - 1]]} got to ${STAGE_LABELS[stageKey]}`}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_SUB, fontVariantNumeric: "tabular-nums" }}>{conversion}%</span>
                      <span aria-hidden="true" style={{ fontSize: 13, color: TEXT_FAINT, lineHeight: 1 }}>→</span>
                    </div>
                  )}
                  <Link
                    href={`/dashboard/pipeline?stage=${stageKey}`}
                    className="lift-on-hover flex-1"
                    aria-label={`${STAGE_LABELS[stageKey]}: ${count} candidates`}
                    style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 8px", borderRadius: 10, border: `1px solid ${BORDER}`, borderTop: `3px solid ${STAGE_COLORS[stageKey]}`, background: SURFACE2 }}
                  >
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600, color: TEXT, lineHeight: 1 }}>
                      <CountUp value={count} format={formatNumber} />
                    </span>
                    <div style={{ width: "100%", height: 40, background: BORDER2, borderRadius: 6, marginTop: 8, marginBottom: 8, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                      <div
                        style={{
                          width: "100%",
                          height: grown ? `${heightPct}%` : 0,
                          background: STAGE_COLORS[stageKey],
                          borderRadius: "0 0 4px 4px",
                          transition: `height 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms`,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_FAINT, textAlign: "center", lineHeight: 1.3 }}>
                      {STAGE_LABELS[stageKey]}
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-3" style={{ fontSize: 13, color: TEXT_SUB }}>
            <span>
              <b style={{ color: TEXT, fontVariantNumeric: "tabular-nums" }}>{formatNumber(active)}</b> active
            </span>
            {active > 0 && (
              <span>
                <b style={{ color: GREEN_FG, fontVariantNumeric: "tabular-nums" }}>{Math.round(((stageCounts[stageOrder[stageOrder.length - 1]] ?? 0) / active) * 100)}%</b> placed overall
              </span>
            )}
            {rejected > 0 && (
              <Link href="/dashboard/pipeline?stage=Rejected" style={{ color: TEXT_SUB, textDecoration: "none" }}>
                <b style={{ color: "var(--score-low)", fontVariantNumeric: "tabular-nums" }}>{formatNumber(rejected)}</b> rejected
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Top candidates ────────────────────────────────────────────────────── */

export function TopCandidates({ candidates, total }) {
  const hiddenCount = Math.max(0, total - candidates.length);
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading eyebrow="Top talent" title="Strongest candidates" />
      {candidates.length === 0 ? (
        <EmptyState title="No strong matches yet" body={`Candidates scoring ${STRONG_MATCH_MIN} or above will appear here.`} />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {candidates.map((c, i) => (
            <li
              key={c.id}
              className="fade-up-in"
              style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none", "--stagger-delay": `${i * 50}ms` }}
            >
              <Link href={`/dashboard/candidates/${c.candidateId ?? c.id}`} title={`${c.candidateName} - ${c.jobTitle}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 8px",
                borderRadius: 10, textDecoration: "none",
              }} className="hover:bg-[var(--mist)] transition-colors">
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: ACCENT_BG, color: ACCENT_FG, fontSize: 13, fontWeight: 700,
                }}>
                  {c.candidateName[0]}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.candidateName}</p>
                  <p style={{ fontSize: 13, color: TEXT_SUB, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.jobTitle}{c.company ? ` · ${c.company}` : ""}
                  </p>
                </div>
                <StageBadge stage={c.stage} />
                <ScorePill score={c.score} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <Link href="/dashboard/candidates?scoreBand=80%2B" style={{ display: "block", textAlign: "center", fontSize: 13, fontWeight: 600, color: ACCENT_FG, textDecoration: "none", paddingTop: 12, marginTop: 4, borderTop: `1px solid ${BORDER}` }}>
          {hiddenCount} more strong {hiddenCount === 1 ? "candidate" : "candidates"} →
        </Link>
      )}
    </div>
  );
}

/* ─── Activity overview ─────────────────────────────────────────────────── */

export function ActivityOverview({ analyses }) {
  const hydrated = useHydrated(); // clock/time-zone text waits for the browser
  const [windowDays, setWindowDays] = useState(7);
  // Re-triggers whenever the 7D/30D toggle changes, so switching windows
  // re-grows the bars instead of just snapping to new heights.
  // Which window the bars have finished growing for: switching windows
  // makes this stale, so the bars drop and grow again without a reset.
  const [grownFor, setGrownFor] = useState(null);
  const barsGrown = grownFor === windowDays;
  const mountedAt = useNow();
  useEffect(() => {
    const t = setTimeout(() => setGrownFor(windowDays), 60);
    return () => clearTimeout(t);
  }, [windowDays]);

  const stats = useMemo(() => {
    const now = mountedAt;
    const DAY = 86400000;
    const current = analyses.filter((a) => a.createdAt && now - a.createdAt.getTime() < windowDays * DAY);
    const previous = analyses.filter((a) => a.createdAt && now - a.createdAt.getTime() >= windowDays * DAY && now - a.createdAt.getTime() < windowDays * 2 * DAY);
    const dayBuckets = Array.from({ length: windowDays }).map((_, i) => {
      const offset = windowDays - 1 - i;
      const dayDate = new Date(now - offset * DAY);
      const count = analyses.filter((a) => {
        if (!a.createdAt) return false;
        return Math.floor((now - a.createdAt.getTime()) / DAY) === offset;
      }).length;
      const showLabel = windowDays <= 7 || offset % 5 === 0;
      return {
        label: showLabel ? dayDate.toLocaleDateString("en-GB", windowDays <= 7 ? { weekday: "narrow" } : { day: "numeric", month: "short" }) : "",
        count,
      };
    });
    return {
      currentCount: current.length,
      previousCount: previous.length,
      dayBuckets,
      strong: current.filter((a) => a.score !== null && a.score >= STRONG_MATCH_MIN).length,
      avgScore: (() => {
        const scored = current.filter((a) => a.score !== null);
        return scored.length ? Math.round(scored.reduce((n, a) => n + a.score, 0) / scored.length) : null;
      })(),
    };
  }, [analyses, windowDays, mountedAt]);

  const delta = stats.currentCount - stats.previousCount;
  const maxBucket = Math.max(1, ...stats.dayBuckets.map((d) => d.count));

  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow="Momentum"
        title="Activity"
        action={
          <div style={{ display: "inline-flex", borderRadius: 9999, padding: 2, background: SURFACE2, border: `1px solid ${BORDER}` }}>
            {[7, 30].map((d) => (
              <button key={d} type="button" onClick={() => setWindowDays(d)} aria-pressed={windowDays === d} style={{
                fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 9999,
                background: windowDays === d ? ACCENT : "transparent",
                color: windowDays === d ? "#fff" : TEXT_FAINT,
                border: "none", cursor: "pointer",
              }}>{d}D</button>
            ))}
          </div>
        }
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 600, color: TEXT, fontVariantNumeric: "tabular-nums" }}>
          <CountUp value={stats.currentCount} format={formatNumber} />
        </span>
        <span style={{ fontSize: 13, color: TEXT_SUB }}>in the last {windowDays} days</span>
      </div>
      <p style={{ fontSize: 13, marginBottom: 16, color: delta >= 0 ? GREEN_FG : RED }}>
        {delta === 0 ? `Same as previous ${windowDays} days` : `${delta > 0 ? "+" : ""}${delta} vs. previous ${windowDays} days`}
      </p>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 56, marginBottom: 12 }} role="img" aria-label={`Analyses per day over ${windowDays} days`}>
        {stats.dayBuckets.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 3 }}>
            <div style={{
              width: "100%", borderRadius: "3px 3px 0 0",
              height: barsGrown ? `${Math.max(4, Math.round((d.count / maxBucket) * 100))}%` : 0,
              background: ACCENT, opacity: d.count === 0 ? 0.15 : 0.85,
              transition: `height 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${i * 20}ms`,
            }} />
            <span style={{ fontSize: 12, color: TEXT_FAINT, whiteSpace: "nowrap" }}>{hydrated ? d.label : ""}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, paddingTop: 12, borderTop: `1px solid ${BORDER}`, color: TEXT_SUB }}>
        <span><strong style={{ color: GREEN_FG, fontFamily: "var(--font-mono)" }}><CountUp value={stats.strong} format={formatNumber} /></strong> strong matches</span>
        <span><strong style={{ color: TEXT, fontFamily: "var(--font-mono)" }}>{stats.avgScore ?? "-"}</strong> avg score</span>
      </div>
    </div>
  );
}

/* ─── Recent analyses ───────────────────────────────────────────────────── */

export function RecentAnalyses({ analyses }) {
  const hydrated = useHydrated(); // clock/time-zone text waits for the browser
  const router = useRouter();
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow="Activity feed"
        title="Recent analyses"
        action={
          <Link href="/dashboard/candidates?sortBy=newest" style={{ fontSize: 13, fontWeight: 600, color: ACCENT_FG, textDecoration: "none" }}>
            View all →
          </Link>
        }
      />
      {analyses.length === 0 ? (
        <EmptyState title="No analyses yet" body="Upload your first CV to start screening candidates." actionLabel="Screen a CV" actionHref="/analyse" />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <caption className="sr-only">Recent candidate analyses</caption>
            <thead>
              <tr>
                {["Candidate", "Recruiter", "Stage", "Score", "Date"].map((h) => (
                  <th key={h} scope="col" style={{
                    padding: h === "Date" ? "8px 0 8px 12px" : "8px 12px 8px 0",
                    textAlign: h === "Score" || h === "Date" ? "right" : "left",
                    fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT,
                    borderBottom: `1px solid ${BORDER}`,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analyses.map((a, i) => {
                const href = `/dashboard/candidates/${a.candidateId ?? a.id}`;
                return (
                  <tr
                    key={a.id}
                    onClick={() => router.push(href)}
                    style={{ cursor: "pointer", borderBottom: `1px solid ${BORDER}`, "--stagger-delay": `${i * 40}ms` }}
                    className="hover:bg-[var(--mist)] transition-colors fade-up-in"
                  >
                    <td style={{ padding: "12px 12px 12px 0", minWidth: 0 }}>
                      <Link href={href} onClick={(e) => e.stopPropagation()} title={`${a.candidateName} - ${a.jobTitle}`} style={{ textDecoration: "none", display: "block" }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.candidateName}</p>
                        <p style={{ fontSize: 13, color: TEXT_SUB, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.jobTitle}{a.company ? ` · ${a.company}` : ""}</p>
                      </Link>
                    </td>
                    <td style={{ padding: "12px 12px 12px 0", fontSize: 14, color: TEXT_SUB, whiteSpace: "nowrap" }}>{a.recruiterName ?? "Unassigned"}</td>
                    <td style={{ padding: "12px 12px 12px 0" }}><StageBadge stage={a.stage} /></td>
                    <td style={{ padding: "12px 12px 12px 0", textAlign: "right" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: scoreColor(a.score), fontVariantNumeric: "tabular-nums" }}>{a.score ?? "-"}</span>
                    </td>
                    <td style={{ padding: "12px 0 12px 12px", textAlign: "right", fontSize: 13, color: TEXT_FAINT, whiteSpace: "nowrap" }}>{hydrated ? formatDate(a.createdAt) : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
