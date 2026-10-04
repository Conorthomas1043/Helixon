"use client";

import DashboardNav from "@/components/DashboardNav";
import { FUNNEL_ORDER, STAGE_LABELS } from "@/lib/stage-labels";
import { PulseSurvey } from "@/components/dashboard/research";
import { STRONG_MATCH_MIN } from "@/lib/scoreBands";
import { computeCandidateStats } from "@/lib/dashboard-model";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSetting } from "@/lib/hooks/useLocalSetting";
import { useUser } from "@clerk/nextjs";
import { AgendaPanel, AttentionPanel, FollowUpsPanel, RisksPanel } from "./_components/attention";
import { DashboardFooter, DashboardHeader, GettingStarted, ScopeToggle, TeamWelcome, TruncatedNotice } from "./_components/header";
import { ActiveJobs, RecruiterPerformance } from "./_components/jobs-team";
import { BusinessKpis, DashboardKpis, TargetsCard, UsageSummary } from "./_components/kpis";
import { ActivityOverview, PipelineSnapshot, RecentAnalyses, TopCandidates } from "./_components/pipeline";
import { BG, CARD, TEXT_FAINT } from "./_components/shared";
import { DashboardError, DashboardSkeleton, EmptyState } from "./_components/states";

/* ─── Data loading ──────────────────────────────────────────────────────── */

async function fetchDashboardData() {
  const res = await fetch("/api/dashboard-stats", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load dashboard data");
  return toDashboardData(await res.json());
}

function toDashboardData(raw) {
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

/* ─── Joining a team ────────────────────────────────────────────────────── */

// For someone invited into a workspace that's already running: the agency's
// checklist above doesn't apply (it's for an empty workspace), so they used
// to land on a full dashboard with no orientation. A short, dismissible
// list of where things are. Structured orientation measurably speeds how
// fast newcomers become productive (Bauer, Bodner, Erdogan, Truxillo &
// Tucker, 2007, "Newcomer adjustment during organizational socialization:
// A meta-analytic review", Journal of Applied Psychology 92(3)).
const JOINED_KEY = "helixon_team_welcome_dismissed";

/* ─── Scope, targets, truncation ────────────────────────────────────────── */

const SCOPE_KEY = "helixon.dashboard.scope";

/* ─── Page ──────────────────────────────────────────────────────────────── */

// `initialStats` is /api/dashboard-stats's answer as page.js loaded it on the
// server; with it the page shows straight away and only fetches again on
// refresh. Without it (the server load failed), the page fetches it itself.
export default function DashboardHome({ initialStats = null }) {
  const [data, setData] = useState(() => (initialStats ? toDashboardData(initialStats) : null));
  const [hasError, setHasError] = useState(false);
  const [isFetching, setIsFetching] = useState(!initialStats);
  const [reloadKey, setReloadKey] = useState(0);
  const serverLoaded = useRef(Boolean(initialStats));

  useEffect(() => {
    if (serverLoaded.current && reloadKey === 0) return;
    serverLoaded.current = false;
    let cancelled = false;
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
  // Mine/Team, remembered per browser. The server render (and hydration)
  // use "team"; a remembered "mine" takes over straight after.
  const [storedScope, setScope] = useLocalSetting(SCOPE_KEY, "team");
  const scope = storedScope === "mine" ? "mine" : "team";

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
  // Hidden in the server render; shown once the browser confirms it wasn't
  // dismissed.
  const [welcomeDismissed, setWelcomeDismissed] = useLocalSetting(JOINED_KEY, "1");
  const teamWelcomeDismissed = welcomeDismissed === "1";
  const isNewTeammate =
    data != null && model.hasTeammates && myId && !model.everyone.some((a) => a.recruiterId === myId) && !teamWelcomeDismissed;
  const dismissTeamWelcome = () => setWelcomeDismissed("1");

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
