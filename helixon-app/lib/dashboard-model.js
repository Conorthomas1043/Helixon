// Extracted from the dashboard's client-side `model` useMemo so the exact
// same attention/KPI logic runs server-side and produces an identical
// shape. If you keep a client fallback for any reason, both should call
// this one function rather than drifting into two implementations.
//
// `candidates` - normalized rows, one per candidate:
//   { id, candidateName, jobTitle, company, recruiterName, status,
//     stage, score, createdAt (Date) }

import { STAGE_LABELS, FUNNEL_ORDER } from "./stage-labels";

const DAY = 86400000;

const TONE = {
  red: { bg: "#fef2f2", fg: "#b91c1c" },
  amber: { bg: "#fff8e6", fg: "#92620f" },
  green: { bg: "#eef7f1", fg: "var(--forest)" },
  neutral: { bg: "var(--mist)", fg: "#5a7a6a" },
};

export function computeCandidateStats(candidates, now = Date.now()) {
  // Funnel-only order - excludes "Rejected", which is a terminal exit
  // rather than a step every candidate is expected to pass through.
  const stageOrder = FUNNEL_ORDER;
  const firstStageKey = stageOrder[0];
  const lastStageKey = stageOrder[stageOrder.length - 1];
  const midStages = stageOrder.slice(1, -1);

  const analyses = [...candidates].sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  );

  const completed = analyses.filter((a) => a.status === "completed");
  const processing = analyses.filter((a) => a.status === "processing");
  const failed = analyses.filter((a) => a.status === "failed");

  const strongMatches = completed.filter((a) => a.score !== null && a.score >= 80);
  const avgScore = completed.length
    ? Math.round(completed.reduce((sum, a) => sum + (a.score ?? 0), 0) / completed.length)
    : 0;

  const last7 = analyses.filter((a) => a.createdAt && now - a.createdAt.getTime() < 7 * DAY);
  const prev7 = analyses.filter(
    (a) => a.createdAt && now - a.createdAt.getTime() >= 7 * DAY && now - a.createdAt.getTime() < 14 * DAY
  );

  const rejected = completed.filter((a) => a.stage === "Rejected");
  const inPipeline = completed.filter(
    (a) => a.stage && a.stage !== lastStageKey && a.stage !== "Rejected"
  ).length;

  const stageCounts = {};
  stageOrder.forEach((key) => {
    stageCounts[key] = completed.filter((a) => a.stage === key).length;
  });
  const maxStageCount = Math.max(0, ...Object.values(stageCounts));

  const attentionItems = [];

  failed.forEach((a) => {
    attentionItems.push({
      id: `${a.id}-failed`,
      candidateName: a.candidateName,
      jobTitle: a.jobTitle,
      score: null,
      createdAt: a.createdAt,
      reasonLabel: "Analysis failed",
      tone: TONE.red,
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
        tone: TONE.amber,
        actionLabel: "Open analysis",
        actionHref: `/analyse/${a.id}`,
        priority: 1,
      });
    });

  // Strong match should surface whether or not it's been staged yet -
  // requiring stage === firstStageKey used to hide unstaged strong matches.
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
        tone: TONE.green,
        actionLabel: "Review candidate",
        actionHref: `/dashboard/candidates/${a.id}`,
        priority: 2,
      });
    });

  completed
    .filter((a) => midStages.includes(a.stage) && a.createdAt && now - a.createdAt.getTime() > 5 * DAY)
    .forEach((a) => {
      attentionItems.push({
        id: `${a.id}-stalled`,
        candidateName: a.candidateName,
        jobTitle: a.jobTitle,
        score: a.score,
        createdAt: a.createdAt,
        reasonLabel: `Stalled · ${STAGE_LABELS[a.stage]}`,
        tone: TONE.amber,
        actionLabel: "Review candidate",
        actionHref: `/dashboard/candidates/${a.id}`,
        priority: 3,
      });
    });

  // Completed, never staged, and not already caught as a strong match -
  // otherwise these candidates never prompt any action anywhere.
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
        tone: TONE.neutral,
        actionLabel: "Assign stage",
        actionHref: `/dashboard/candidates/${a.id}`,
        priority: 4,
      });
    });

  attentionItems.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
  });

  const topCandidates = [...completed]
    .filter((a) => a.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

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
      rejected: rejected.length,
    },
    stageCounts,
    maxStageCount,
    attentionItems: attentionItems.slice(0, 6),
    topCandidates,
  };
}
