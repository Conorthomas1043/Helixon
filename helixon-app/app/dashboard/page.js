"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { STAGE_LABELS } from "@/lib/mock-data";

/* ─── Design tokens ─────────────────────────────────────────────────────── */

const BG        = "var(--mist)";
const SURFACE   = "var(--bg)";
const SURFACE2  = "var(--mist)";
const BORDER    = "var(--border)";
const BORDER2   = "var(--border-soft)";

const TEXT      = "var(--ink)";
const TEXT_SUB  = "var(--ink-soft)";
const TEXT_FAINT= "var(--ink-faint)";

const VIOLET    = "var(--forest)";
const VIOLET_FG = "var(--forest)";
const VIOLET_BG = "var(--mint)";

const CYAN      = "var(--gold)";
const CYAN_BG   = "rgba(192,138,45,0.12)";

const GREEN     = "var(--score-strong)";
const GREEN_FG  = "var(--score-strong)";
const GREEN_BG  = "var(--mint)";

const AMBER     = "var(--score-mid)";
const AMBER_FG  = "var(--score-mid)";
const AMBER_BG  = "rgba(180,83,9,0.10)";

const RED       = "var(--score-low)";
const RED_STRONG= "var(--score-low)";
const RED_BG    = "rgba(192,57,43,0.10)";

const CARD = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
};

/* ─── Data loading ──────────────────────────────────────────────────────── */

async function fetchDashboardData() {
  const res = await fetch("/api/dashboard-stats", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load dashboard data");
  const raw = await res.json();
  return {
    agency: { name: raw.agencyName, plan: raw.plan },
    recentAnalyses: raw.analyses ?? [],
  };
}

/* ─── Normalisation ─────────────────────────────────────────────────────── */

function normalizeAnalysis(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const score = typeof raw.score === "number" && !Number.isNaN(raw.score) ? raw.score : null;
  const createdDate = raw.createdAt ? new Date(raw.createdAt) : null;
  const createdAt = createdDate && !Number.isNaN(createdDate.getTime()) ? createdDate : null;
  return {
    id: raw.id ?? raw._id ?? `analysis-${index}`,
    candidateName: raw.candidateName ?? raw.candidate?.name ?? raw.candidate ?? "Unnamed candidate",
    jobTitle: raw.jobTitle ?? raw.job?.title ?? raw.job ?? "Unspecified role",
    company: raw.company ?? raw.job?.company ?? raw.client ?? null,
    recruiterName: raw.recruiterName ?? raw.recruiter?.name ?? raw.recruiter ?? null,
    status: raw.status === "processing" || raw.status === "failed" ? raw.status : "completed",
    stage: raw.stage && Object.prototype.hasOwnProperty.call(STAGE_LABELS, raw.stage) ? raw.stage : null,
    score,
    createdAt,
  };
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function formatDate(date) {
  if (!date) return "-";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatRelativeTime(date) {
  if (!date) return "-";
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

function formatNumber(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "-";
  return n.toLocaleString("en-GB");
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function scoreColor(score) {
  if (score === null || score === undefined) return TEXT_FAINT;
  if (score >= 80) return GREEN_FG;
  if (score >= 60) return AMBER_FG;
  return RED;
}

function scoreLabel(score) {
  if (score === null || score === undefined) return "No score";
  if (score >= 80) return "Strong";
  if (score >= 60) return "Moderate";
  return "Weak";
}

/* ─── Shared components ─────────────────────────────────────────────────── */

function ScorePill({ score }) {
  const color = scoreColor(score);
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span style={{ fontFamily: "var(--font-mono)", color, fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
        {score === null || score === undefined ? "-" : score}
      </span>
      <span style={{ color: TEXT_FAINT, fontSize: 11 }}>{scoreLabel(score)}</span>
    </div>
  );
}

function StageBadge({ stage }) {
  if (!stage || !STAGE_LABELS[stage]) {
    return <span style={{ color: TEXT_FAINT, fontSize: 11 }}>No stage</span>;
  }
  const isPlaced = stage === Object.keys(STAGE_LABELS)[Object.keys(STAGE_LABELS).length - 1];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 9999,
      background: isPlaced ? GREEN_BG : VIOLET_BG,
      color: isPlaced ? GREEN_FG : VIOLET_FG,
      border: `1px solid ${isPlaced ? "rgba(52,211,153,0.2)" : "rgba(167,139,250,0.2)"}`,
    }}>
      {STAGE_LABELS[stage]}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    completed: { bg: GREEN_BG, fg: GREEN_FG, border: "rgba(52,211,153,0.2)", label: "Completed" },
    processing: { bg: AMBER_BG, fg: AMBER_FG, border: "rgba(252,211,77,0.2)", label: "Processing" },
    failed: { bg: RED_BG, fg: RED, border: "rgba(239,68,68,0.2)", label: "Failed" },
  };
  const s = map[status] || map.completed;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 9999,
      background: s.bg,
      color: s.fg,
      border: `1px solid ${s.border}`,
    }}>
      {s.label}
    </span>
  );
}

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
      <div>
        {eyebrow && (
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, marginBottom: 4 }}>
            {eyebrow}
          </p>
        )}
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, color: TEXT, margin: 0 }}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, body, actionLabel, actionHref }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 24px" }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: VIOLET_BG, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={VIOLET_FG} strokeWidth="1.5">
          <path d="M9 12h6m-3-3v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
        </svg>
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4 }}>{title}</p>
      <p style={{ fontSize: 13, color: TEXT_SUB, maxWidth: 320, marginBottom: 16 }}>{body}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} style={{
          display: "inline-flex",
          alignItems: "center",
          fontSize: 13,
          fontWeight: 600,
          padding: "8px 16px",
          borderRadius: 8,
          background: VIOLET,
          color: "#fff",
          textDecoration: "none",
        }}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

/* ─── Header ────────────────────────────────────────────────────────────── */

function DashboardHeader({ agencyName, plan, subtitle, isRefreshing, refreshError, onRefresh }) {
  return (
    <header style={{
      ...CARD,
      padding: "28px 32px",
      display: "flex",
      flexWrap: "wrap",
      gap: 20,
      alignItems: "center",
      justifyContent: "space-between",
      background: `linear-gradient(135deg, ${SURFACE} 0%, rgba(124,58,237,0.06) 100%)`,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          {plan && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "3px 10px",
              borderRadius: 9999,
              background: VIOLET_BG,
              color: VIOLET_FG,
              border: `1px solid rgba(167,139,250,0.2)`,
            }}>
              {plan.name} plan
            </span>
          )}
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 600, color: TEXT, marginBottom: 6, marginTop: 0 }}>
          {getGreeting()}, <span style={{ color: VIOLET_FG }}>{agencyName}</span>
        </h1>
        <p style={{ fontSize: 14, color: TEXT_SUB, maxWidth: 520, marginBottom: 10, marginTop: 0 }}>{subtitle}</p>

        <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 20 }} aria-live="polite">
          {isRefreshing && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: TEXT_FAINT }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN_FG, display: "inline-block", animation: "pulse 1.5s infinite" }} aria-hidden="true" />
              Refreshing…
            </span>
          )}
          {!isRefreshing && refreshError && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, color: RED }}>
              Couldn't refresh - showing last data.
              <button type="button" onClick={onRefresh} style={{ color: RED, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 11 }}>
                Retry
              </button>
            </span>
          )}
          {!isRefreshing && !refreshError && (
            <button type="button" onClick={onRefresh} style={{ fontSize: 11, color: TEXT_FAINT, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Refresh ↺
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <Link href="/dashboard/candidates" style={{
          display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 600,
          padding: "8px 16px", borderRadius: 8, border: `1px solid ${BORDER2}`,
          color: TEXT_SUB, textDecoration: "none", background: SURFACE2,
        }}>
          Browse candidates
        </Link>
        <Link href="/dashboard/pipeline" style={{
          display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 600,
          padding: "8px 16px", borderRadius: 8, border: `1px solid ${BORDER2}`,
          color: TEXT_SUB, textDecoration: "none", background: SURFACE2,
        }}>
          Pipeline
        </Link>
        <Link href="/analyse" style={{
          display: "inline-flex", alignItems: "center", fontSize: 13, fontWeight: 600,
          padding: "8px 16px", borderRadius: 8,
          background: VIOLET, color: "#fff", textDecoration: "none",
        }}>
          + New analysis
        </Link>
      </div>
    </header>
  );
}

/* ─── KPIs ──────────────────────────────────────────────────────────────── */

function KpiCard({ label, value, sub, meter, accent }) {
  return (
    <div style={{ ...CARD, padding: 20 }}>
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, marginBottom: 10, marginTop: 0 }}>
        {label}
      </p>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 600, color: accent || TEXT, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </p>
      {typeof meter === "number" && (
        <div style={{ height: 3, background: BORDER2, borderRadius: 9999, marginTop: 12, marginBottom: 6, overflow: "hidden" }}>
          <div style={{ height: 3, width: `${Math.min(100, Math.max(0, meter))}%`, background: VIOLET, borderRadius: 9999 }} />
        </div>
      )}
      {sub && <p style={{ fontSize: 12, color: TEXT_FAINT, marginTop: typeof meter === "number" ? 2 : 8, marginBottom: 0 }}>{sub}</p>}
    </div>
  );
}

function DashboardKpis({ totals }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-live="polite">
      <KpiCard label="Total analyses" value={formatNumber(totals.total)} sub={`${formatNumber(totals.last7)} in the last 7 days`} />
      <KpiCard label="Strong matches" value={formatNumber(totals.strongMatches)} sub={totals.completed > 0 ? `${totals.strongMatchPct}% of completed` : "No completed yet"} accent={GREEN_FG} />
      <KpiCard label="In pipeline" value={formatNumber(totals.inPipeline)} sub="Active, not yet placed" accent={CYAN} />
      <KpiCard label="Avg. score" value={totals.completed > 0 ? totals.avgScore : "-"} sub={totals.completed > 0 ? "Across completed" : "No completed yet"} meter={totals.completed > 0 ? totals.avgScore : undefined} accent={VIOLET_FG} />
    </div>
  );
}

/* ─── Pipeline ──────────────────────────────────────────────────────────── */

function PipelineSnapshot({ stageOrder, stageCounts, maxCount }) {
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow="Candidate pipeline"
        title="Where candidates stand"
        action={
          <Link href="/dashboard/pipeline" style={{ fontSize: 12, fontWeight: 600, color: VIOLET_FG, textDecoration: "none" }}>
            Open pipeline →
          </Link>
        }
      />
      {maxCount === 0 ? (
        <EmptyState title="No candidates in progress" body="Candidates will appear here once analyses complete." actionLabel="New analysis" actionHref="/analyse" />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${stageOrder.length}, 1fr)`, gap: 10 }}>
          {stageOrder.map((stageKey) => {
            const count = stageCounts[stageKey] ?? 0;
            const heightPct = maxCount > 0 ? Math.max(8, Math.round((count / maxCount) * 100)) : 0;
            const isPlaced = stageKey === stageOrder[stageOrder.length - 1];
            return (
              <Link key={stageKey} href={`/dashboard/pipeline?stage=${stageKey}`} style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 8px", borderRadius: 10, border: `1px solid ${BORDER}`, background: SURFACE2 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 600, color: TEXT, lineHeight: 1 }}>{formatNumber(count)}</span>
                <div style={{ width: "100%", height: 36, background: BORDER2, borderRadius: 6, marginTop: 8, marginBottom: 8, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                  <div style={{ width: "100%", height: `${heightPct}%`, background: isPlaced ? GREEN : VIOLET, borderRadius: "0 0 4px 4px", transition: "height 0.3s" }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: TEXT_FAINT, textAlign: "center", lineHeight: 1.3 }}>
                  {STAGE_LABELS[stageKey]}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Usage ─────────────────────────────────────────────────────────────── */

function UsageSummary({ plan }) {
  const hasLimit = plan && typeof plan.analysesLimit === "number" && plan.analysesLimit > 0;
  const used = plan?.analysesUsed ?? 0;
  const limit = plan?.analysesLimit ?? null;
  const remaining = hasLimit ? Math.max(0, limit - used) : null;
  const pct = hasLimit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isOverLimit = hasLimit && used >= limit;

  return (
    <div style={{ ...CARD, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
      <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, marginTop: 0, marginBottom: 6 }}>
        {plan?.name ? `${plan.name} plan` : "Plan usage"}
      </p>
      {hasLimit ? (
        <>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: TEXT, margin: "0 0 2px 0", fontVariantNumeric: "tabular-nums" }}>
            {formatNumber(used)} <span style={{ color: TEXT_FAINT, fontWeight: 400 }}>/ {formatNumber(limit)}</span>
          </p>
          <p style={{ fontSize: 12, color: TEXT_FAINT, margin: "0 0 12px 0" }}>analyses this cycle</p>
          <div style={{ height: 4, background: BORDER2, borderRadius: 9999, overflow: "hidden" }}>
            <div style={{ height: 4, width: `${pct}%`, background: pct >= 90 ? RED : VIOLET, borderRadius: 9999 }} />
          </div>
          <p style={{ fontSize: 12, marginTop: 6, color: isOverLimit ? RED : TEXT_FAINT, marginBottom: 0 }}>
            {isOverLimit ? "Plan limit reached" : `${formatNumber(remaining)} analyses remaining`}
          </p>
          {isOverLimit && (
            <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: RED_BG, border: `1px solid rgba(239,68,68,0.2)`, fontSize: 12, color: RED, lineHeight: 1.5 }}>
              Upgrade your plan to continue screening.
            </div>
          )}
        </>
      ) : (
        <p style={{ fontSize: 13, color: TEXT_SUB, marginTop: 8 }}>No plan limit on file.</p>
      )}
      <Link href="/dashboard/billing" style={{ fontSize: 12, fontWeight: 600, marginTop: "auto", paddingTop: 16, color: VIOLET_FG, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
        Upgrade plan →
      </Link>
    </div>
  );
}

/* ─── Attention panel ───────────────────────────────────────────────────── */

function AttentionPanel({ items }) {
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading eyebrow="Priority" title="Needs your attention" />
      {items.length === 0 ? (
        <EmptyState title="Nothing needs attention" body="No failed analyses, stalled candidates, or unreviewed strong matches right now." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => (
            <li key={item.id} style={{ borderTop: `1px solid ${BORDER}` }}>
              <Link href={item.actionHref} title={`${item.candidateName} - ${item.jobTitle}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 8px",
                borderRadius: 10, textDecoration: "none",
              }}
                className="hover:bg-[var(--mist)] transition-colors"
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.candidateName}</p>
                  <p style={{ fontSize: 12, color: TEXT_SUB, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.jobTitle}</p>
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 600,
                  padding: "3px 10px", borderRadius: 9999, whiteSpace: "nowrap",
                  background: item.tone.bg, color: item.tone.fg,
                }}>
                  {item.reasonLabel}
                </span>
                <span style={{ fontSize: 11, color: TEXT_FAINT, whiteSpace: "nowrap", flexShrink: 0 }}>{formatRelativeTime(item.createdAt)}</span>
                {item.score !== null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: scoreColor(item.score), flexShrink: 0, width: 32, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.score}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Top candidates ────────────────────────────────────────────────────── */

function TopCandidates({ candidates }) {
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading eyebrow="Top talent" title="Strongest candidates" />
      {candidates.length === 0 ? (
        <EmptyState title="No strong matches yet" body="Candidates scoring 80 or above will appear here." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {candidates.map((c, i) => (
            <li key={c.id} style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}>
              <Link href={`/dashboard/candidates/${c.id}`} title={`${c.candidateName} - ${c.jobTitle}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 8px",
                borderRadius: 10, textDecoration: "none",
              }} className="hover:bg-[var(--mist)] transition-colors">
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: VIOLET_BG, color: VIOLET_FG, fontSize: 12, fontWeight: 700,
                }}>
                  {c.candidateName[0]}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.candidateName}</p>
                  <p style={{ fontSize: 12, color: TEXT_SUB, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
    </div>
  );
}

/* ─── Activity overview ─────────────────────────────────────────────────── */

function ActivityOverview({ analyses }) {
  const [windowDays, setWindowDays] = useState(7);

  const stats = useMemo(() => {
    const now = Date.now();
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
      completed: current.filter((a) => a.status === "completed").length,
      processing: current.filter((a) => a.status === "processing").length,
      failed: current.filter((a) => a.status === "failed").length,
    };
  }, [analyses, windowDays]);

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
                fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 9999,
                background: windowDays === d ? VIOLET : "transparent",
                color: windowDays === d ? "#fff" : TEXT_FAINT,
                border: "none", cursor: "pointer",
              }}>{d}D</button>
            ))}
          </div>
        }
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 600, color: TEXT, fontVariantNumeric: "tabular-nums" }}>{formatNumber(stats.currentCount)}</span>
        <span style={{ fontSize: 12, color: TEXT_SUB }}>in the last {windowDays} days</span>
      </div>
      <p style={{ fontSize: 12, marginBottom: 16, color: delta >= 0 ? GREEN_FG : RED }}>
        {delta === 0 ? `Same as previous ${windowDays} days` : `${delta > 0 ? "+" : ""}${delta} vs. previous ${windowDays} days`}
      </p>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 56, marginBottom: 12 }} role="img" aria-label={`Analyses per day over ${windowDays} days`}>
        {stats.dayBuckets.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 3 }}>
            <div style={{
              width: "100%", borderRadius: "3px 3px 0 0",
              height: `${Math.max(4, Math.round((d.count / maxBucket) * 100))}%`,
              background: VIOLET, opacity: d.count === 0 ? 0.15 : 0.85,
            }} />
            <span style={{ fontSize: 9, color: TEXT_FAINT, whiteSpace: "nowrap" }}>{d.label}</span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, paddingTop: 12, borderTop: `1px solid ${BORDER}`, color: TEXT_SUB }}>
        <span><strong style={{ color: GREEN_FG, fontFamily: "var(--font-mono)" }}>{formatNumber(stats.completed)}</strong> completed</span>
        <span><strong style={{ color: AMBER_FG, fontFamily: "var(--font-mono)" }}>{formatNumber(stats.processing)}</strong> processing</span>
        <span><strong style={{ color: RED, fontFamily: "var(--font-mono)" }}>{formatNumber(stats.failed)}</strong> failed</span>
      </div>
    </div>
  );
}

/* ─── Active jobs ───────────────────────────────────────────────────────── */

function ActiveJobs({ jobs }) {
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow="Roles"
        title="Active jobs"
        action={<Link href="/dashboard/jobs" style={{ fontSize: 12, fontWeight: 600, color: VIOLET_FG, textDecoration: "none" }}>All jobs →</Link>}
      />
      {jobs.length === 0 ? (
        <EmptyState title="No active jobs" body="Jobs appear here once candidates have been analysed against them." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {jobs.map((job) => (
            <li key={job.key} style={{ padding: "12px 0", borderTop: `1px solid ${BORDER}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${job.jobTitle}${job.company ? ` · ${job.company}` : ""}`}>
                  {job.jobTitle}
                  {job.company && <span style={{ color: TEXT_SUB, fontWeight: 400 }}> · {job.company}</span>}
                </p>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: TEXT_SUB, flexShrink: 0 }}>{formatNumber(job.candidateCount)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 4, background: BORDER2, borderRadius: 9999, overflow: "hidden", display: "flex" }}>
                  {job.stageSegments.map((seg) =>
                    seg.pct > 0 ? (
                      <div key={seg.key} style={{ width: `${seg.pct}%`, background: seg.isPlaced ? GREEN : VIOLET, opacity: 0.8 }} />
                    ) : null
                  )}
                </div>
                <span style={{ fontSize: 11, color: TEXT_FAINT, flexShrink: 0 }}>{formatNumber(job.strongMatches)} strong</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Recruiter performance ─────────────────────────────────────────────── */

function RecruiterPerformance({ recruiters }) {
  if (recruiters.length === 0) return null;
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow="Team"
        title="Recruiter performance"
        action={<Link href="/dashboard/analytics" style={{ fontSize: 12, fontWeight: 600, color: VIOLET_FG, textDecoration: "none" }}>Full analytics →</Link>}
      />
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {recruiters.map((r) => (
          <li key={r.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderTop: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: VIOLET_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: VIOLET_FG, flexShrink: 0 }}>
                {r.name[0]}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.name}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: TEXT_SUB, flexShrink: 0 }}>
              <span><strong style={{ color: TEXT, fontFamily: "var(--font-mono)" }}>{formatNumber(r.completed)}</strong> analysed</span>
              <span><strong style={{ color: TEXT, fontFamily: "var(--font-mono)" }}>{r.avgScore ?? "-"}</strong> avg</span>
              <span><strong style={{ color: GREEN_FG, fontFamily: "var(--font-mono)" }}>{formatNumber(r.placements)}</strong> placed</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Recent analyses ───────────────────────────────────────────────────── */

function RecentAnalyses({ analyses }) {
  const router = useRouter();
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading eyebrow="Activity feed" title="Recent analyses" />
      {analyses.length === 0 ? (
        <EmptyState title="No analyses yet" body="Upload your first CV to start screening candidates." actionLabel="New analysis" actionHref="/analyse" />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <caption className="sr-only">Recent candidate analyses</caption>
            <thead>
              <tr>
                {["Candidate", "Recruiter", "Stage", "Status", "Score", "Date"].map((h, i) => (
                  <th key={h} scope="col" style={{
                    padding: "8px 12px 8px 0",
                    fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT,
                    borderBottom: `1px solid ${BORDER}`,
                    display: h === "Recruiter" ? "table-cell" : undefined,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analyses.map((a) => {
                const href = a.status === "completed" ? `/dashboard/candidates/${a.id}` : `/analyse/${a.id}`;
                return (
                  <tr key={a.id} onClick={() => router.push(href)} style={{ cursor: "pointer", borderBottom: `1px solid ${BORDER}` }} className="hover:bg-[var(--mist)] transition-colors">
                    <td style={{ padding: "12px 12px 12px 0", minWidth: 0 }}>
                      <Link href={href} onClick={(e) => e.stopPropagation()} title={`${a.candidateName} - ${a.jobTitle}`} style={{ textDecoration: "none", display: "block" }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.candidateName}</p>
                        <p style={{ fontSize: 12, color: TEXT_SUB, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.jobTitle}{a.company ? ` · ${a.company}` : ""}</p>
                      </Link>
                    </td>
                    <td style={{ padding: "12px 12px 12px 0", fontSize: 13, color: TEXT_SUB, whiteSpace: "nowrap" }}>{a.recruiterName ?? "Unassigned"}</td>
                    <td style={{ padding: "12px 12px 12px 0" }}><StageBadge stage={a.stage} /></td>
                    <td style={{ padding: "12px 12px 12px 0" }}><StatusBadge status={a.status} /></td>
                    <td style={{ padding: "12px 12px 12px 0", textAlign: "right" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: scoreColor(a.score), fontVariantNumeric: "tabular-nums" }}>{a.score ?? "-"}</span>
                    </td>
                    <td style={{ padding: "12px 0 12px 12px", textAlign: "right", fontSize: 12, color: TEXT_FAINT, whiteSpace: "nowrap" }}>{formatDate(a.createdAt)}</td>
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

/* ─── Footer ────────────────────────────────────────────────────────────── */

function DashboardFooter() {
  return (
    <footer style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 20, fontSize: 12, color: TEXT_FAINT, borderTop: `1px solid ${BORDER}` }}>
      <span>Helixon - recruiter dashboard</span>
      <nav style={{ display: "flex", alignItems: "center", gap: 20 }} aria-label="Support links">
        {[["FAQ", "/faq"], ["Contact", "/contact"], ["Privacy", "/privacy"]].map(([label, href]) => (
          <Link key={href} href={href} style={{ color: TEXT_FAINT, textDecoration: "none" }} className="hover:text-white transition-colors">{label}</Link>
        ))}
      </nav>
    </footer>
  );
}

/* ─── Skeleton ──────────────────────────────────────────────────────────── */

function Block({ style = {} }) {
  return <div className="animate-pulse motion-reduce:animate-none" style={{ background: SURFACE2, borderRadius: 8, ...style }} />;
}

function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} aria-busy="true" aria-label="Loading dashboard">
      <div style={{ ...CARD, padding: 28 }}>
        <Block style={{ height: 14, width: 120, marginBottom: 14 }} />
        <Block style={{ height: 28, width: 280, marginBottom: 10 }} />
        <Block style={{ height: 14, width: 360 }} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ ...CARD, padding: 20 }}>
            <Block style={{ height: 10, width: 80, marginBottom: 12 }} />
            <Block style={{ height: 28, width: 60 }} />
          </div>
        ))}
      </div>
      <div style={{ ...CARD, padding: 24 }}>
        <Block style={{ height: 16, width: 180, marginBottom: 20 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10 }}>
          {[...Array(6)].map((_, i) => <Block key={i} style={{ height: 80 }} />)}
        </div>
      </div>
    </div>
  );
}

/* ─── Error ─────────────────────────────────────────────────────────────── */

function DashboardError({ onRetry }) {
  return (
    <div style={{ ...CARD, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Unable to load dashboard</p>
      <p style={{ fontSize: 13, color: TEXT_SUB, maxWidth: 320, marginBottom: 20 }}>Something went wrong while loading your recruitment data.</p>
      <button type="button" onClick={onRetry} style={{ fontSize: 13, fontWeight: 600, padding: "10px 20px", borderRadius: 8, background: VIOLET, color: "#fff", border: "none", cursor: "pointer" }}>
        Try again
      </button>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

/* ─── Welcome back banner ───────────────────────────────────────────────── */

function WelcomeBackBanner({ name, onDismiss }) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 12,
        background: GREEN_BG,
        border: `1px solid rgba(16,185,129,0.25)`,
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 500, color: GREEN_FG }}>
        Welcome back{name ? `, ${name}` : ""}! 👋
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{ background: "none", border: "none", color: GREEN_FG, cursor: "pointer", fontSize: 13, padding: 4, opacity: 0.7 }}
      >
        ✕
      </button>
    </div>
  );
}

export default function AgencyDashboardPage() {
  const [data, setData] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [me, setMe] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsFetching(true);
    fetchDashboardData()
      .then((d) => { if (!cancelled) { setData(d); setHasError(false); } })
      .catch(() => { if (!cancelled) setHasError(true); })
      .finally(() => { if (!cancelled) setIsFetching(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  // Current user, for the account menu and the welcome banner's name.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setMe(d.user); })
      .catch(() => {});
  }, []);

  // Shows the "Welcome back" banner exactly once per login, using a flag
  // the login page sets right before redirecting here. Cleared immediately
  // so a manual refresh (or navigating back to /dashboard later) doesn't
  // show it again until the next actual login.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("helixon_just_logged_in")) {
        setShowWelcome(true);
        sessionStorage.removeItem("helixon_just_logged_in");
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!showWelcome) return;
    const t = setTimeout(() => setShowWelcome(false), 6000);
    return () => clearTimeout(t);
  }, [showWelcome]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const stageOrder = useMemo(() => Object.keys(STAGE_LABELS ?? {}), []);
  const lastStageKey = stageOrder[stageOrder.length - 1];
  const firstStageKey = stageOrder[0];

  const model = useMemo(() => {
    const rawAnalyses = data?.recentAnalyses ?? [];
    const analyses = rawAnalyses.map((raw, i) => normalizeAnalysis(raw, i)).filter(Boolean).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

    const completed = analyses.filter((a) => a.status === "completed");
    const processing = analyses.filter((a) => a.status === "processing");
    const failed = analyses.filter((a) => a.status === "failed");

    const strongMatches = completed.filter((a) => a.score !== null && a.score >= 80);
    const avgScore = completed.length ? Math.round(completed.reduce((sum, a) => sum + (a.score ?? 0), 0) / completed.length) : 0;

    const now = Date.now();
    const DAY = 86400000;
    const last7 = analyses.filter((a) => a.createdAt && now - a.createdAt.getTime() < 7 * DAY);

    const inPipeline = completed.filter((a) => a.stage && a.stage !== lastStageKey).length;

    const stageCounts = {};
    stageOrder.forEach((key) => { stageCounts[key] = completed.filter((a) => a.stage === key).length; });
    const maxStageCount = Math.max(0, ...Object.values(stageCounts));

    const attentionItems = [];
    const midStages = stageOrder.slice(1, -1);

    failed.forEach((a) => attentionItems.push({ id: `${a.id}-failed`, candidateName: a.candidateName, jobTitle: a.jobTitle, score: null, createdAt: a.createdAt, reasonLabel: "Analysis failed", tone: { bg: RED_BG, fg: RED }, actionLabel: "Retry", actionHref: `/analyse/${a.id}`, priority: 0 }));
    processing.filter((a) => a.createdAt && now - a.createdAt.getTime() > 12 * 3600000).forEach((a) => attentionItems.push({ id: `${a.id}-processing`, candidateName: a.candidateName, jobTitle: a.jobTitle, score: null, createdAt: a.createdAt, reasonLabel: "Still processing", tone: { bg: AMBER_BG, fg: AMBER_FG }, actionLabel: "Open", actionHref: `/analyse/${a.id}`, priority: 1 }));
    completed.filter((a) => a.score !== null && a.score >= 80 && (a.stage === firstStageKey || a.stage === null)).forEach((a) => attentionItems.push({ id: `${a.id}-unreviewed`, candidateName: a.candidateName, jobTitle: a.jobTitle, score: a.score, createdAt: a.createdAt, reasonLabel: a.stage ? `Strong match · ${STAGE_LABELS[a.stage]}` : "Strong match · Unstaged", tone: { bg: GREEN_BG, fg: GREEN_FG }, actionLabel: "Review", actionHref: `/dashboard/candidates/${a.id}`, priority: 2 }));
    completed.filter((a) => midStages.includes(a.stage) && a.createdAt && now - a.createdAt.getTime() > 5 * DAY).forEach((a) => attentionItems.push({ id: `${a.id}-stalled`, candidateName: a.candidateName, jobTitle: a.jobTitle, score: a.score, createdAt: a.createdAt, reasonLabel: `Stalled · ${STAGE_LABELS[a.stage]}`, tone: { bg: AMBER_BG, fg: AMBER_FG }, actionLabel: "Review", actionHref: `/dashboard/candidates/${a.id}`, priority: 3 }));
    completed.filter((a) => a.stage === null && !(a.score !== null && a.score >= 80)).forEach((a) => attentionItems.push({ id: `${a.id}-unstaged`, candidateName: a.candidateName, jobTitle: a.jobTitle, score: a.score, createdAt: a.createdAt, reasonLabel: "Awaiting stage", tone: { bg: `rgba(71,85,105,0.15)`, fg: TEXT_SUB }, actionLabel: "Stage", actionHref: `/dashboard/candidates/${a.id}`, priority: 4 }));

    attentionItems.sort((a, b) => a.priority !== b.priority ? a.priority - b.priority : (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

    const topCandidates = [...completed].filter((a) => a.score !== null).sort((a, b) => b.score - a.score).slice(0, 5);

    const jobMap = new Map();
    completed.forEach((a) => {
      const key = `${a.jobTitle}__${a.company ?? ""}`;
      if (!jobMap.has(key)) jobMap.set(key, { key, jobTitle: a.jobTitle, company: a.company, candidateCount: 0, strongMatches: 0, stageCounts: {} });
      const job = jobMap.get(key);
      job.candidateCount += 1;
      if (a.score !== null && a.score >= 80) job.strongMatches += 1;
      if (a.stage) job.stageCounts[a.stage] = (job.stageCounts[a.stage] ?? 0) + 1;
    });
    const jobs = Array.from(jobMap.values()).map((job) => ({
      ...job,
      stageSegments: stageOrder.map((key) => ({ key, pct: job.candidateCount > 0 ? Math.round(((job.stageCounts[key] ?? 0) / job.candidateCount) * 100) : 0, isPlaced: key === lastStageKey })),
    })).sort((a, b) => b.candidateCount - a.candidateCount).slice(0, 5);

    const recruiterMap = new Map();
    completed.forEach((a) => {
      if (!a.recruiterName) return;
      if (!recruiterMap.has(a.recruiterName)) recruiterMap.set(a.recruiterName, { name: a.recruiterName, completed: 0, scoreSum: 0, scoreCount: 0, placements: 0 });
      const r = recruiterMap.get(a.recruiterName);
      r.completed += 1;
      if (a.score !== null) { r.scoreSum += a.score; r.scoreCount += 1; }
      if (a.stage === lastStageKey) r.placements += 1;
    });
    const recruiters = Array.from(recruiterMap.values()).map((r) => ({ ...r, avgScore: r.scoreCount > 0 ? Math.round(r.scoreSum / r.scoreCount) : null })).sort((a, b) => b.placements - a.placements || (b.avgScore ?? 0) - (a.avgScore ?? 0)).slice(0, 4);

    return { analyses, totals: { total: analyses.length, completed: completed.length, processing: processing.length, failed: failed.length, strongMatches: strongMatches.length, strongMatchPct: completed.length ? Math.round((strongMatches.length / completed.length) * 100) : 0, avgScore, last7: last7.length, inPipeline }, stageCounts, maxStageCount, attentionItems: attentionItems.slice(0, 6), topCandidates, jobs, recruiters };
  }, [data, stageOrder, lastStageKey, firstStageKey]);

  const agencyName = data?.agency?.name ?? "your agency";
  const plan = data?.agency?.plan ?? null;

  const subtitle = useMemo(() => {
    if (!data) return "";
    if (model.analyses.length === 0) return "Upload your first CV to start screening candidates.";
    const ac = model.attentionItems.length;
    const sc = model.totals.strongMatches;
    if (ac > 0) return `${ac} ${ac === 1 ? "item needs" : "items need"} your attention, and ${sc} strong ${sc === 1 ? "candidate is" : "candidates are"} ready to move forward.`;
    if (sc > 0) return `Your pipeline is in good shape - ${sc} strong ${sc === 1 ? "candidate is" : "candidates are"} ready to move forward.`;
    return "Your pipeline is in good shape. Here's what's been happening lately.";
  }, [data, model]);

  return (
    <main style={{ minHeight: "100vh", background: BG }}>
      <DashboardNav />
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        {showWelcome && (
          <WelcomeBackBanner name={me?.firstName} onDismiss={() => setShowWelcome(false)} />
        )}
        {!data && isFetching && <DashboardSkeleton />}
        {!data && !isFetching && hasError && <DashboardError onRetry={retry} />}
        {data && (
          <>
            <DashboardHeader agencyName={agencyName} plan={plan} subtitle={subtitle} isRefreshing={isFetching} refreshError={!isFetching && hasError} onRefresh={retry} />

            {model.analyses.length === 0 ? (
              <div style={CARD}>
                <EmptyState title="No candidates yet" body="Your pipeline is empty. Upload your first CV to get started." actionLabel="New analysis" actionHref="/analyse" />
              </div>
            ) : (
              <>
                <DashboardKpis totals={model.totals} />

                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
                  <PipelineSnapshot stageOrder={stageOrder} stageCounts={model.stageCounts} maxCount={model.maxStageCount} />
                  <UsageSummary plan={plan} />
                </div>

                <AttentionPanel items={model.attentionItems} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TopCandidates candidates={model.topCandidates} />
                  <ActivityOverview analyses={model.analyses} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ActiveJobs jobs={model.jobs} />
                  <RecruiterPerformance recruiters={model.recruiters} />
                </div>

                <RecentAnalyses analyses={model.analyses.slice(0, 8)} />
              </>
            )}

            <DashboardFooter />
          </>
        )}
      </div>
    </main>
  );
}