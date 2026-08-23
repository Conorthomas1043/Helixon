"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { getMockData, STAGE_LABELS } from "@/lib/mock-data";

/* ------------------------------------------------------------------------
 * ASSUMPTIONS — read before wiring up real data
 * ------------------------------------------------------------------------
 * The real lib/mock-data.js and DashboardNav were not available while this
 * was built, so a few things are inferred rather than inspected directly:
 *
 * 1. Shape of each record in `data.recentAnalyses`: id, candidateName,
 *    jobTitle, company, recruiterName, status ("completed" | "processing" |
 *    "failed"), stage (one of the STAGE_LABELS keys, or null/absent while
 *    processing or failed), score (0-100 or null), createdAt (ISO string).
 *    `normalizeAnalysis()` below is the single adapter that maps raw
 *    records into this shape — if field names differ in the real file,
 *    fix them there rather than in each section.
 * 2. `data.agency.name` and `data.agency.plan.{name,analysesUsed,
 *    analysesLimit}` for the header and usage widget. Both degrade
 *    gracefully (fallback copy, hidden progress bar) if absent.
 * 3. Jobs and recruiter performance are *derived* entirely from
 *    `recentAnalyses` (grouped by job/company and by recruiterName) rather
 *    than assumed to exist as separate top-level fields, per the brief's
 *    instruction not to invent backend data.
 * 4. "Stalled" = completed, mid-pipeline, and not updated for 5+ days;
 *    "still processing" surfaces after 12+ hours. Both use `createdAt` as
 *    a stand-in for "last updated" since no separate field was available —
 *    swap in a real `updatedAt` if/when one exists.
 * 5. `DashboardNav` is imported as-is, assumed to already exist in the
 *    project (as in the original file).
 *
 * ------------------------------------------------------------------------
 * UPDATE — candidate database + candidate workspace added
 * ------------------------------------------------------------------------
 * A dedicated candidate database (/dashboard/candidates) and candidate
 * workspace (/dashboard/candidates/[id]) now exist alongside this page,
 * backed by a richer lib/mock-data.js (candidates, jobs, recruiters, tags
 * — still mock, but shaped like a real API). Three links below were
 * repointed from /analyse/[id] to /dashboard/candidates/[id] so opening a
 * *completed* candidate from the dashboard lands in the new recruiter
 * workspace (stage, recruiter, tags, notes, activity) rather than the
 * analysis-result view. A "Browse candidates" link was added to the header.
 *
 * ------------------------------------------------------------------------
 * UPDATE — production audit pass
 * ------------------------------------------------------------------------
 * This pass is scoped to this file only: I don't have access to the real
 * DashboardNav, lib/mock-data.js, the global CSS custom properties
 * (--forest, --mist, --border, --font-mono, --font-display), or the
 * ability to run this project's own typecheck/lint/build. Everything
 * below is a change I could verify or reason about from this file alone;
 * see the chat response for what still needs the full codebase to confirm.
 *
 * Changes:
 * 1. Accessibility — the amber used for "processing" / "stalled" text
 *    (score pills, status badges, attention rows) only rendered at ~2.6:1
 *    contrast against both white and its own tint background, well under
 *    WCAG AA's 4.5:1 for text. Darkened it to ~5:1 against both. It's a
 *    single constant, so this one change fixes every occurrence.
 * 2. Consistency bug — "Recent analyses" was the only section still
 *    linking *completed* rows to /analyse/[id] instead of
 *    /dashboard/candidates/[id], unlike every other section on this page.
 *    Fixed, and rows are now fully clickable (previously only the name
 *    cell was, despite the whole row showing a pointer cursor and hover
 *    state — a "looks clickable, isn't" mismatch).
 * 3. Logic bug — a completed, high-scoring candidate with no stage set
 *    yet (stage === null) never appeared in "Needs your attention",
 *    because the strong-match filter required stage === firstStageKey.
 *    Fixed, and added a dedicated "Awaiting stage" reason for completed
 *    candidates that have no stage and aren't already a strong match, so
 *    nothing completed can silently sit unrepresented anywhere.
 * 4. Missing state — plan usage had no distinct treatment for being at or
 *    over the limit; it looked identical to being at 40%. Added an
 *    explicit "limit reached" callout.
 * 5. Missing state / context loss — retrying used the exact same full
 *    skeleton as first load, which throws away everything on screen
 *    (including scroll position) even when perfectly good data is still
 *    showing underneath. Loading is now only a full skeleton when there
 *    is no data yet; a background refresh keeps existing content visible
 *    with a small inline indicator, and a failed refresh degrades to an
 *    inline "showing last loaded data" notice rather than a full-page
 *    error. Added a manual Refresh action so this path is reachable.
 * 6. Missing feature — Activity only ever showed a fixed 7-day window.
 *    Added a 7D/30D toggle (all client-side, no new data needed).
 * 7. Friction — truncated names/roles/companies had no way to see the
 *    full value short of opening the record. Added `title` attributes
 *    wherever text is visually clipped, and removed the character-count
 *    `truncate()` helper that was only used in one section (everywhere
 *    else already relied on CSS truncation) so there's one consistent
 *    truncation strategy instead of two.
 * 8. Data realism — KPI counts, pipeline stage counts, job candidate
 *    counts, and recruiter stats now render through a `formatNumber()`
 *    helper (thousands separators) so this doesn't break once an agency
 *    has thousands of analyses instead of a handful.
 * 9. Minor a11y — KPI values now sit in an `aria-live="polite"` region so
 *    a background refresh that changes the numbers is announced, and the
 *    activity sparkline's aria-label updates with the selected window.
 * ---------------------------------------------------------------------- */

/* ------------------------------------------------------------------------
 * Data loading
 * ---------------------------------------------------------------------- */

// TODO: replace with `await fetch("/api/agency/me")` once the backend exists.
// The try/catch keeps the failure path real: once this becomes a network
// call, a non-2xx response or thrown error lands in the same `error` state
// the UI already knows how to render.
async function fetchDashboardData() {
  try {
    const data = await new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(getMockData());
        } catch (err) {
          reject(err);
        }
      }, 200);
    });
    return data;
  } catch (err) {
    throw new Error("Failed to load dashboard data");
  }
}

/* ------------------------------------------------------------------------
 * Design tokens (existing Helixon visual language)
 * ---------------------------------------------------------------------- */

const INK = "#13201b";
const INK_MUTED = "#5a7a6a";
const INK_FAINT = "#8aaa9a";
// Was #c9922e (~2.6:1 against white and against AMBER_BG — fails WCAG AA
// text contrast in every place it's used). This value holds ~5:1 against
// both, and is the only place that needs to change since AMBER is only
// ever used as a text color in this file.
const AMBER = "#92620f";
const AMBER_BG = "#fff8e6";
const RED = "#c0392b";
const RED_STRONG = "#b91c1c";
const RED_BG = "#fef2f2";
const GREEN_BG = "#eef7f1";

const CARD = {
  background: "white",
  border: "1px solid var(--border)",
};

/* ------------------------------------------------------------------------
 * Normalisation — the one place raw records are translated into the shape
 * every section below relies on. If the real lib/mock-data.js (or future
 * API response) uses slightly different field names, adjust the fallbacks
 * here rather than each section.
 * ---------------------------------------------------------------------- */

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

/* ------------------------------------------------------------------------
 * Small formatting helpers
 * ---------------------------------------------------------------------- */

function formatDate(date) {
  if (!date) return "Unknown date";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(date) {
  if (!date) return "Unknown date";
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
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-GB");
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function scoreColor(score) {
  if (score === null || score === undefined) return INK_FAINT;
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return AMBER;
  return RED;
}

function scoreLabel(score) {
  if (score === null || score === undefined) return "No score";
  if (score >= 80) return "Strong match";
  if (score >= 60) return "Moderate match";
  return "Weak match";
}

/* ------------------------------------------------------------------------
 * Shared presentational pieces
 * ---------------------------------------------------------------------- */

function ScorePill({ score }) {
  const color = scoreColor(score);
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ fontFamily: "var(--font-mono)", color }}
      >
        {score === null || score === undefined ? "—" : score}
      </span>
      <span className="text-[11px]" style={{ color: INK_MUTED }}>
        {scoreLabel(score)}
      </span>
    </div>
  );
}

function StageBadge({ stage }) {
  if (!stage || !STAGE_LABELS[stage]) {
    return (
      <span className="text-[11px]" style={{ color: INK_FAINT }}>
        No stage
      </span>
    );
  }
  const isPlaced = stage === Object.keys(STAGE_LABELS)[Object.keys(STAGE_LABELS).length - 1];
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: isPlaced ? GREEN_BG : "var(--mist)",
        color: isPlaced ? "var(--forest)" : INK_MUTED,
      }}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

function StatusBadge({ status }) {
  const map = {
    completed: { bg: GREEN_BG, fg: "var(--forest)", label: "Completed" },
    processing: { bg: AMBER_BG, fg: AMBER, label: "Processing" },
    failed: { bg: RED_BG, fg: RED_STRONG, label: "Failed" },
  };
  const s = map[status] || map.completed;
  return (
    <span
      className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        {eyebrow && (
          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1"
            style={{ color: INK_FAINT }}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className="text-lg font-semibold"
          style={{ fontFamily: "var(--font-display)", color: INK }}
        >
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, body, actionLabel, actionHref }) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-6">
      <p className="text-sm font-semibold mb-1" style={{ color: INK }}>
        {title}
      </p>
      <p className="text-[13px] max-w-sm mb-4" style={{ color: INK_MUTED }}>
        {body}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "var(--forest)", color: "white" }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Header
 * ---------------------------------------------------------------------- */

function DashboardHeader({ agencyName, plan, subtitle, isRefreshing, refreshError, onRefresh }) {
  return (
    <header
      className="rounded-[16px] p-6 sm:p-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"
      style={{ ...CARD, background: "linear-gradient(180deg, white 0%, var(--mist) 240%)" }}
    >
      <div className="min-w-0">
        {plan && (
          <span
            className="inline-flex items-center text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3"
            style={{ background: GREEN_BG, color: "var(--forest)" }}
          >
            {plan.name} plan
          </span>
        )}
        <h1
          className="text-2xl sm:text-[28px] font-semibold leading-tight truncate"
          style={{ fontFamily: "var(--font-display)", color: INK }}
        >
          {getGreeting()}, {agencyName}
        </h1>
        <p className="text-sm mt-2 max-w-xl" style={{ color: INK_MUTED }}>
          {subtitle}
        </p>

        <div className="mt-3 flex items-center gap-3 min-h-[16px]" aria-live="polite">
          {isRefreshing && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: INK_MUTED }}>
              <span
                className="h-1.5 w-1.5 rounded-full animate-pulse motion-reduce:animate-none"
                style={{ background: "var(--forest)" }}
                aria-hidden="true"
              />
              Refreshing…
            </span>
          )}
          {!isRefreshing && refreshError && (
            <span className="inline-flex items-center gap-2 text-[11px] font-medium" style={{ color: RED_STRONG }}>
              Couldn't refresh — showing your last loaded data.
              <button
                type="button"
                onClick={onRefresh}
                className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
              >
                Retry
              </button>
            </span>
          )}
          {!isRefreshing && !refreshError && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-[11px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
              style={{ color: INK_FAINT }}
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/dashboard/candidates"
          className="hidden sm:inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Browse candidates
        </Link>
        <Link
          href="/dashboard/pipeline"
          className="hidden sm:inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          View pipeline
        </Link>
        <Link
          href="/analyse"
          className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ background: "var(--forest)", color: "white" }}
        >
          + New analysis
        </Link>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------
 * KPI layer
 * ---------------------------------------------------------------------- */

function KpiCard({ label, value, sub, meter }) {
  return (
    <div className="rounded-[14px] p-5" style={CARD}>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-2"
        style={{ color: INK_FAINT }}
      >
        {label}
      </p>
      <p
        className="text-2xl font-semibold tabular-nums"
        style={{ fontFamily: "var(--font-mono)", color: INK }}
      >
        {value}
      </p>
      {typeof meter === "number" && (
        <div className="h-1 rounded-full mt-3 mb-1" style={{ background: "var(--mist)" }}>
          <div
            className="h-1 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, meter))}%`, background: "var(--forest)" }}
          />
        </div>
      )}
      {sub && (
        <p className="text-[11px] mt-1" style={{ color: INK_MUTED }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function DashboardKpis({ totals }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" aria-live="polite">
      <KpiCard
        label="Analyses"
        value={formatNumber(totals.total)}
        sub={`${formatNumber(totals.last7)} in the last 7 days`}
      />
      <KpiCard
        label="Strong matches"
        value={formatNumber(totals.strongMatches)}
        sub={totals.completed > 0 ? `${totals.strongMatchPct}% of completed analyses` : "No completed analyses yet"}
      />
      <KpiCard
        label="In pipeline"
        value={formatNumber(totals.inPipeline)}
        sub="Active, not yet placed"
      />
      <KpiCard
        label="Avg. match score"
        value={totals.completed > 0 ? totals.avgScore : "—"}
        sub={totals.completed > 0 ? "Across completed analyses" : "No completed analyses yet"}
        meter={totals.completed > 0 ? totals.avgScore : undefined}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Pipeline
 * ---------------------------------------------------------------------- */

function PipelineSnapshot({ stageOrder, stageCounts, maxCount }) {
  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading
        eyebrow="Candidate pipeline"
        title="Where candidates stand"
        action={
          <Link
            href="/dashboard/pipeline"
            className="text-[12px] font-semibold shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
            style={{ color: "var(--forest)" }}
          >
            Open pipeline →
          </Link>
        }
      />

      {maxCount === 0 ? (
        <EmptyState
          title="No candidates in progress"
          body="Once analyses complete, candidates will appear here as they move through your pipeline."
          actionLabel="New analysis"
          actionHref="/analyse"
        />
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {stageOrder.map((stageKey) => {
            const count = stageCounts[stageKey] ?? 0;
            const heightPct = maxCount > 0 ? Math.max(6, Math.round((count / maxCount) * 100)) : 0;
            const isPlaced = stageKey === stageOrder[stageOrder.length - 1];
            return (
              <Link
                key={stageKey}
                href={`/dashboard/pipeline?stage=${stageKey}`}
                className="group flex flex-col items-center rounded-[10px] p-3 transition-colors hover:bg-[var(--mist)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span
                  className="text-lg font-semibold tabular-nums"
                  style={{ fontFamily: "var(--font-mono)", color: INK }}
                >
                  {formatNumber(count)}
                </span>
                <div
                  className="w-full rounded-full mt-2 mb-2 flex items-end"
                  style={{ height: 40, background: "var(--mist)" }}
                >
                  <div
                    className="w-full rounded-full transition-all"
                    style={{
                      height: `${heightPct}%`,
                      background: isPlaced ? "var(--forest)" : "#a9c4b5",
                    }}
                  />
                </div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide text-center leading-tight"
                  style={{ color: INK_MUTED }}
                >
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

/* ------------------------------------------------------------------------
 * Plan usage
 * ---------------------------------------------------------------------- */

function UsageSummary({ plan }) {
  const hasLimit = plan && typeof plan.analysesLimit === "number" && plan.analysesLimit > 0;
  const used = plan?.analysesUsed ?? 0;
  const limit = plan?.analysesLimit ?? null;
  const remaining = hasLimit ? Math.max(0, limit - used) : null;
  const pct = hasLimit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isOverLimit = hasLimit && used >= limit;

  return (
    <div className="rounded-[14px] p-5 sm:p-6 flex flex-col" style={CARD}>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-1"
        style={{ color: INK_FAINT }}
      >
        {plan?.name ? `${plan.name} plan` : "Plan usage"}
      </p>

      {hasLimit ? (
        <>
          <p
            className="text-xl font-semibold tabular-nums mt-1"
            style={{ fontFamily: "var(--font-mono)", color: INK }}
          >
            {formatNumber(used)} / {formatNumber(limit)}
          </p>
          <p className="text-[11px] mb-3" style={{ color: INK_MUTED }}>
            analyses this cycle
          </p>
          <div className="h-2 rounded-full" style={{ background: "var(--mist)" }}>
            <div
              className="h-2 rounded-full"
              style={{ width: `${pct}%`, background: pct >= 90 ? RED : "var(--forest)" }}
            />
          </div>
          <p className="text-[11px] mt-2" style={{ color: isOverLimit ? RED_STRONG : INK_MUTED }}>
            {isOverLimit ? "Plan limit reached" : `${formatNumber(remaining)} analyses remaining`}
          </p>
          {isOverLimit && (
            <div
              className="mt-3 rounded-[10px] px-3 py-2 text-[11px] font-medium leading-snug"
              style={{ background: RED_BG, color: RED_STRONG }}
            >
              You've used all {formatNumber(limit)} analyses this cycle. Upgrade to keep screening candidates.
            </div>
          )}
        </>
      ) : (
        <p className="text-sm mt-2" style={{ color: INK_MUTED }}>
          No plan limit on file.
        </p>
      )}

      <Link
        href="/dashboard/billing"
        className="text-[12px] font-semibold mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded self-start"
        style={{ color: "var(--forest)" }}
      >
        Upgrade plan →
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Needs attention
 * ---------------------------------------------------------------------- */

function AttentionPanel({ items }) {
  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Priority" title="Needs your attention" />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing needs attention"
          body="No failed analyses, stalled candidates, or unreviewed strong matches right now — nice work."
        />
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.actionHref}
                title={`${item.candidateName} — ${item.jobTitle}`}
                className="flex items-center gap-4 py-3.5 -mx-2 px-2 rounded-[10px] transition-colors hover:bg-[var(--mist)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: INK }}>
                    {item.candidateName}
                  </p>
                  <p className="text-[12px] truncate" style={{ color: INK_MUTED }}>
                    {item.jobTitle}
                  </p>
                </div>

                <div className="hidden sm:flex flex-col items-start w-44 shrink-0">
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full mb-1"
                    style={{ background: item.tone.bg, color: item.tone.fg }}
                  >
                    {item.reasonLabel}
                  </span>
                  <span className="text-[11px]" style={{ color: INK_FAINT }}>
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>

                {item.score !== null && (
                  <span
                    className="text-sm font-semibold tabular-nums w-10 text-right shrink-0"
                    style={{ fontFamily: "var(--font-mono)", color: scoreColor(item.score) }}
                  >
                    {item.score}
                  </span>
                )}

                <span
                  className="text-[12px] font-semibold shrink-0 hidden sm:inline"
                  style={{ color: "var(--forest)" }}
                >
                  {item.actionLabel} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Strongest candidates
 * ---------------------------------------------------------------------- */

function TopCandidates({ candidates }) {
  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Top talent" title="Strongest candidates" />

      {candidates.length === 0 ? (
        <EmptyState
          title="No strong matches yet"
          body="Candidates scoring 80 or above on completed analyses will surface here."
        />
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {candidates.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard/candidates/${c.id}`}
                title={`${c.candidateName} — ${c.jobTitle}${c.company ? ` · ${c.company}` : ""}`}
                className="flex items-center gap-4 py-3.5 -mx-2 px-2 rounded-[10px] transition-colors hover:bg-[var(--mist)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: INK }}>
                    {c.candidateName}
                  </p>
                  <p className="text-[12px] truncate" style={{ color: INK_MUTED }}>
                    {c.jobTitle}
                    {c.company ? ` · ${c.company}` : ""}
                  </p>
                </div>
                <div className="hidden sm:block shrink-0">
                  <StageBadge stage={c.stage} />
                </div>
                <ScorePill score={c.score} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Activity overview — now with a 7D / 30D window toggle. Computed entirely
 * from the already-loaded `analyses` array, so no new data source needed.
 * ---------------------------------------------------------------------- */

function ActivityOverview({ analyses }) {
  const [windowDays, setWindowDays] = useState(7);

  const stats = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;

    const current = analyses.filter((a) => a.createdAt && now - a.createdAt.getTime() < windowDays * DAY);
    const previous = analyses.filter(
      (a) =>
        a.createdAt &&
        now - a.createdAt.getTime() >= windowDays * DAY &&
        now - a.createdAt.getTime() < windowDays * 2 * DAY
    );

    const dayBuckets = Array.from({ length: windowDays }).map((_, i) => {
      const offset = windowDays - 1 - i;
      const dayDate = new Date(now - offset * DAY);
      const count = analyses.filter((a) => {
        if (!a.createdAt) return false;
        const diff = Math.floor((now - a.createdAt.getTime()) / DAY);
        return diff === offset;
      }).length;
      // Dense 30-day view: label sparsely so text doesn't collide.
      const showLabel = windowDays <= 7 || offset % 5 === 0;
      return {
        label: showLabel
          ? dayDate.toLocaleDateString("en-GB", windowDays <= 7 ? { weekday: "narrow" } : { day: "numeric", month: "short" })
          : "",
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
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading
        eyebrow="Momentum"
        title="Activity"
        action={
          <div className="inline-flex rounded-full p-0.5" style={{ background: "var(--mist)" }}>
            {[7, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setWindowDays(d)}
                aria-pressed={windowDays === d}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  background: windowDays === d ? "white" : "transparent",
                  color: windowDays === d ? INK : INK_MUTED,
                  boxShadow: windowDays === d ? "0 1px 2px rgba(19,32,27,0.08)" : "none",
                }}
              >
                {d}D
              </button>
            ))}
          </div>
        }
      />

      <div className="flex items-baseline gap-2 mb-1">
        <span
          className="text-2xl font-semibold tabular-nums"
          style={{ fontFamily: "var(--font-mono)", color: INK }}
        >
          {formatNumber(stats.currentCount)}
        </span>
        <span className="text-[12px]" style={{ color: INK_MUTED }}>
          analyses in the last {windowDays} days
        </span>
      </div>
      <p className="text-[12px] mb-4" style={{ color: delta >= 0 ? "var(--forest)" : RED }}>
        {delta === 0
          ? `Same as the previous ${windowDays} days`
          : `${delta > 0 ? "+" : ""}${delta} vs. the previous ${windowDays} days (${stats.previousCount})`}
      </p>

      <div
        className="flex items-end gap-1.5 h-16 mb-4"
        role="img"
        aria-label={`Analyses per day over the last ${windowDays} days, ranging up to ${maxBucket}`}
      >
        {stats.dayBuckets.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <div
              className="w-full rounded-t-[3px]"
              style={{
                height: `${Math.max(4, Math.round((d.count / maxBucket) * 100))}%`,
                background: "var(--forest)",
                opacity: d.count === 0 ? 0.15 : 0.85,
              }}
            />
            <span className="text-[9px] whitespace-nowrap" style={{ color: INK_FAINT }}>
              {d.label}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 text-[12px] pt-3" style={{ borderTop: "1px solid var(--border)", color: INK_MUTED }}>
        <span>
          <strong style={{ color: INK }}>{formatNumber(stats.completed)}</strong> completed
        </span>
        <span>
          <strong style={{ color: INK }}>{formatNumber(stats.processing)}</strong> processing
        </span>
        <span>
          <strong style={{ color: INK }}>{formatNumber(stats.failed)}</strong> failed
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Active jobs
 * ---------------------------------------------------------------------- */

function ActiveJobs({ jobs }) {
  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading
        eyebrow="Roles"
        title="Active jobs"
        action={
          <Link
            href="/dashboard/jobs"
            className="text-[12px] font-semibold shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
            style={{ color: "var(--forest)" }}
          >
            All jobs →
          </Link>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState title="No active jobs" body="Jobs will appear here once candidates have been analysed against them." />
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {jobs.map((job) => (
            <li key={job.key} className="py-3.5">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p
                  className="text-sm font-semibold truncate"
                  style={{ color: INK }}
                  title={`${job.jobTitle}${job.company ? ` · ${job.company}` : ""}`}
                >
                  {job.jobTitle}
                  {job.company ? <span style={{ color: INK_MUTED, fontWeight: 500 }}> · {job.company}</span> : null}
                </p>
                <span
                  className="text-[12px] tabular-nums shrink-0"
                  style={{ fontFamily: "var(--font-mono)", color: INK_MUTED }}
                >
                  {formatNumber(job.candidateCount)} candidates
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden flex" style={{ background: "var(--mist)" }}>
                  {job.stageSegments.map((seg) =>
                    seg.pct > 0 ? (
                      <div
                        key={seg.key}
                        style={{ width: `${seg.pct}%`, background: seg.isPlaced ? "var(--forest)" : "#a9c4b5" }}
                      />
                    ) : null
                  )}
                </div>
                <span className="text-[11px] shrink-0" style={{ color: INK_FAINT }}>
                  {formatNumber(job.strongMatches)} strong
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Recruiter performance
 * ---------------------------------------------------------------------- */

function RecruiterPerformance({ recruiters }) {
  if (recruiters.length === 0) return null;

  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading
        eyebrow="Team"
        title="Recruiter performance"
        action={
          <Link
            href="/dashboard/analytics"
            className="text-[12px] font-semibold shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
            style={{ color: "var(--forest)" }}
          >
            Full analytics →
          </Link>
        }
      />
      <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
        {recruiters.map((r) => (
          <li key={r.name} className="flex items-center justify-between gap-3 py-3">
            <p className="text-sm font-semibold truncate" style={{ color: INK }} title={r.name}>
              {r.name}
            </p>
            <div className="flex items-center gap-4 text-[12px] shrink-0" style={{ color: INK_MUTED }}>
              <span>
                <strong style={{ color: INK, fontFamily: "var(--font-mono)" }}>{formatNumber(r.completed)}</strong> analysed
              </span>
              <span>
                <strong style={{ color: INK, fontFamily: "var(--font-mono)" }}>{r.avgScore ?? "—"}</strong> avg
              </span>
              <span>
                <strong style={{ color: "var(--forest)", fontFamily: "var(--font-mono)" }}>{formatNumber(r.placements)}</strong> placed
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Recent analyses
 * ---------------------------------------------------------------------- */

function RecentAnalyses({ analyses }) {
  const router = useRouter();

  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Activity feed" title="Recent analyses" />

      {analyses.length === 0 ? (
        <EmptyState
          title="No analyses yet"
          body="Upload your first CV to start screening candidates against your roles."
          actionLabel="New analysis"
          actionHref="/analyse"
        />
      ) : (
        <div className="overflow-hidden">
          <table className="w-full text-left border-collapse">
            <caption className="sr-only">Recent candidate analyses</caption>
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: INK_FAINT }}>
                <th scope="col" className="py-2 font-semibold">
                  Candidate
                </th>
                <th scope="col" className="py-2 font-semibold hidden md:table-cell">
                  Recruiter
                </th>
                <th scope="col" className="py-2 font-semibold hidden sm:table-cell">
                  Stage
                </th>
                <th scope="col" className="py-2 font-semibold">
                  Status
                </th>
                <th scope="col" className="py-2 font-semibold text-right">
                  Score
                </th>
                <th scope="col" className="py-2 font-semibold text-right hidden sm:table-cell">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {analyses.map((a) => {
                // Completed analyses open the candidate workspace, same as
                // every other section on this page (Top candidates,
                // Attention panel). Only an in-flight or failed *analysis*
                // — which has no candidate workspace yet — opens the raw
                // analysis-result view.
                const href = a.status === "completed" ? `/dashboard/candidates/${a.id}` : `/analyse/${a.id}`;
                return (
                  <tr
                    key={a.id}
                    onClick={() => router.push(href)}
                    className="group cursor-pointer transition-colors hover:bg-[var(--mist)] focus-within:bg-[var(--mist)]"
                    style={{ borderTop: "1px solid var(--border)" }}
                  >
                    <td className="py-3 pr-3 min-w-0">
                      <Link
                        href={href}
                        onClick={(e) => e.stopPropagation()}
                        title={`${a.candidateName} — ${a.jobTitle}${a.company ? ` · ${a.company}` : ""}`}
                        className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
                      >
                        <p className="text-sm font-semibold truncate" style={{ color: INK }}>
                          {a.candidateName}
                        </p>
                        <p className="text-[12px] truncate" style={{ color: INK_MUTED }}>
                          {a.jobTitle}
                          {a.company ? ` · ${a.company}` : ""}
                        </p>
                      </Link>
                    </td>
                    <td className="py-3 pr-3 hidden md:table-cell">
                      <span className="text-[13px] truncate" style={{ color: INK_MUTED }}>
                        {a.recruiterName ?? "Unassigned"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 hidden sm:table-cell">
                      <StageBadge stage={a.stage} />
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ fontFamily: "var(--font-mono)", color: scoreColor(a.score) }}
                      >
                        {a.score ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right hidden sm:table-cell">
                      <span className="text-[12px] whitespace-nowrap" style={{ color: INK_FAINT }}>
                        {formatDate(a.createdAt)}
                      </span>
                    </td>
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

/* ------------------------------------------------------------------------
 * Footer
 * ---------------------------------------------------------------------- */

function DashboardFooter() {
  return (
    <footer
      className="flex flex-wrap items-center justify-between gap-3 pt-4 text-[12px]"
      style={{ color: INK_FAINT, borderTop: "1px solid var(--border)" }}
    >
      <span>Helixon — recruiter dashboard</span>
      <nav className="flex items-center gap-4" aria-label="Support links">
        <Link href="/faq" className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded">
          FAQ
        </Link>
        <Link href="/contact" className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded">
          Contact
        </Link>
        <Link href="/privacy" className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded">
          Privacy
        </Link>
      </nav>
    </footer>
  );
}

/* ------------------------------------------------------------------------
 * Loading skeleton — mirrors the real layout so nothing shifts on load.
 * Only shown when there is no data yet; a refresh of existing data uses
 * the small inline indicator in the header instead (see DashboardHeader).
 * ---------------------------------------------------------------------- */

function Block({ className = "", style = {} }) {
  return (
    <div
      className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`}
      style={{ background: "var(--mist)", ...style }}
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8" aria-busy="true" aria-label="Loading dashboard">
      <div className="rounded-[16px] p-6 sm:p-8" style={CARD}>
        <Block className="h-4 w-24 mb-4" />
        <Block className="h-7 w-64 mb-3" />
        <Block className="h-4 w-80" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[14px] p-5" style={CARD}>
            <Block className="h-3 w-20 mb-3" />
            <Block className="h-7 w-14" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <div className="rounded-[14px] p-6" style={CARD}>
          <Block className="h-4 w-40 mb-5" />
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Block key={i} className="h-20" />
            ))}
          </div>
        </div>
        <div className="rounded-[14px] p-6" style={CARD}>
          <Block className="h-4 w-24 mb-5" />
          <Block className="h-6 w-full mb-3" />
          <Block className="h-2 w-full" />
        </div>
      </div>

      <div className="rounded-[14px] p-6" style={CARD}>
        <Block className="h-4 w-48 mb-5" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Block key={i} className="h-12 w-full mb-2" />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-[14px] p-6" style={CARD}>
            <Block className="h-4 w-40 mb-5" />
            {Array.from({ length: 4 }).map((_, j) => (
              <Block key={j} className="h-10 w-full mb-2" />
            ))}
          </div>
        ))}
      </div>

      <div className="rounded-[14px] p-6" style={CARD}>
        <Block className="h-4 w-40 mb-5" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Block key={i} className="h-10 w-full mb-2" />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Full-page error — only shown when there is no data at all (first load
 * failed). A refresh failure with existing data on screen is handled
 * inline in the header instead, so a good load is never thrown away.
 * ---------------------------------------------------------------------- */

function DashboardError({ onRetry }) {
  return (
    <div className="rounded-[16px] p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1" style={{ color: INK }}>
        Unable to load dashboard
      </p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: INK_MUTED }}>
        Something went wrong while loading your recruitment data.
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

/* ------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------- */

export default function AgencyDashboardPage() {
  const [data, setData] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsFetching(true);

    fetchDashboardData()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setHasError(false);
      })
      .catch(() => {
        if (cancelled) return;
        setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const stageOrder = useMemo(() => Object.keys(STAGE_LABELS ?? {}), []);
  const lastStageKey = stageOrder[stageOrder.length - 1];
  const firstStageKey = stageOrder[0];

  const model = useMemo(() => {
    const rawAnalyses = data?.recentAnalyses ?? [];
    const analyses = rawAnalyses
      .map((raw, i) => normalizeAnalysis(raw, i))
      .filter(Boolean)
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

    const completed = analyses.filter((a) => a.status === "completed");
    const processing = analyses.filter((a) => a.status === "processing");
    const failed = analyses.filter((a) => a.status === "failed");

    const strongMatches = completed.filter((a) => a.score !== null && a.score >= 80);
    const avgScore = completed.length
      ? Math.round(completed.reduce((sum, a) => sum + (a.score ?? 0), 0) / completed.length)
      : 0;

    const now = Date.now();
    const DAY = 86400000;
    const last7 = analyses.filter((a) => a.createdAt && now - a.createdAt.getTime() < 7 * DAY);
    const prev7 = analyses.filter(
      (a) => a.createdAt && now - a.createdAt.getTime() >= 7 * DAY && now - a.createdAt.getTime() < 14 * DAY
    );

    const inPipeline = completed.filter((a) => a.stage && a.stage !== lastStageKey).length;

    // Pipeline stage counts
    const stageCounts = {};
    stageOrder.forEach((key) => {
      stageCounts[key] = completed.filter((a) => a.stage === key).length;
    });
    const maxStageCount = Math.max(0, ...Object.values(stageCounts));

    // Needs attention
    const attentionItems = [];

    failed.forEach((a) => {
      attentionItems.push({
        id: `${a.id}-failed`,
        candidateName: a.candidateName,
        jobTitle: a.jobTitle,
        score: null,
        createdAt: a.createdAt,
        reasonLabel: "Analysis failed",
        tone: { bg: RED_BG, fg: RED_STRONG },
        actionLabel: "Retry analysis",
        actionHref: `/analyse/${a.id}`,
        priority: 0,
      });
    });

    processing
      .filter((a) => a.createdAt && now - a.createdAt.getTime() > 12 * 60 * 60 * 1000)
      .forEach((a) => {
        attentionItems.push({
          id: `${a.id}-processing`,
          candidateName: a.candidateName,
          jobTitle: a.jobTitle,
          score: null,
          createdAt: a.createdAt,
          reasonLabel: "Still processing",
          tone: { bg: AMBER_BG, fg: AMBER },
          actionLabel: "Open analysis",
          actionHref: `/analyse/${a.id}`,
          priority: 1,
        });
      });

    // Strong matches: previously required stage === firstStageKey, which
    // meant a completed, high-scoring candidate with no stage set yet
    // (stage === null) never surfaced here. A fresh strong match should
    // always get attention regardless of whether it's been staged.
    completed
      .filter((a) => a.score !== null && a.score >= 80 && (a.stage === firstStageKey || a.stage === null))
      .forEach((a) => {
        attentionItems.push({
          id: `${a.id}-unreviewed`,
          candidateName: a.candidateName,
          jobTitle: a.jobTitle,
          score: a.score,
          createdAt: a.createdAt,
          reasonLabel: a.stage ? `Strong match · ${STAGE_LABELS[a.stage]}` : "Strong match · Unstaged",
          tone: { bg: GREEN_BG, fg: "var(--forest)" },
          actionLabel: "Review candidate",
          actionHref: `/dashboard/candidates/${a.id}`,
          priority: 2,
        });
      });

    const midStages = stageOrder.slice(1, -1);
    completed
      .filter(
        (a) =>
          midStages.includes(a.stage) &&
          a.createdAt &&
          now - a.createdAt.getTime() > 5 * DAY
      )
      .forEach((a) => {
        attentionItems.push({
          id: `${a.id}-stalled`,
          candidateName: a.candidateName,
          jobTitle: a.jobTitle,
          score: a.score,
          createdAt: a.createdAt,
          reasonLabel: `Stalled · ${STAGE_LABELS[a.stage]}`,
          tone: { bg: AMBER_BG, fg: AMBER },
          actionLabel: "Review candidate",
          actionHref: `/dashboard/candidates/${a.id}`,
          priority: 3,
        });
      });

    // Completed but never staged, and not already caught above as a
    // strong match — otherwise these candidates never appear anywhere
    // that prompts action.
    completed
      .filter((a) => a.stage === null && !(a.score !== null && a.score >= 80))
      .forEach((a) => {
        attentionItems.push({
          id: `${a.id}-unstaged`,
          candidateName: a.candidateName,
          jobTitle: a.jobTitle,
          score: a.score,
          createdAt: a.createdAt,
          reasonLabel: "Awaiting stage",
          tone: { bg: "var(--mist)", fg: INK_MUTED },
          actionLabel: "Assign stage",
          actionHref: `/dashboard/candidates/${a.id}`,
          priority: 4,
        });
      });

    attentionItems.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
    });

    // Strongest candidates
    const topCandidates = [...completed]
      .filter((a) => a.score !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    // Active jobs — derived from analyses, grouped by job + company
    const jobMap = new Map();
    completed.forEach((a) => {
      const key = `${a.jobTitle}__${a.company ?? ""}`;
      if (!jobMap.has(key)) {
        jobMap.set(key, {
          key,
          jobTitle: a.jobTitle,
          company: a.company,
          candidateCount: 0,
          strongMatches: 0,
          stageCounts: {},
        });
      }
      const job = jobMap.get(key);
      job.candidateCount += 1;
      if (a.score !== null && a.score >= 80) job.strongMatches += 1;
      if (a.stage) job.stageCounts[a.stage] = (job.stageCounts[a.stage] ?? 0) + 1;
    });

    const jobs = Array.from(jobMap.values())
      .map((job) => {
        const segments = stageOrder.map((key) => ({
          key,
          pct: job.candidateCount > 0 ? Math.round(((job.stageCounts[key] ?? 0) / job.candidateCount) * 100) : 0,
          isPlaced: key === lastStageKey,
        }));
        return { ...job, stageSegments: segments };
      })
      .sort((a, b) => b.candidateCount - a.candidateCount)
      .slice(0, 5);

    // Recruiter performance — derived from analyses
    const recruiterMap = new Map();
    completed.forEach((a) => {
      if (!a.recruiterName) return;
      if (!recruiterMap.has(a.recruiterName)) {
        recruiterMap.set(a.recruiterName, { name: a.recruiterName, completed: 0, scoreSum: 0, scoreCount: 0, placements: 0 });
      }
      const r = recruiterMap.get(a.recruiterName);
      r.completed += 1;
      if (a.score !== null) {
        r.scoreSum += a.score;
        r.scoreCount += 1;
      }
      if (a.stage === lastStageKey) r.placements += 1;
    });

    const recruiters = Array.from(recruiterMap.values())
      .map((r) => ({
        ...r,
        avgScore: r.scoreCount > 0 ? Math.round(r.scoreSum / r.scoreCount) : null,
      }))
      .sort((a, b) => b.placements - a.placements || (b.avgScore ?? 0) - (a.avgScore ?? 0))
      .slice(0, 4);

    return {
      analyses,
      totals: {
        total: analyses.length,
        completed: completed.length,
        processing: processing.length,
        failed: failed.length,
        strongMatches: strongMatches.length,
        strongMatchPct: completed.length ? Math.round((strongMatches.length / completed.length) * 100) : 0,
        avgScore,
        last7: last7.length,
        prev7: prev7.length,
        inPipeline,
      },
      stageCounts,
      maxStageCount,
      attentionItems: attentionItems.slice(0, 6),
      topCandidates,
      jobs,
      recruiters,
    };
  }, [data, stageOrder, lastStageKey, firstStageKey]);

  const agencyName = data?.agency?.name ?? "your agency";
  const plan = data?.agency?.plan ?? null;

  const subtitle = useMemo(() => {
    if (!data) return "";
    if (model.analyses.length === 0) {
      return "Upload your first CV to start screening candidates against your roles.";
    }
    const attentionCount = model.attentionItems.length;
    const strongCount = model.totals.strongMatches;
    if (attentionCount > 0) {
      return `${attentionCount} ${attentionCount === 1 ? "item needs" : "items need"} your attention, and ${strongCount} strong ${
        strongCount === 1 ? "candidate is" : "candidates are"
      } ready to move forward.`;
    }
    if (strongCount > 0) {
      return `Your pipeline is in good shape — ${strongCount} strong ${strongCount === 1 ? "candidate is" : "candidates are"} ready to move forward.`;
    }
    return "Your pipeline is in good shape. Here's what's been happening lately.";
  }, [data, model]);

  const hasData = !!data;

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />

      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6 lg:space-y-8">
        {!hasData && isFetching && <DashboardSkeleton />}

        {!hasData && !isFetching && hasError && <DashboardError onRetry={retry} />}

        {hasData && (
          <>
            <DashboardHeader
              agencyName={agencyName}
              plan={plan}
              subtitle={subtitle}
              isRefreshing={isFetching}
              refreshError={!isFetching && hasError}
              onRefresh={retry}
            />

            {model.analyses.length === 0 ? (
              <div className="rounded-[16px]" style={CARD}>
                <EmptyState
                  title="No candidates yet"
                  body="Your pipeline is empty. Upload your first CV to start screening candidates against your roles."
                  actionLabel="New analysis"
                  actionHref="/analyse"
                />
              </div>
            ) : (
              <>
                <DashboardKpis totals={model.totals} />

                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 lg:gap-6">
                  <PipelineSnapshot stageOrder={stageOrder} stageCounts={model.stageCounts} maxCount={model.maxStageCount} />
                  <UsageSummary plan={plan} />
                </div>

                <AttentionPanel items={model.attentionItems} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                  <TopCandidates candidates={model.topCandidates} />
                  <ActivityOverview analyses={model.analyses} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
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