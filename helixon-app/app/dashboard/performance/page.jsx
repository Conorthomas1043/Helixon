"use client";

// /dashboard/performance - the team leaderboard: each recruiter's CVs,
// calls, CVs sent, interviews, offers, placements, fees and cash for a
// period, against their targets, with commission where a plan is set up
// (app/api/performance, lib/performance.js).

import { useCallback, useEffect, useMemo, useState } from "react";
import { getPerformance } from "@/lib/dashboard-api";
import { METRICS, METRIC_KEYS, PERIODS } from "@/lib/performance";
import { Page, PageHeader, Card, Button, ErrorState, LoadingCard, Select, formatMoney, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

function value(key, n) {
  return METRICS[key].money ? formatMoney(n) : Number(n || 0).toLocaleString("en-GB");
}

function Progress({ actual, target }) {
  if (!target) return null;
  const pct = Math.min(100, Math.round((actual / target) * 100));
  return (
    <div className="mt-1" title={`${pct}% of target`}>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--mist)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--forest)" : pct >= 60 ? "var(--gold)" : "var(--score-low)" }} />
      </div>
    </div>
  );
}

const MEDALS = ["🥇", "🥈", "🥉"];

export default function PerformancePage() {
  const [period, setPeriod] = useState("this_month");
  const [rankBy, setRankBy] = useState("fees");
  const [state, setState] = useState({ period: null, data: null, error: false });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPerformance(period)
      .then((data) => {
        if (!cancelled) setState({ period, data, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ period, data: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [period, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const loading = state.period !== period;
  const data = state.data;
  const ranked = useMemo(() => [...(data?.people || [])].sort((a, b) => b.metrics[rankBy] - a.metrics[rankBy] || a.name.localeCompare(b.name)), [data, rankBy]);
  const showCommission = Boolean(data?.commission) && ranked.some((p) => p.commission != null);

  return (
    <Page width={1280}>
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

      {state.error && !loading ? (
        <ErrorState body="Performance couldn't be loaded." onRetry={reload} />
      ) : loading || !data ? (
        <LoadingCard rows={6} />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {METRIC_KEYS.map((k) => (
              <div key={k} className="rounded-[12px] px-3 py-2.5 bg-white" style={{ border: "1px solid var(--border)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: INK_FAINT }}>
                  {METRICS[k].short}
                </p>
                <p className="text-lg font-semibold tabular-nums" style={{ color: INK }}>
                  {value(k, data.team.metrics[k])}
                </p>
                {data.team.targets[k] ? (
                  <>
                    <p className="text-[10px]" style={{ color: INK_MUTED }}>
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
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest" style={{ color: INK_FAINT }}>
                    <th className="px-5 sm:px-6 py-2 font-semibold">Recruiter</th>
                    {METRIC_KEYS.map((k) => (
                      <th key={k} className="px-2 py-2 font-semibold text-right whitespace-nowrap" style={k === rankBy ? { color: INK } : null}>
                        {METRICS[k].short}
                      </th>
                    ))}
                    {showCommission && <th className="px-5 sm:px-6 py-2 font-semibold text-right">Commission</th>}
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((p, i) => (
                    <tr key={p.id} style={{ borderTop: "1px solid var(--border)", background: p.me ? "var(--mist)" : undefined }}>
                      <td className="px-5 sm:px-6 py-2.5 whitespace-nowrap font-semibold" style={{ color: INK }}>
                        <span className="inline-block w-6">{p.metrics[rankBy] > 0 ? MEDALS[i] || `${i + 1}.` : ""}</span>
                        {p.name}
                        {p.me && (
                          <span className="ml-1 text-[11px] font-normal" style={{ color: INK_MUTED }}>
                            (you)
                          </span>
                        )}
                      </td>
                      {METRIC_KEYS.map((k) => (
                        <td key={k} className="px-2 py-2.5 text-right tabular-nums align-top" style={{ color: INK, minWidth: 72 }}>
                          {value(k, p.metrics[k])}
                          {p.targets[k] ? (
                            <>
                              <span className="block text-[10px]" style={{ color: INK_FAINT }}>
                                / {value(k, p.targets[k])}
                              </span>
                              <Progress actual={p.metrics[k]} target={p.targets[k]} />
                            </>
                          ) : null}
                        </td>
                      ))}
                      {showCommission && (
                        <td className="px-5 sm:px-6 py-2.5 text-right tabular-nums font-semibold" style={{ color: INK }}>
                          {p.commission == null ? "-" : formatMoney(p.commission)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {showCommission && (
              <p className="text-[11px] mt-3" style={{ color: INK_FAINT }}>
                Commission is an estimate on {data.commission.basis === "cash" ? "cash collected" : "fees placed"} from your plan - you see your own; the owner and admins see everyone&apos;s.
              </p>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
