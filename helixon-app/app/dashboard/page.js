"use client";

import { PulseSurvey } from "@/components/dashboard/research";
import { useNow } from "@/lib/hooks/useNow";
import { track } from "@/lib/analytics";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import DashboardNav from "@/components/DashboardNav";
import CountUp from "@/components/dashboard/CountUp";
import { STAGE_LABELS, FUNNEL_ORDER, STAGE_COLORS } from "@/lib/stage-labels";
import { computeCandidateStats } from "@/lib/dashboard-model";
import { getFollowUps, completeNextAction, getPerformance } from "@/lib/dashboard-api";
import { METRICS, METRIC_KEYS } from "@/lib/performance";
import { STRONG_MATCH_MIN, REVIEW_MIN, scoreBandLabel } from "@/lib/scoreBands";
import { formatDate as fmtDate } from "@/lib/format";
import { Button, EmptyState as KitEmptyState, SectionHeading, Skeleton as Block } from "@/components/ui";

const formatDate = (date) => fmtDate(date, { withTime: true });

/* ─── Design tokens ─────────────────────────────────────────────────────── */

const BG        = "var(--mist)";
const SURFACE   = "var(--bg)";
const SURFACE2  = "var(--mist)";
const BORDER    = "var(--border)";
const BORDER2   = "var(--border-soft)";

const TEXT      = "var(--ink)";
const TEXT_SUB  = "var(--ink-soft)";
const TEXT_FAINT= "var(--ink-faint)";

const ACCENT    = "var(--forest)";
const ACCENT_FG = "var(--forest)";
const ACCENT_BG = "var(--mint)";

const GOLD      = "var(--gold)";
const GOLD_BG   = "rgba(192,138,45,0.12)";

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
  // The page reads agencyName/plan at the top level - these used to be
  // nested under `agency`, so the header never showed the agency name and
  // the plan card always said "No plan limit on file".
  return {
    agencyName: raw.agencyName ?? null,
    plan: raw.plan ?? null,
    recentAnalyses: raw.analyses ?? [],
    truncated: raw.truncated === true,
  };
}

/* ─── Normalisation ─────────────────────────────────────────────────────── */

function normalizeAnalysis(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const score = typeof raw.score === "number" && !Number.isNaN(raw.score) ? raw.score : null;
  const createdDate = raw.createdAt ? new Date(raw.createdAt) : null;
  const createdAt = createdDate && !Number.isNaN(createdDate.getTime()) ? createdDate : null;
  const activityDate = raw.lastActivityAt ? new Date(raw.lastActivityAt) : null;
  const lastActivityAt = activityDate && !Number.isNaN(activityDate.getTime()) ? activityDate : null;
  return {
    id: raw.id ?? raw._id ?? `analysis-${index}`,
    candidateId: raw.candidateId ?? null,
    candidateName: raw.candidateName ?? raw.candidate?.name ?? raw.candidate ?? "Unnamed candidate",
    jobId: raw.jobId ?? null,
    jobTitle: raw.jobTitle ?? raw.job?.title ?? raw.job ?? "Unspecified role",
    company: raw.company ?? raw.job?.company ?? raw.client ?? null,
    recruiterId: raw.recruiterId ?? null,
    recruiterName: raw.recruiterName ?? raw.recruiter?.name ?? raw.recruiter ?? null,
    status: raw.status === "processing" || raw.status === "failed" ? raw.status : "completed",
    stage: raw.stage && Object.prototype.hasOwnProperty.call(STAGE_LABELS, raw.stage) ? raw.stage : null,
    score,
    createdAt,
    lastActivityAt,
    nextAction: raw.nextAction?.label ? raw.nextAction : null,
  };
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

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
  if (score >= STRONG_MATCH_MIN) return GREEN_FG;
  if (score >= REVIEW_MIN) return AMBER_FG;
  return RED;
}

function scoreLabel(score) {
  return scoreBandLabel(score);
}

/* ─── Shared components ─────────────────────────────────────────────────── */

function ScorePill({ score }) {
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

function StageBadge({ stage }) {
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

function EmptyState({ title, body, actionLabel, actionHref }) {
  return (
    <KitEmptyState
      framed={false}
      icon="plus"
      title={title}
      body={body}
      action={
        actionLabel && actionHref ? (
          <Button variant="primary" href={actionHref}>
            {actionLabel}
          </Button>
        ) : null
      }
    />
  );
}

/* ─── First run ─────────────────────────────────────────────────────────── */

// What a brand-new account sees instead of a wall of zeros. It used to open
// on five empty business KPIs, an "All clear" risks panel and an empty
// agenda, with the one useful action ("Upload your first CV") below the
// fold. A short checklist gives the first session a clear goal; the
// workspace step starts ticked, because it's done (paying and naming the
// agency created it) and a list that's already under way is one people
// finish. It goes away by itself once the first CV has been screened.
function GettingStarted({ hasJob, showTeam }) {
  const steps = [
    { key: "workspace", title: "Set up your workspace", body: "Your agency's Helixon is ready.", done: true },
    { key: "analyse", title: "Screen your first CV", body: "Score a CV against a role and see the evidence behind it. It takes under a minute.", href: "/analyse", cta: "Screen a CV", primary: true },
    { key: "job", title: "Add a job you're working on", body: "Keep every candidate for a role, their scores and their stage in one pipeline.", href: "/dashboard/jobs?new=1", cta: "Add a job", done: hasJob },
    { key: "import", title: "Bring in candidates you already have", body: "Import from a spreadsheet or your old system so search covers everyone.", href: "/dashboard/import", cta: "Import" },
    showTeam && { key: "team", title: "Invite your team", body: "Shortlists, notes and scores are shared, with a record of who did what.", href: "/dashboard/team", cta: "Invite" },
  ].filter(Boolean);
  const doneCount = steps.filter((st) => st.done).length;

  return (
    <section style={{ ...CARD, padding: "24px 28px" }} aria-labelledby="getting-started-title">
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, margin: "0 0 4px" }}>Getting started</p>
          <h2 id="getting-started-title" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: TEXT, margin: 0 }}>
            Get your first shortlist in a few minutes
          </h2>
        </div>
        <p style={{ fontSize: 14, color: TEXT_SUB, margin: 0 }}>{doneCount} of {steps.length} done</p>
      </div>
      <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount}
        style={{ height: 4, borderRadius: 9999, background: BORDER2, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ width: `${(doneCount / steps.length) * 100}%`, height: "100%", background: ACCENT, borderRadius: 9999 }} />
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((st) => (
          <li key={st.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderTop: `1px solid ${BORDER2}` }}>
            <span aria-hidden="true" style={{
              width: 24, height: 24, flexShrink: 0, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center",
              background: st.done ? ACCENT : "transparent", border: `1.5px solid ${st.done ? ACCENT : st.primary ? ACCENT : BORDER}`,
            }}>
              {st.done && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              )}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: st.done ? TEXT_FAINT : TEXT, margin: 0, textDecoration: st.done ? "line-through" : "none" }}>
                {st.title}<span className="sr-only">{st.done ? " (done)" : ""}</span>
              </p>
              {!st.done && <p style={{ fontSize: 14, color: TEXT_SUB, margin: "2px 0 0" }}>{st.body}</p>}
            </div>
            {!st.done && st.href && (
              <Link href={st.href} onClick={() => track("onboarding_step_clicked", { step: st.key })} style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center", minHeight: 36, fontSize: 14, fontWeight: 600, padding: "0 14px", borderRadius: 10, textDecoration: "none",
                background: st.primary ? ACCENT : "transparent", color: st.primary ? "#fff" : TEXT, border: st.primary ? "none" : `1.5px solid ${BORDER}`,
              }}>
                {st.cta}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ─── Joining a team ────────────────────────────────────────────────────── */

// For someone invited into a workspace that's already running: the agency's
// checklist above doesn't apply (it's for an empty workspace), so they used
// to land on a full dashboard with no orientation. A short, dismissible
// list of where things are. Structured orientation measurably speeds how
// fast newcomers become productive (Bauer, Bodner, Erdogan, Truxillo &
// Tucker, 2007, "Newcomer adjustment during organizational socialization:
// A meta-analytic review", Journal of Applied Psychology 92(3)).
const JOINED_KEY = "helixon_team_welcome_dismissed";

function TeamWelcome({ agencyName, onDismiss }) {
  const steps = [
    { key: "jobs", title: "Find the jobs you're working on", body: "Each job keeps its candidates, scores and stages together.", href: "/dashboard/jobs", cta: "Open jobs" },
    { key: "pipeline", title: "See how your team moves candidates", body: "The pipeline shows every stage your agency uses.", href: "/dashboard/pipeline", cta: "Open pipeline" },
    { key: "analyse", title: "Screen your first CV", body: "Score a CV against one of the team's jobs, or a new one.", href: "/analyse", cta: "Screen a CV", primary: true },
  ];
  return (
    <section style={{ ...CARD, padding: "22px 26px" }} aria-labelledby="team-welcome-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, margin: "0 0 4px" }}>New to the team</p>
          <h2 id="team-welcome-title" style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: TEXT, margin: 0 }}>
            Welcome to {agencyName || "your agency's"} Helixon
          </h2>
          <p style={{ fontSize: 14, color: TEXT_SUB, margin: "4px 0 0" }}>Three places to start. Press <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 13, padding: "1px 5px", border: `1px solid ${BORDER}`, borderRadius: 4 }}>?</kbd> anywhere for keyboard shortcuts.</p>
        </div>
        <button type="button" onClick={onDismiss} style={{ fontSize: 14, color: TEXT_SUB, textDecoration: "underline", background: "none", border: 0, cursor: "pointer", minHeight: 32 }}>
          Got it
        </button>
      </div>
      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((st, i) => (
          <li key={st.key} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderTop: `1px solid ${BORDER2}` }}>
            <span aria-hidden="true" style={{ width: 24, height: 24, flexShrink: 0, borderRadius: 9999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: ACCENT_BG, color: ACCENT_FG }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0 }}>{st.title}</p>
              <p style={{ fontSize: 14, color: TEXT_SUB, margin: "2px 0 0" }}>{st.body}</p>
            </div>
            <Link href={st.href} onClick={() => track("team_welcome_step_clicked", { step: st.key })} style={{
              flexShrink: 0, display: "inline-flex", alignItems: "center", minHeight: 36, fontSize: 14, fontWeight: 600, padding: "0 14px", borderRadius: 10, textDecoration: "none",
              background: st.primary ? ACCENT : "transparent", color: st.primary ? "#fff" : TEXT, border: st.primary ? "none" : `1.5px solid ${BORDER}`,
            }}>
              {st.cta}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ─── Header ────────────────────────────────────────────────────────────── */

function DashboardHeader({ greetingName, agencyName, plan, subtitle, isRefreshing, refreshError, onRefresh }) {
  return (
    <header style={{
      ...CARD,
      position: "relative",
      overflow: "hidden",
      padding: "28px 32px",
      display: "flex",
      flexWrap: "wrap",
      gap: 20,
      alignItems: "center",
      justifyContent: "space-between",
      background: `linear-gradient(135deg, ${SURFACE} 0%, rgba(var(--forest-rgb),0.06) 100%)`,
    }}>
      <div
        className="ambient-glow"
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-40%",
          right: "-10%",
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(var(--forest-rgb),0.10) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ minWidth: 0, flex: 1, position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          {plan && (
            <span style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "3px 10px",
              borderRadius: 9999,
              background: ACCENT_BG,
              color: ACCENT_FG,
              border: `1px solid rgba(var(--forest-rgb),0.2)`,
            }}>
              {plan.name} plan
            </span>
          )}
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 600, color: TEXT, marginBottom: 6, marginTop: 0 }}>
          {getGreeting()}
          {greetingName ? <>, <span style={{ color: ACCENT_FG }}>{greetingName}</span></> : null}
        </h1>
        {agencyName && (
          <p style={{ fontSize: 14, color: TEXT_FAINT, marginTop: 0, marginBottom: 6 }}>{agencyName}</p>
        )}
        <p style={{ fontSize: 14, color: TEXT_SUB, maxWidth: 520, marginBottom: 10, marginTop: 0 }}>{subtitle}</p>

        <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 20 }} aria-live="polite">
          {isRefreshing && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: TEXT_FAINT }}>
              <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN_FG, display: "inline-block" }} aria-hidden="true" />
              Refreshing…
            </span>
          )}
          {!isRefreshing && refreshError && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: RED }}>
              Couldn&apos;t refresh - showing last data.
              <button type="button" onClick={onRefresh} style={{ color: RED, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12 }}>
                Retry
              </button>
            </span>
          )}
          {!isRefreshing && !refreshError && (
            <button type="button" onClick={onRefresh} style={{ fontSize: 12, color: TEXT_FAINT, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              Refresh ↺
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
        <Link href="/dashboard/candidates" style={{
          display: "inline-flex", alignItems: "center", fontSize: 14, fontWeight: 600,
          padding: "10px 16px", borderRadius: 9999, border: `1px solid ${BORDER}`,
          color: TEXT, textDecoration: "none", background: SURFACE,
        }}>
          Browse candidates
        </Link>
        <Link href="/dashboard/pipeline" style={{
          display: "inline-flex", alignItems: "center", fontSize: 14, fontWeight: 600,
          padding: "10px 16px", borderRadius: 9999, border: `1px solid ${BORDER}`,
          color: TEXT, textDecoration: "none", background: SURFACE,
        }}>
          Pipeline
        </Link>
        <Link href="/analyse" style={{
          display: "inline-flex", alignItems: "center", fontSize: 14, fontWeight: 600,
          padding: "10px 16px", borderRadius: 9999,
          background: ACCENT, color: "#fff", textDecoration: "none",
        }}>
          + Screen a CV
        </Link>
      </div>
    </header>
  );
}

/* ─── KPIs ──────────────────────────────────────────────────────────────── */

function KpiCard({ label, value, sub, meter, accent, index = 0 }) {
  // Meter bar grows in from 0 on mount rather than just appearing at its
  // final width - a two-step state flip so the width change is a real
  // CSS transition, not just paint-in-place.
  const [meterGrown, setMeterGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMeterGrown(true), index * 70 + 150);
    return () => clearTimeout(t);
  }, [index]);

  return (
    <div
      className="fade-up-in lift-on-hover"
      style={{ ...CARD, padding: 20, "--stagger-delay": `${index * 70}ms` }}
    >
      <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, marginBottom: 10, marginTop: 0 }}>
        {label}
      </p>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 600, color: accent || TEXT, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        <CountUp value={value} format={formatNumber} />
      </p>
      {typeof meter === "number" && (
        <div style={{ height: 3, background: BORDER2, borderRadius: 9999, marginTop: 12, marginBottom: 6, overflow: "hidden" }}>
          <div
            style={{
              height: 3,
              width: meterGrown ? `${Math.min(100, Math.max(0, meter))}%` : "0%",
              background: ACCENT,
              borderRadius: 9999,
              transition: "width 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          />
        </div>
      )}
      {sub && <p style={{ fontSize: 13, color: TEXT_FAINT, marginTop: typeof meter === "number" ? 2 : 8, marginBottom: 0 }}>{sub}</p>}
    </div>
  );
}

function DashboardKpis({ totals }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-live="polite">
      <KpiCard index={0} label="Total analyses" value={totals.total} sub={`${formatNumber(totals.last7)} in the last 7 days`} />
      <KpiCard index={1} label="Strong matches" value={totals.strongMatches} sub={totals.completed > 0 ? `${totals.strongMatchPct}% of completed` : "No completed yet"} accent={GREEN_FG} />
      <KpiCard index={2} label="In pipeline" value={totals.inPipeline} sub="Active, not yet placed" accent={GOLD} />
      <KpiCard index={3} label="Avg. score" value={totals.completed > 0 ? totals.avgScore : "-"} sub={totals.completed > 0 ? "Across completed" : "No completed yet"} meter={totals.completed > 0 ? totals.avgScore : undefined} accent={ACCENT_FG} />
    </div>
  );
}

/* ─── Pipeline ──────────────────────────────────────────────────────────── */

// Funnel of where every candidate stands, plus the share that made it from
// each stage to the next. "Reached" counts a candidate in their current
// stage and every stage before it (someone in Interview has, by definition,
// been Screened and Shortlisted), so the conversion between two stages is
// reached(next) / reached(this).
function PipelineSnapshot({ stageOrder, stageCounts, maxCount, rejected = 0 }) {
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

/* ─── Usage ─────────────────────────────────────────────────────────────── */

// Plan name plus real usage counted from the agency's analyses. The
// agencies.analyses_used counter is never incremented and analyses_limit is
// a placeholder default, so a used/limit meter built on them would show
// every agency "0 of 3" - better to show what actually happened.
function UsageSummary({ plan, analyses }) {
  const DAY = 86400000;
  const now = useNow();
  const last30 = analyses.filter((a) => a.createdAt && now - a.createdAt.getTime() < 30 * DAY).length;
  const thisMonth = analyses.filter((a) => {
    if (!a.createdAt) return false;
    const d = a.createdAt;
    const n = new Date(now);
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  return (
    <div style={{ ...CARD, padding: "20px 24px", display: "flex", flexDirection: "column" }}>
      <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, marginTop: 0, marginBottom: 6 }}>Your plan</p>
      <p style={{ fontSize: 18, fontWeight: 600, color: TEXT, margin: 0, fontFamily: "var(--font-display)" }}>{plan?.name ? `${plan.name}` : "No active plan"}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: TEXT, margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatNumber(thisMonth)}</p>
          <p style={{ fontSize: 13, color: TEXT_FAINT, margin: "2px 0 0" }}>analyses this month</p>
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: TEXT, margin: 0, fontVariantNumeric: "tabular-nums" }}>{formatNumber(last30)}</p>
          <p style={{ fontSize: 13, color: TEXT_FAINT, margin: "2px 0 0" }}>in the last 30 days</p>
        </div>
      </div>
      <Link href="/billing" style={{ fontSize: 13, fontWeight: 600, marginTop: "auto", paddingTop: 16, color: ACCENT_FG, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
        {plan?.name ? "Manage plan →" : "Choose a plan →"}
      </Link>
    </div>
  );
}

/* ─── Attention panel ───────────────────────────────────────────────────── */

function AttentionPanel({ items: firstItems, allItems, total }) {
  // Everything is already loaded - "show all" expands in place rather than
  // sending you to an unfiltered candidate list.
  const [expanded, setExpanded] = useState(false);
  const items = expanded ? allItems : firstItems;
  const hiddenCount = Math.max(0, total - firstItems.length);
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading eyebrow="Priority" title="Needs your attention" />
      {items.length === 0 ? (
        <EmptyState title="Nothing needs attention" body="No failed analyses, overdue follow-ups, stalled candidates, or unreviewed strong matches right now." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item, i) => (
            <li
              key={item.id}
              className="fade-up-in"
              style={{ borderTop: `1px solid ${BORDER}`, "--stagger-delay": `${i * 50}ms` }}
            >
              <Link href={item.actionHref} title={`${item.candidateName} - ${item.jobTitle}`} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 8px",
                borderRadius: 10, textDecoration: "none",
              }}
                className="hover:bg-[var(--mist)] transition-colors"
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.candidateName}</p>
                  <p style={{ fontSize: 13, color: TEXT_SUB, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.jobTitle}</p>
                </div>
                <span style={{
                  display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 600,
                  padding: "3px 10px", borderRadius: 9999, whiteSpace: "nowrap",
                  background: item.tone.bg, color: item.tone.fg,
                }}>
                  {item.reasonLabel}
                </span>
                <span style={{ fontSize: 12, color: TEXT_FAINT, whiteSpace: "nowrap", flexShrink: 0 }}>{formatRelativeTime(item.createdAt)}</span>
                {item.score !== null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: scoreColor(item.score), flexShrink: 0, width: 32, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{item.score}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{ display: "block", width: "100%", textAlign: "center", fontSize: 13, fontWeight: 600, color: ACCENT_FG, background: "none", border: "none", cursor: "pointer", paddingTop: 12, marginTop: 4, borderTop: `1px solid ${BORDER}` }}
        >
          {expanded ? "Show fewer" : `Show ${hiddenCount} more ${hiddenCount === 1 ? "item" : "items"} needing attention`}
        </button>
      )}
    </div>
  );
}

/* ─── Follow-ups ────────────────────────────────────────────────────────── */

const WHEN_STYLE = {
  overdue: { label: "Overdue", fg: RED_STRONG, bg: RED_BG },
  today: { label: "Today", fg: AMBER_FG, bg: AMBER_BG },
  upcoming: { label: "Upcoming", fg: TEXT_SUB, bg: SURFACE2 },
  undated: { label: "No date", fg: TEXT_FAINT, bg: SURFACE2 },
};

function formatDue(dueAt) {
  if (!dueAt) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(dueAt);
  const d = new Date(dateOnly ? `${dueAt}T12:00:00` : dueAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", dateOnly ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Every open next action and talent-pool check-in, most urgent first -
// "mine" (assigned to me) or the whole team. The one place to see what's
// due across all candidates; done here or on the candidate.
function FollowUpsPanel() {
  const [scope, setScope] = useState("mine");
  const [state, setState] = useState({ scope: null, items: [], error: false, truncated: false });
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getFollowUps(scope)
      .then((d) => { if (!cancelled) setState({ scope, items: d.items ?? [], error: false, truncated: d.truncated }); })
      .catch(() => { if (!cancelled) setState({ scope, items: [], error: true, truncated: false }); });
    return () => { cancelled = true; };
  }, [scope, reloadKey]);

  async function complete(item) {
    setCompleting(item.id);
    try {
      await completeNextAction(item.candidateId);
      setState((s) => ({ ...s, items: s.items.filter((i) => i.id !== item.id) }));
    } catch {
      setReloadKey((k) => k + 1);
    } finally {
      setCompleting(null);
    }
  }

  const loading = state.scope !== scope;
  const due = state.items.filter((i) => i.when === "overdue" || i.when === "today").length;
  const shown = expanded ? state.items : state.items.slice(0, 7);
  const tabStyle = (on) => ({
    fontSize: 13, fontWeight: 600, padding: "4px 12px", borderRadius: 9999, cursor: "pointer",
    border: `1px solid ${on ? ACCENT : BORDER}`, background: on ? ACCENT : SURFACE, color: on ? "#fff" : TEXT_SUB,
  });

  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow={loading ? "Follow-ups" : `${due} due now`}
        title="Follow-ups"
        action={
          <div style={{ display: "flex", gap: 6 }} role="group" aria-label="Whose follow-ups">
            <button type="button" aria-pressed={scope === "mine"} onClick={() => { setScope("mine"); setExpanded(false); }} style={tabStyle(scope === "mine")}>Mine</button>
            <button type="button" aria-pressed={scope === "all"} onClick={() => { setScope("all"); setExpanded(false); }} style={tabStyle(scope === "all")}>Everyone</button>
          </div>
        }
      />
      {loading ? (
        <div className="animate-pulse motion-reduce:animate-none" style={{ height: 120, borderRadius: 10, background: SURFACE2 }} aria-busy="true" />
      ) : state.error ? (
        <p style={{ fontSize: 14, color: TEXT_SUB }}>Couldn&apos;t load follow-ups.</p>
      ) : state.items.length === 0 ? (
        <EmptyState
          title="No follow-ups"
          body={scope === "mine" ? "Set a next action on a candidate and it shows up here when it's due." : "Nobody on the team has a follow-up set."}
        />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {shown.map((item) => {
            const w = WHEN_STYLE[item.when] ?? WHEN_STYLE.undated;
            return (
              <li key={item.id} style={{ borderTop: `1px solid ${BORDER}`, display: "flex", alignItems: "center", gap: 10, padding: "10px 4px" }}>
                <Link
                  href={item.kind === "check_in" ? "/dashboard/talent-pool?due=1" : item.kind === "interview" ? "/dashboard/interviews" : `/dashboard/candidates/${item.candidateId}`}
                  style={{ minWidth: 0, flex: 1, textDecoration: "none" }}
                  className="hover:underline"
                >
                  <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                  </p>
                  <p style={{ fontSize: 13, color: TEXT_SUB, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.candidateName}
                    {item.jobTitle ? ` · ${item.jobTitle}` : ""}
                    {scope === "all" && item.recruiterName ? ` · ${item.recruiterName}` : ""}
                  </p>
                </Link>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 9999, whiteSpace: "nowrap", background: w.bg, color: w.fg }}>
                  {item.dueAt ? formatDue(item.dueAt) : w.label}
                </span>
                {item.kind === "action" && (
                  <button
                    type="button"
                    onClick={() => complete(item)}
                    disabled={completing === item.id}
                    title="Mark done"
                    aria-label={`Mark "${item.label}" for ${item.candidateName} done`}
                    style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 9999, border: `1px solid ${BORDER}`, background: SURFACE, color: ACCENT_FG, cursor: "pointer", opacity: completing === item.id ? 0.5 : 1 }}
                  >
                    Done
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!loading && state.items.length > 7 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{ display: "block", width: "100%", textAlign: "center", fontSize: 13, fontWeight: 600, color: ACCENT_FG, background: "none", border: "none", cursor: "pointer", paddingTop: 12, marginTop: 4, borderTop: `1px solid ${BORDER}` }}
        >
          {expanded ? "Show fewer" : `Show all ${state.items.length}${state.truncated ? "+" : ""}`}
        </button>
      )}
    </div>
  );
}

/* ─── Top candidates ────────────────────────────────────────────────────── */

function TopCandidates({ candidates, total }) {
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

function ActivityOverview({ analyses }) {
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
            <span style={{ fontSize: 12, color: TEXT_FAINT, whiteSpace: "nowrap" }}>{d.label}</span>
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

/* ─── Active jobs ───────────────────────────────────────────────────────── */

const PRIORITY_LABEL = { urgent: "Urgent", high: "High", low: "Low" };

// Open jobs (job status, not "has analysed candidates"), most urgent first,
// with each job's screening mix where it has one.
function ActiveJobs({ jobs, total, statsByJob }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow="Roles"
        title="Open jobs"
        action={<Link href="/dashboard/jobs" style={{ fontSize: 13, fontWeight: 600, color: ACCENT_FG, textDecoration: "none" }}>{total > jobs.length ? `All ${total} →` : "All jobs →"}</Link>}
      />
      {jobs.length === 0 ? (
        <EmptyState title="No open jobs" body="Add a job to start building its pipeline." actionLabel="New job" actionHref="/dashboard/jobs?new=1" />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {jobs.map((job, i) => {
            const stats = statsByJob.get(job.id);
            const late = job.targetDate && job.targetDate < today;
            return (
              <li key={job.id} className="fade-up-in" style={{ borderTop: `1px solid ${BORDER}`, "--stagger-delay": `${i * 50}ms` }}>
                <Link
                  href={`/dashboard/jobs/${job.id}`}
                  className="hover:bg-[var(--mist)] transition-colors"
                  style={{ display: "block", padding: "12px 8px", margin: "0 -8px", borderRadius: 10, textDecoration: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${job.title}${job.client ? ` · ${job.client}` : ""}`}>
                      {job.title}
                      {job.client && <span style={{ color: TEXT_SUB, fontWeight: 400 }}> · {job.client}</span>}
                    </p>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {PRIORITY_LABEL[job.priority] && (job.priority === "urgent" || job.priority === "high") && (
                        <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 9999, background: RED_BG, color: RED }}>{PRIORITY_LABEL[job.priority]}</span>
                      )}
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: TEXT_SUB }}>{formatNumber(job.candidates)}</span>
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: BORDER2, borderRadius: 9999, overflow: "hidden", display: "flex" }}>
                      {(stats?.stageSegments || []).map((seg) =>
                        seg.pct > 0 ? <div key={seg.key} title={`${STAGE_LABELS[seg.key]}: ${seg.pct}%`} style={{ width: `${seg.pct}%`, background: STAGE_COLORS[seg.key] }} /> : null
                      )}
                    </div>
                    <span style={{ fontSize: 12, color: late ? RED : TEXT_FAINT, flexShrink: 0 }}>
                      {job.interviewing ? `${job.interviewing} interviewing · ` : ""}
                      {job.offers ? `${job.offers} offer${job.offers === 1 ? "" : "s"} · ` : ""}
                      {job.targetDate ? `fill by ${new Date(`${job.targetDate}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}` : `${formatNumber(stats?.strongMatches ?? 0)} strong`}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
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
        action={<Link href="/dashboard/analytics" style={{ fontSize: 13, fontWeight: 600, color: ACCENT_FG, textDecoration: "none" }}>Full analytics →</Link>}
      />
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {recruiters.map((r, i) => (
          <li
            key={r.key}
            className="fade-up-in"
            style={{ borderTop: `1px solid ${BORDER}`, "--stagger-delay": `${i * 50}ms` }}
          >
            <Link
              href={r.id ? `/dashboard/candidates?recruiterId=${encodeURIComponent(r.id)}` : "/dashboard/team"}
              title={`${r.name}'s candidates`}
              className="hover:bg-[var(--mist)] transition-colors"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 8px", margin: "0 -8px", borderRadius: 10, textDecoration: "none" }}
            >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: ACCENT_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: ACCENT_FG, flexShrink: 0 }}>
                {r.name[0]}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.name}>{r.name}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13, color: TEXT_SUB, flexShrink: 0 }}>
              <span><strong style={{ color: TEXT, fontFamily: "var(--font-mono)" }}>{formatNumber(r.completed)}</strong> analysed</span>
              <span><strong style={{ color: TEXT, fontFamily: "var(--font-mono)" }}>{r.avgScore ?? "-"}</strong> avg</span>
              <span><strong style={{ color: GREEN_FG, fontFamily: "var(--font-mono)" }}>{formatNumber(r.placements)}</strong> placed</span>
            </div>
            </Link>
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
                    <td style={{ padding: "12px 0 12px 12px", textAlign: "right", fontSize: 13, color: TEXT_FAINT, whiteSpace: "nowrap" }}>{formatDate(a.createdAt)}</td>
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
    <footer style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 20, fontSize: 13, color: TEXT_FAINT, borderTop: `1px solid ${BORDER}` }}>
      <span>Helixon - recruiter dashboard</span>
      <nav style={{ display: "flex", alignItems: "center", gap: 20 }} aria-label="Support links">
        {[["FAQ", "/faq"], ["Contact", "/contact"], ["Privacy", "/privacy"]].map(([label, href]) => (
          <Link key={href} href={href} style={{ color: TEXT_FAINT, textDecoration: "none" }} className="hover:text-[var(--ink)] transition-colors">{label}</Link>
        ))}
      </nav>
    </footer>
  );
}

/* ─── Skeleton ──────────────────────────────────────────────────────────── */

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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {[...Array(5)].map((_, i) => <Block key={i} style={{ height: 80 }} />)}
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
      <p style={{ fontSize: 14, color: TEXT_SUB, maxWidth: 320, marginBottom: 20 }}>Something went wrong while loading your recruitment data.</p>
      <button type="button" onClick={onRetry} style={{ fontSize: 14, fontWeight: 600, padding: "10px 20px", borderRadius: 9999, background: ACCENT, color: "#fff", border: "none", cursor: "pointer" }}>
        Try again
      </button>
    </div>
  );
}

/* ─── Business view (app/api/dashboard-ops) ─────────────────────────────── */

function formatMoneyShort(n) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(n || 0));
}

function BusinessKpis({ kpis }) {
  const items = [
    { label: "Open jobs", value: kpis.openJobs, sub: kpis.openings > kpis.openJobs ? `${formatNumber(kpis.openings)} openings` : "Roles you're filling", href: "/dashboard/jobs" },
    { label: "Interviews", value: kpis.interviewsThisWeek, sub: kpis.interviewsToday ? `${kpis.interviewsToday} today` : "Next 7 days", href: "/dashboard/interviews" },
    { label: "Offers out", value: kpis.offersOut, sub: "Waiting on an answer", href: "/dashboard/placements" },
    { label: "Placed this month", value: kpis.placementsThisMonth, sub: kpis.feesThisMonth == null ? "This month" : `${formatMoneyShort(kpis.feesThisMonth)} in fees`, href: "/dashboard/placements" },
    // Hidden from members when money is admin-only (lib/permissions.js).
    kpis.outstanding != null && {
      label: "Owed to you",
      value: formatMoneyShort(kpis.outstanding),
      sub: kpis.overdueCount ? `${formatMoneyShort(kpis.overdueTotal)} overdue` : "Nothing overdue",
      tone: kpis.overdueCount ? RED : null,
      href: "/dashboard/placements?tab=invoices",
    },
  ].filter(Boolean);
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {items.map((it, i) => (
        <Link
          key={it.label}
          href={it.href}
          className="fade-up-in lift-on-hover"
          style={{ ...CARD, padding: 18, textDecoration: "none", display: "block", "--stagger-delay": `${i * 60}ms` }}
        >
          <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, margin: "0 0 8px" }}>{it.label}</p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 600, color: TEXT, margin: 0, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
            {typeof it.value === "number" ? formatNumber(it.value) : it.value}
          </p>
          <p style={{ fontSize: 13, color: it.tone || TEXT_FAINT, margin: "8px 0 0" }}>{it.sub}</p>
        </Link>
      ))}
    </div>
  );
}

const ALERT_TONE = {
  red: { bg: RED_BG, fg: RED },
  amber: { bg: AMBER_BG, fg: AMBER_FG },
  neutral: { bg: SURFACE2, fg: TEXT_SUB },
};

// Money, compliance and contract risks that need someone today.
function RisksPanel({ alerts }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? alerts : alerts.slice(0, 6);
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading eyebrow="Money & compliance" title="Don't let these slip" />
      {alerts.length === 0 ? (
        <EmptyState title="All clear" body="No overdue invoices, timesheets waiting, expiring checks, or contracts and rebate periods ending soon." />
      ) : (
        <>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {shown.map((a) => {
              const tone = ALERT_TONE[a.tone] || ALERT_TONE.neutral;
              return (
                <li key={a.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <Link href={a.href} className="hover:bg-[var(--mist)] transition-colors" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", margin: "0 -8px", borderRadius: 10, textDecoration: "none" }}>
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: tone.fg, flexShrink: 0 }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: TEXT }}>{a.title}</span>
                      {a.detail && <span style={{ display: "block", fontSize: 13, color: TEXT_SUB, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.detail}</span>}
                    </span>
                    {typeof a.amount === "number" && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: tone.fg, flexShrink: 0 }}>{formatMoneyShort(a.amount)}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          {alerts.length > 6 && (
            <button type="button" onClick={() => setExpanded((v) => !v)} style={{ marginTop: 8, fontSize: 13, fontWeight: 600, color: ACCENT_FG, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              {expanded ? "Show fewer" : `Show all ${alerts.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// Interviews in the next 7 days, and client follow-ups that are due.
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function AgendaPanel({ interviews, total, clientFollowUps }) {
  return (
    <div style={{ ...CARD, padding: "20px 24px" }}>
      <SectionHeading
        eyebrow="Next 7 days"
        title="Agenda"
        action={<Link href="/dashboard/interviews" style={{ fontSize: 13, fontWeight: 600, color: ACCENT_FG, textDecoration: "none" }}>{total > interviews.length ? `All ${total} →` : "Interviews →"}</Link>}
      />
      {interviews.length === 0 && clientFollowUps.length === 0 ? (
        <EmptyState title="Nothing booked" body="No interviews in the next week and no client follow-ups due." />
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {interviews.map((i) => (
            <li key={i.id} style={{ borderTop: `1px solid ${BORDER}` }}>
              <Link href={`/dashboard/candidates/${i.candidateId}`} className="hover:bg-[var(--mist)] transition-colors" style={{ display: "flex", gap: 12, padding: "10px 8px", margin: "0 -8px", borderRadius: 10, textDecoration: "none" }}>
                <span style={{ width: 78, flexShrink: 0, fontSize: 13, color: TEXT_SUB }}>
                  <span style={{ display: "block", fontWeight: 600, color: TEXT }}>{dayLabel(i.startsAt)}</span>
                  {new Date(i.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: TEXT }}>{i.candidateName}</span>
                  <span style={{ display: "block", fontSize: 13, color: TEXT_SUB }}>
                    {i.round > 1 ? `Round ${i.round} · ` : ""}
                    {i.jobTitle || "Interview"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {clientFollowUps.map((c) => (
            <li key={`client-${c.id}`} style={{ borderTop: `1px solid ${BORDER}` }}>
              <Link href={`/dashboard/clients/${c.id}`} className="hover:bg-[var(--mist)] transition-colors" style={{ display: "flex", gap: 12, padding: "10px 8px", margin: "0 -8px", borderRadius: 10, textDecoration: "none" }}>
                <span style={{ width: 78, flexShrink: 0, fontSize: 13, fontWeight: 600, color: c.overdue ? RED : TEXT }}>{c.overdue ? "Overdue" : "Today"}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: TEXT }}>{c.label}</span>
                  <span style={{ display: "block", fontSize: 13, color: TEXT_SUB }}>Client · {c.name}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─── Scope, targets, truncation ────────────────────────────────────────── */

const SCOPE_KEY = "helixon.dashboard.scope";

function readScope() {
  try {
    return window.localStorage.getItem(SCOPE_KEY) === "mine" ? "mine" : "team";
  } catch {
    return "team";
  }
}

function ScopeToggle({ scope, onChange }) {
  const tab = (active) => ({
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: 9999,
    border: "none",
    cursor: "pointer",
    background: active ? SURFACE : "transparent",
    color: active ? TEXT : TEXT_SUB,
    boxShadow: active ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
  });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <p style={{ fontSize: 13, color: TEXT_FAINT, margin: 0 }}>
        {scope === "mine" ? "Showing candidates assigned to you." : "Showing the whole team's candidates."}
      </p>
      <div role="group" aria-label="Whose numbers to show" style={{ display: "inline-flex", gap: 2, padding: 3, borderRadius: 9999, background: BORDER2 }}>
        <button type="button" aria-pressed={scope === "mine"} onClick={() => onChange("mine")} style={tab(scope === "mine")}>Mine</button>
        <button type="button" aria-pressed={scope === "team"} onClick={() => onChange("team")} style={tab(scope === "team")}>Team</button>
      </div>
    </div>
  );
}

function TruncatedNotice() {
  return (
    <div role="status" style={{ ...CARD, padding: "12px 16px", fontSize: 14, color: AMBER_FG, background: AMBER_BG, borderColor: "transparent" }}>
      Your agency has more candidates than the Overview can load at once, so these numbers leave out the oldest ones.
      {" "}<Link href="/dashboard/analytics" style={{ color: AMBER_FG, fontWeight: 600 }}>Analytics</Link> counts everything.
    </div>
  );
}

function formatMetric(key, n) {
  if (METRICS[key]?.money) {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(n || 0));
  }
  return formatNumber(Number(n || 0));
}

// This month against target - the same figures as /dashboard/performance,
// for you or for the team depending on the Mine/Team switch.
function TargetsCard({ scope }) {
  const [state, setState] = useState({ status: "loading", data: null });
  useEffect(() => {
    let cancelled = false;
    getPerformance("this_month")
      .then((data) => { if (!cancelled) setState({ status: "ready", data }); })
      .catch(() => { if (!cancelled) setState({ status: "error", data: null }); });
    return () => { cancelled = true; };
  }, []);

  // Not every plan or role can read performance - nothing to show then.
  if (state.status === "error") return null;

  const source = state.data
    ? scope === "mine"
      ? state.data.people?.find((p) => p.me) ?? null
      : state.data.team ?? null
    : null;
  const rows = source
    ? METRIC_KEYS.filter((k) => Number(source.targets?.[k]) > 0)
        .slice(0, 4)
        .map((k) => {
          const actual = Number(source.metrics?.[k] || 0);
          const target = Number(source.targets[k]);
          return { key: k, label: METRICS[k].label, actual, target, pct: Math.min(100, Math.round((actual / target) * 100)) };
        })
    : [];

  return (
    <section style={{ ...CARD, padding: 24 }} aria-busy={state.status === "loading"}>
      <SectionHeading
        eyebrow="This month"
        title={scope === "mine" ? "Your targets" : "Team targets"}
        action={<Link href="/dashboard/performance" style={{ fontSize: 13, fontWeight: 600, color: ACCENT_FG, textDecoration: "none" }}>Leaderboard →</Link>}
      />
      {state.status === "loading" ? (
        <div style={{ height: 96, borderRadius: 10, background: SURFACE2 }} />
      ) : rows.length === 0 ? (
        <p style={{ fontSize: 14, color: TEXT_SUB, margin: 0 }}>
          No targets set{scope === "mine" ? " for you" : ""} yet.{" "}
          <Link href="/dashboard/settings/targets" style={{ color: ACCENT_FG, fontWeight: 600 }}>Set targets</Link>
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.map((r) => (
            <li key={r.key}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}>
                <span style={{ color: TEXT }}>{r.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: TEXT_SUB, fontVariantNumeric: "tabular-nums" }}>
                  {formatMetric(r.key, r.actual)} / {formatMetric(r.key, r.target)}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 9999, background: BORDER2, marginTop: 6, overflow: "hidden" }} role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.label}: ${r.pct}% of target`}>
                <div style={{ height: 6, width: `${r.pct}%`, borderRadius: 9999, background: r.pct >= 100 ? GREEN : r.pct >= 60 ? GOLD : RED }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

function AgencyDashboardPage() {
  const [data, setData] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
    setIsFetching(true);
    fetchDashboardData()
      .then((d) => { if (!cancelled) { setData(d); setHasError(false); } })
      .catch(() => { if (!cancelled) setHasError(true); })
      .finally(() => { if (!cancelled) setIsFetching(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const { user: clerkUser } = useUser();
  const myId = clerkUser?.id ?? null;
  const [ops, setOps] = useState(null);
  // Mine/Team, remembered per browser. Nothing that depends on it renders
  // until the data has loaded on the client, so reading it up front can't
  // make the server and client renders disagree.
  const [scope, setScopeState] = useState(() => (typeof window === "undefined" ? "team" : readScope()));
  const setScope = useCallback((next) => {
    setScopeState(next);
    try { window.localStorage.setItem(SCOPE_KEY, next); } catch { /* private mode - just don't remember */ }
  }, []);

  const stageOrder = FUNNEL_ORDER;
  const lastStageKey = stageOrder[stageOrder.length - 1];

  // Core KPI/stage/attention-item math is shared with the server side via
  // lib/dashboard-model.js so this page and any future server rendering
  // can't drift into two different answers for the same numbers. Only the
  // jobs/recruiter roll-ups below are dashboard-page-specific.
  const model = useMemo(() => {
    const rawAnalyses = data?.recentAnalyses ?? [];
    const everyone = rawAnalyses.map((raw, i) => normalizeAnalysis(raw, i)).filter(Boolean);
    // The switch only matters once someone else owns candidates too.
    const hasTeammates = everyone.some((a) => a.recruiterId && a.recruiterId !== myId);
    const mineOnly = scope === "mine" && hasTeammates && myId;
    const normalized = mineOnly ? everyone.filter((a) => a.recruiterId === myId) : everyone;
    const stats = computeCandidateStats(normalized);
    const completed = stats.analyses.filter((a) => a.status === "completed");

    const jobMap = new Map();
    completed.forEach((a) => {
      const key = a.jobId ?? `${a.jobTitle}__${a.company ?? ""}`;
      if (!jobMap.has(key)) jobMap.set(key, { key, jobId: a.jobId, jobTitle: a.jobTitle, company: a.company, candidateCount: 0, strongMatches: 0, stageCounts: {} });
      const job = jobMap.get(key);
      job.candidateCount += 1;
      if (a.score !== null && a.score >= STRONG_MATCH_MIN) job.strongMatches += 1;
      if (a.stage) job.stageCounts[a.stage] = (job.stageCounts[a.stage] ?? 0) + 1;
    });
    const jobs = Array.from(jobMap.values()).map((job) => ({
      ...job,
      stageSegments: stageOrder.map((key) => ({ key, pct: job.candidateCount > 0 ? Math.round(((job.stageCounts[key] ?? 0) / job.candidateCount) * 100) : 0, isPlaced: key === lastStageKey })),
    }));
    // Screening mix per job, for the Open jobs panel (which lists jobs by
    // their status, from /api/dashboard-ops).
    const jobStats = new Map(jobs.filter((j) => j.jobId).map((j) => [j.jobId, j]));

    const recruiterMap = new Map();
    completed.forEach((a) => {
      if (!a.recruiterName) return;
      const rKey = a.recruiterId ?? a.recruiterName;
      if (!recruiterMap.has(rKey)) recruiterMap.set(rKey, { key: rKey, id: a.recruiterId, name: a.recruiterName, completed: 0, scoreSum: 0, scoreCount: 0, placements: 0 });
      const r = recruiterMap.get(rKey);
      r.completed += 1;
      if (a.score !== null) { r.scoreSum += a.score; r.scoreCount += 1; }
      if (a.stage === lastStageKey) r.placements += 1;
    });
    const recruiters = Array.from(recruiterMap.values()).map((r) => ({ ...r, avgScore: r.scoreCount > 0 ? Math.round(r.scoreSum / r.scoreCount) : null })).sort((a, b) => b.placements - a.placements || (b.avgScore ?? 0) - (a.avgScore ?? 0)).slice(0, 4);

    return { ...stats, jobStats, recruiters, hasTeammates, mineOnly: Boolean(mineOnly), everyone };
  }, [data, stageOrder, lastStageKey, scope, myId]);

  // /api/dashboard-stats returns { agencyName, plan, analyses } flat -
  // this used to read data.agency.name/data.agency.plan, a key that never
  // existed in the response, so the header silently always showed the
  // "your agency" fallback and UsageSummary always got plan=null. Nothing
  // threw (optional chaining swallows it), so it shipped unnoticed.
  //
  // The greeting is for the person, so it uses their own first name from Clerk
  // (available immediately, and independent of whether an agency row exists).
  // The agency name is shown separately and only when it's a real name - the
  // "your agency" placeholder that used to be spliced into the greeting is
  // never displayed.
  // The business view follows the same Mine/Team switch.
  const opsScope = model.mineOnly ? "mine" : "team";
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dashboard-ops?scope=${opsScope}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("ops"))))
      .then((d) => { if (!cancelled) setOps(d); })
      .catch(() => { if (!cancelled) setOps((prev) => prev ?? false); });
    return () => { cancelled = true; };
  }, [opsScope, reloadKey]);

  // A teammate who joined a workspace that's already running and hasn't
  // screened anything themselves yet.
  const [teamWelcomeDismissed, setTeamWelcomeDismissed] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.localStorage.getItem(JOINED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const isNewTeammate =
    data != null && model.hasTeammates && myId && !model.everyone.some((a) => a.recruiterId === myId) && !teamWelcomeDismissed;
  function dismissTeamWelcome() {
    try {
      window.localStorage.setItem(JOINED_KEY, "1");
    } catch {
      /* private mode */
    }
    setTeamWelcomeDismissed(true);
  }

  // Nothing screened and no open jobs: a brand-new workspace.
  const isNewAccount = data != null && model.everyone.length === 0;
  const hasOpenJob = Boolean(ops && ops.kpis?.openJobs > 0);
  const greetingName = clerkUser?.firstName || null;
  const agencyName = data?.agencyName && data.agencyName !== "your agency" ? data.agencyName : null;
  const plan = data?.plan ?? null;

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
        {/* The page's h1 lives in DashboardHeader, which only renders once data
            has loaded - so while loading (or on an error) there was no h1 at all. */}
        {!data && <h1 className="sr-only">Dashboard overview</h1>}
        {!data && isFetching && <DashboardSkeleton />}
        {!data && !isFetching && hasError && <DashboardError onRetry={retry} />}
        {data && (
          <>
            <DashboardHeader greetingName={greetingName} agencyName={agencyName} plan={plan} subtitle={subtitle} isRefreshing={isFetching} refreshError={!isFetching && hasError} onRefresh={retry} />

            {isNewTeammate && <TeamWelcome agencyName={agencyName} onDismiss={dismissTeamWelcome} />}
            {!isNewAccount && !isNewTeammate && <PulseSurvey analysesCount={model.everyone.filter((a) => a.recruiterId === myId).length} />}
            {data.truncated && <TruncatedNotice />}
            {model.hasTeammates && <ScopeToggle scope={scope} onChange={setScope} />}

            {isNewAccount && <GettingStarted hasJob={hasOpenJob} showTeam={plan?.name === "Agency"} />}

            {/* All zeros and "All clear" on day one say nothing; they come
                back as soon as there's anything to report. */}
            {ops && !(isNewAccount && !hasOpenJob) && <BusinessKpis kpis={ops.kpis} />}
            {ops && !(isNewAccount && !hasOpenJob) && (
              <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">
                <RisksPanel alerts={ops.alerts} />
                <AgendaPanel interviews={ops.interviews} total={ops.interviewsTotal} clientFollowUps={ops.clientFollowUps} />
              </div>
            )}

            {isNewAccount ? (
              ops && ops.activeJobsTotal > 0 && (
                <div style={{ ...CARD, padding: 24 }}>
                  <ActiveJobs jobs={ops.activeJobs} total={ops.activeJobsTotal} statsByJob={model.jobStats} />
                </div>
              )
            ) : model.analyses.length === 0 ? (
              <div style={CARD}>
                <EmptyState
                  title={model.mineOnly ? "No candidates assigned to you" : "No candidates yet"}
                  body={model.mineOnly ? "Switch to Team to see everyone's, or screen a CV to start your own pipeline." : "Your pipeline is empty. Upload your first CV to get started."}
                  actionLabel="Screen a CV"
                  actionHref="/analyse"
                />
                {ops && ops.activeJobsTotal > 0 && (
                  <div style={{ padding: "0 24px 24px" }}>
                    <ActiveJobs jobs={ops.activeJobs} total={ops.activeJobsTotal} statsByJob={model.jobStats} />
                  </div>
                )}
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: TEXT_FAINT, margin: "8px 0 -8px" }}>Screening</p>
                <DashboardKpis totals={model.totals} />

                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
                  <PipelineSnapshot stageOrder={stageOrder} stageCounts={model.stageCounts} maxCount={model.maxStageCount} rejected={model.totals.rejected} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {/* Plan usage is the agency's, whichever view is on. */}
                    <UsageSummary plan={plan} analyses={model.everyone} />
                    <TargetsCard scope={model.mineOnly ? "mine" : "team"} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">
                  <AttentionPanel items={model.attentionItems} allItems={model.attentionItemsAll ?? model.attentionItems} total={model.attentionItemsTotal} />
                  <FollowUpsPanel />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <TopCandidates candidates={model.topCandidates} total={model.topCandidatesTotal} />
                  <ActivityOverview analyses={model.analyses} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {ops ? <ActiveJobs jobs={ops.activeJobs} total={ops.activeJobsTotal} statsByJob={model.jobStats} /> : <div />}
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

export default function DashboardPage() {
  return <AgencyDashboardPage />;
}