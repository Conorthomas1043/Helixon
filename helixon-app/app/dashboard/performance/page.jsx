"use client";

// /dashboard/performance - the team leaderboard: each recruiter's CVs,
// calls, CVs sent, interviews, offers, placements, fees and cash for a
// period, against their targets, with commission where a plan is set up
// (app/api/performance, lib/analytics/performance.js).

import { useMemo, useState } from "react";
import { getPerformance } from "@/lib/dashboard-api";
import { useResource } from "@/lib/hooks/useResource";
import { METRICS, METRIC_KEYS, PERIODS } from "@/lib/analytics/performance";
import { Page, PageHeader, Card, Button, ErrorState, LoadingCard, Select, formatMoney, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

function value(key, n) {
  return METRICS[key].money ? formatMoney(n) : Number(n || 0).toLocaleString("en-GB");
}

function Progress({ actual, target }) {
  if (!target) return null;
  const pct = Math.min(100, Math.round((actual / target) * 100));
  return (
    <div className="mt-1" title={`${pct}% of target`}>
      <div className="h-1.5 rounded-full overflow-hidden bg-[var(--mist)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--forest)" : pct >= 60 ? "var(--gold)" : "var(--score-low)" }} />
      </div>
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function PerformancePage() {
  const [period, setPeriod] = useState("this_month");
  const [rankBy, setRankBy] = useState("fees");
  const { data, error, loading, reload } = useResource(`performance:${period}`, () => getPerformance(period));
  const ranked = useMemo(() => [...(data?.people || [])].sort((a, b) => b.metrics[rankBy] - a.metrics[rankBy] || a.name.localeCompare(b.name)), [data, rankBy]);
  const showCommission = Boolean(data?.commission) && ranked.some((p) => p.commission != null);

  return (
    <Page>
      <PageHeader
        eyebrow="Team"
        title="Performance"
        subtitle="Activity and revenue per recruiter against target. Calls and CVs sent count what's logged on candidate profiles; fees count perm offers accepted in the period; cash is invoices paid (before VAT)."
        actions={
          <>
            <Select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value)} options={Object.entries(PERIODS).map(([value, label]) => ({ value, label }))} />
            {data?.canManage && (
              <Button href="/dashboard/settings/targets" size="sm">
                Targets & commission
              </Button>
            )}
          </>
        }
      />

      {error && !data ? (
        <ErrorState body="Performance couldn't be loaded." onRetry={reload} />
      ) : loading || !data ? (
        <LoadingCard rows={6} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {METRIC_KEYS.map((k) => (
              <div key={k} className="rounded-xl px-3 py-2.5 bg-white border border-[var(--border)]">
                <p className="text-12 font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
                  {METRICS[k].short}
                </p>
                <p className="text-lg font-semibold tabular-nums text-[var(--ink)]">
                  {value(k, data.team.metrics[k])}
                </p>
                {data.team.targets[k] ? (
                  <>
                    <p className="text-12 text-[var(--ink-soft)]">
                      of {value(k, data.team.targets[k])}
                    </p>
                    <Progress actual={data.team.metrics[k]} target={data.team.targets[k]} />
                  </>
                ) : null}
              </div>
            ))}
          </div>

          <Card
            title="Leaderboard"
            eyebrow={data.period.label}
            action={
              <Select
                aria-label="Rank by"
                value={rankBy}
                onChange={(e) => setRankBy(e.target.value)}
                options={METRIC_KEYS.map((k) => ({ value: k, label: `Rank by ${METRICS[k].label.toLowerCase()}` }))}
              />
            }
          >
            <div className="overflow-x-auto -mx-5 sm:-mx-6">
              <table className="w-full text-14">
                <thead>
                  <tr className="text-left text-12 uppercase tracking-widest text-[var(--ink-faint)]">
                    <th scope="col" className="px-5 sm:px-6 py-2 font-semibold">Recruiter</th>
                    {METRIC_KEYS.map((k) => (
                      <th scope="col" key={k} className="px-2 py-2 font-semibold text-right whitespace-nowrap" style={k === rankBy ? { color: INK } : null}>
                        {METRICS[k].short}
                      </th>
                    ))}
                    {showCommission && <th scope="col" className="px-5 sm:px-6 py-2 font-semibold text-right">Commission</th>}
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((p, i) => (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--border)", background: p.me ? "var(--mist)" : undefined }}>
                      <td className="px-5 sm:px-6 py-2.5 whitespace-nowrap font-semibold text-[var(--ink)]">
                        <span className="inline-block w-6">{p.metrics[rankBy] > 0 ? MEDALS[i] || `${i + 1}.` : ""}</span>
                        {p.name}
                        {p.me && (
                          <span className="ml-1 text-12 font-normal text-[var(--ink-soft)]">
                            (you)
                          </span>
                        )}
                      </td>
                      {METRIC_KEYS.map((k) => (
                        <td key={k} className="px-2 py-2.5 text-right tabular-nums align-top text-[var(--ink)] min-w-[72px]">
                          {value(k, p.metrics[k])}
                          {p.targets[k] ? (
                            <>
                              <span className="block text-12 text-[var(--ink-faint)]">
                                / {value(k, p.targets[k])}
                              </span>
                              <Progress actual={p.metrics[k]} target={p.targets[k]} />
                            </>
                          ) : null}
                        </td>
                      ))}
                      {showCommission && (
                        <td className="px-5 sm:px-6 py-2.5 text-right tabular-nums font-semibold text-[var(--ink)]">
                          {p.commission == null ? "-" : formatMoney(p.commission)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {showCommission && (
              <p className="text-12 mt-3 text-[var(--ink-faint)]">
                Commission is an estimate on {data.commission.basis === "cash" ? "cash collected" : "fees placed"} from your plan - you see your own; the owner and admins see everyone&apos;s.
              </p>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
