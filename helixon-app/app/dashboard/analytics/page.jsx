"use client";

// /dashboard/analytics - every figure is computed from the agency's own data:
// app/api/analytics/snapshot works out the funnel, conversion, quality,
// trends and changes vs the previous period server-side, and
// app/api/analytics/timing adds the time-based, commercial, feedback and
// recruiter-verdict figures. Nothing here is a static or generic number.
// Bars and funnels are plain divs; the over-time charts use recharts.

// The sections live in ./_components (charts, sections, states).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { getAnalyticsSnapshot as fetchAnalytics, getClients, getJobs, getRecruiters } from "@/lib/dashboard-api";
import { useOffices } from "@/components/dashboard/use-offices";
import { downloadCsv } from "@/lib/csv";
import { analyticsCsvRows } from "@/lib/analytics/csv";
import { printSection } from "@/lib/ui/print";
import { INK, INK_MUTED, INK_FAINT, AMBER, GREEN_BG, CARD } from "@/lib/candidates/format";
import { reportQuietly } from "@/lib/report-error";
import { SectionHeading } from "@/components/ui";
import { PAGE_FRAME_WIDE } from "@/components/dashboard/page-frame";
import { Delta, FunnelChart, QualityDistribution, RecruiterVerdicts, ScoreCalibration, StatCard, Trends } from "./_components/charts";
import {
  AdvertisingTable,
  FeedbackRow,
  FinancialRow,
  OutreachRow,
  PipelineBar,
  RankedList,
  RetentionAndReuse,
  TimeInStage,
  TimingRow,
} from "./_components/sections";
import { AnalyticsSkeleton, ErrorState } from "./_components/states";

const PERIODS = [
  { value: "all", label: "All time" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
  { value: "custom", label: "Custom range…" },
];

const DATE_INPUT_CLASS = "text-[14px] px-3 py-2 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

function fmtDay(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
}

function FilterSelect({ value, onChange, options, ariaLabel }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-[14px] font-semibold px-3.5 py-2 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
    getJobs().then(setJobs).catch(reportQuietly);
    getRecruiters().then(setRecruiters).catch(reportQuietly);
    getClients().then((c) => setClients(c || [])).catch(reportQuietly);
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
      <div className={`${PAGE_FRAME_WIDE} space-y-6`}>
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
              className="text-[14px] font-semibold px-2"
              style={{ color: "var(--forest)" }}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            disabled={status !== "ready"}
            onClick={() => printSection("analytics-report")}
            className="ml-auto inline-flex items-center gap-1.5 text-[14px] font-semibold px-3.5 py-2 rounded-full bg-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold px-3.5 py-2 rounded-full bg-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
              <SectionHeading eyebrow="Funnel" title="Furthest stage each candidate reached" />
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
                title="Where candidates are now"
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
              <ul className="divide-y">
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
