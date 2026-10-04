"use client";

// /dashboard/business-development - winning new clients: a board of deals
// by stage (app/api/opportunities, lib/opportunities.js), pipeline totals,
// and the client follow-ups that are due.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { getClients, getOpportunities, getRecruiters, setClientNextAction, updateOpportunity } from "@/lib/dashboard-api";
import { OPEN_STAGES, OPPORTUNITY_STAGES, effectiveProbability, pipelineSummary } from "@/lib/opportunities";
import { OpportunityDialog, StagePill } from "@/components/dashboard/opportunities";
import { Button, Card, EmptyState, ErrorState, LoadingCard, Page, PageHeader, formatMoney, INK, INK_MUTED, INK_FAINT, CARD } from "@/components/dashboard/ui";
import { formatDateOnly } from "@/lib/candidate-format";

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-[14px] p-5" style={CARD}>
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: INK_FAINT }}>{label}</p>
      <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: INK }}>{value}</p>
      {sub && <p className="text-[11px] mt-1" style={{ color: INK_MUTED }}>{sub}</p>}
    </div>
  );
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function BusinessDevelopmentPage() {
  const [state, setState] = useState({ status: "loading", deals: [], clients: [], team: [], unavailable: false });
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState(null); // null | "new" | deal
  const [mineOnly, setMineOnly] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [error, setError] = useState("");
  const { user } = useUser();
  const myId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([getOpportunities(), getClients(), getRecruiters().catch(() => [])])
      .then(([d, clients, team]) => {
        if (!cancelled) setState({ status: "ready", deals: d.opportunities || [], clients: clients || [], team, unavailable: Boolean(d.unavailable) });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, status: "error" }));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    setDialog(null);
    setReloadKey((k) => k + 1);
  }, []);
  const close = useCallback(() => setDialog(null), []);

  const deals = useMemo(() => state.deals.filter((d) => !mineOnly || d.ownerId === myId), [state.deals, mineOnly, myId]);
  const summary = useMemo(() => pipelineSummary(deals, startOfMonth()), [deals]);
  const followUps = useMemo(
    () =>
      state.clients
        .filter((c) => c.nextAction && (!mineOnly || (c.nextAction.ownerId || c.ownerId) === myId))
        .sort((a, b) => (a.nextAction.dueAt || "9999").localeCompare(b.nextAction.dueAt || "9999")),
    [state.clients, mineOnly, myId]
  );
  const teamName = (id) => state.team.find((m) => m.id === id)?.name;

  async function move(deal, stage) {
    setError("");
    try {
      await updateOpportunity(deal.id, { stage });
      setState((s) => ({ ...s, deals: s.deals.map((d) => (d.id === deal.id ? { ...d, stage, closedAt: stage === "won" || stage === "lost" ? new Date().toISOString() : null } : d)) }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function completeFollowUp(client) {
    setError("");
    try {
      await setClientNextAction(client.id, { completed: true });
      setState((s) => ({ ...s, clients: s.clients.map((c) => (c.id === client.id ? { ...c, nextAction: null } : c)) }));
    } catch (err) {
      setError(err.message);
    }
  }

  const closed = deals.filter((d) => d.stage === "won" || d.stage === "lost");

  return (
    <Page width={1280}>
      <PageHeader
        eyebrow="Revenue"
        title="Business development"
        subtitle="New business with clients and prospects: every deal from first contact to signed terms, and the client follow-ups that are due."
        actions={
          <>
            <Button onClick={() => setMineOnly((v) => !v)} aria-pressed={mineOnly} variant={mineOnly ? "primary" : "secondary"}>
              {mineOnly ? "Showing mine" : "Showing everyone's"}
            </Button>
            <Button variant="primary" onClick={() => setDialog("new")}>
              New deal
            </Button>
          </>
        }
      />

      {state.status === "loading" && <LoadingCard rows={5} />}
      {state.status === "error" && <ErrorState title="Unable to load business development" onRetry={reload} />}
      {state.status === "ready" && state.unavailable && (
        <Card>
          <p className="text-[13px]" style={{ color: INK_MUTED }}>
            Deals need a database update (migration 20261003000000) before they can be saved. Client follow-ups below still work.
          </p>
        </Card>
      )}
      {error && <p className="text-[12px]" style={{ color: "var(--score-low)" }}>{error}</p>}

      {state.status === "ready" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Open pipeline" value={formatMoney(summary.openValue)} sub={`${summary.openCount} open deal${summary.openCount === 1 ? "" : "s"}`} />
            <Stat label="Weighted" value={formatMoney(summary.weightedValue)} sub="value × chance of winning" />
            <Stat label="Won this month" value={formatMoney(summary.wonValue)} sub={`${summary.wonCount} deal${summary.wonCount === 1 ? "" : "s"}`} />
            <Stat label="Win rate this month" value={summary.winRate == null ? "-" : `${summary.winRate}%`} sub={`${summary.wonCount} won · ${summary.lostCount} lost`} />
          </div>

          {deals.length === 0 && followUps.length === 0 ? (
            <EmptyState
              title="No deals yet"
              body="Add a prospect on the Clients page, then track the deal here as it moves from first contact to signed terms."
              action={<Button variant="primary" onClick={() => setDialog("new")}>New deal</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-[3fr_1fr] gap-6 items-start">
              <div className="space-y-6 min-w-0">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {OPEN_STAGES.map((stage) => {
                    const list = deals.filter((d) => d.stage === stage);
                    return (
                      <section key={stage} className="rounded-[14px] p-3 min-w-0" style={{ background: "white", border: "1px solid var(--border)" }} aria-label={OPPORTUNITY_STAGES[stage]}>
                        <header className="flex items-baseline justify-between px-1 mb-2">
                          <h2 className="text-[12px] font-semibold" style={{ color: INK }}>{OPPORTUNITY_STAGES[stage]}</h2>
                          <span className="text-[11px] tabular-nums" style={{ color: INK_FAINT }}>
                            {list.length} · {formatMoney(summary.byStage[stage].value)}
                          </span>
                        </header>
                        <ul className="space-y-2">
                          {list.length === 0 && <li className="text-[12px] px-1 py-2" style={{ color: INK_FAINT }}>None</li>}
                          {list.map((d) => {
                            const late = d.expectedClose && d.expectedClose < new Date().toISOString().slice(0, 10);
                            return (
                              <li key={d.id} className="rounded-[10px] p-3" style={{ background: "var(--mist)" }}>
                                <button type="button" onClick={() => setDialog(d)} className="w-full text-left">
                                  <span className="block text-[13px] font-semibold truncate" style={{ color: INK }}>{d.title}</span>
                                  <span className="block text-[12px] truncate" style={{ color: INK_MUTED }}>{d.clientName}</span>
                                  <span className="block text-[12px] tabular-nums mt-1" style={{ color: INK_MUTED }}>
                                    {d.value != null ? formatMoney(d.value) : "No value"} · {effectiveProbability(d)}%
                                  </span>
                                  {d.expectedClose && (
                                    <span className="block text-[11px]" style={{ color: late ? "var(--score-low)" : INK_FAINT }}>
                                      Close {formatDateOnly(d.expectedClose)}
                                    </span>
                                  )}
                                  {teamName(d.ownerId) && <span className="block text-[11px]" style={{ color: INK_FAINT }}>{teamName(d.ownerId)}</span>}
                                </button>
                                <label className="sr-only" htmlFor={`stage-${d.id}`}>Move {d.title}</label>
                                <select
                                  id={`stage-${d.id}`}
                                  value={d.stage}
                                  onChange={(e) => move(d, e.target.value)}
                                  className="mt-2 w-full text-[11px] px-2 py-1 rounded-[6px] bg-white"
                                  style={{ border: "1px solid var(--border)", color: INK_MUTED }}
                                >
                                  {Object.entries(OPPORTUNITY_STAGES).map(([k, label]) => (
                                    <option key={k} value={k}>{k === d.stage ? label : `Move to ${label}`}</option>
                                  ))}
                                </select>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </div>

                <Card
                  title="Won and lost"
                  eyebrow={`${closed.length} closed`}
                  action={closed.length > 0 && <Button size="sm" onClick={() => setShowClosed((v) => !v)}>{showClosed ? "Hide" : "Show"}</Button>}
                >
                  {!showClosed ? (
                    <p className="text-[13px]" style={{ color: INK_MUTED }}>
                      {summary.wonCount} won and {summary.lostCount} lost this month.
                    </p>
                  ) : (
                    <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {closed.map((d) => (
                        <li key={d.id} className="py-2.5 flex items-center justify-between gap-3 text-[13px]">
                          <button type="button" onClick={() => setDialog(d)} className="min-w-0 text-left">
                            <span className="block font-semibold truncate" style={{ color: INK }}>{d.title}</span>
                            <span className="block text-[12px] truncate" style={{ color: INK_MUTED }}>
                              {d.clientName}
                              {d.closedAt ? ` · ${formatDateOnly(d.closedAt)}` : ""}
                              {d.stage === "lost" && d.lostReason ? ` · ${d.lostReason}` : ""}
                            </span>
                          </button>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="tabular-nums" style={{ color: INK_MUTED }}>{d.value != null ? formatMoney(d.value) : ""}</span>
                            <StagePill stage={d.stage} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <Card title="Client follow-ups" eyebrow={`${followUps.length} set`}>
                {followUps.length === 0 ? (
                  <p className="text-[13px]" style={{ color: INK_MUTED }}>No follow-ups set. Add one from a client&apos;s page.</p>
                ) : (
                  <ul className="space-y-3">
                    {followUps.map((c) => {
                      const overdue = c.nextAction.dueAt && new Date(c.nextAction.dueAt) < new Date();
                      return (
                        <li key={c.id} className="text-[13px]">
                          <Link href={`/dashboard/clients/${c.id}`} className="font-semibold" style={{ color: INK }}>{c.name}</Link>
                          <p style={{ color: INK_MUTED }}>{c.nextAction.label}</p>
                          <p className="flex items-center justify-between gap-2 text-[12px]">
                            <span style={{ color: overdue ? "var(--score-low)" : INK_FAINT }}>
                              {c.nextAction.dueAt ? `${overdue ? "Overdue · " : ""}${new Date(c.nextAction.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "No date"}
                            </span>
                            <button type="button" className="font-semibold" style={{ color: "var(--forest)" }} onClick={() => completeFollowUp(c)}>
                              Done
                            </button>
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </>
      )}

      {dialog && <OpportunityDialog opportunity={dialog === "new" ? null : dialog} onClose={close} onSaved={reload} />}
    </Page>
  );
}
