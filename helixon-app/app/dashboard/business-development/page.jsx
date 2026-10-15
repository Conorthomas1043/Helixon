"use client";

// /dashboard/business-development - winning new clients: a board of deals
// by stage (app/api/opportunities, lib/clients/opportunities.js), pipeline totals,
// and the client follow-ups that are due.

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { getClients, getOpportunities, getRecruiters, setClientNextAction, updateOpportunity } from "@/lib/dashboard-api";
import { OPEN_STAGES, OPPORTUNITY_STAGES, effectiveProbability, pipelineSummary } from "@/lib/clients/opportunities";
import { OpportunityDialog, StagePill } from "@/components/dashboard/opportunities";
import { Button, Card, EmptyState, ErrorState, LoadingCard, Page, PageHeader, formatMoney, INK, INK_MUTED, INK_FAINT, CARD } from "@/components/dashboard/ui";
import { formatDateOnly } from "@/lib/candidates/format";
import { useResource } from "@/lib/hooks/useResource";

async function loadBoard() {
  const [d, clients, team] = await Promise.all([getOpportunities(), getClients(), getRecruiters().catch(() => [])]);
  return { deals: d.opportunities || [], clients: clients || [], team };
}

const EMPTY_BOARD = { deals: [], clients: [], team: [] };

function Stat({ label, value, sub }) {
  return (
    <div className="rounded-card p-5" style={CARD}>
      <p className="text-12 font-semibold uppercase tracking-widest mb-2 text-[var(--ink-faint)]">{label}</p>
      <p className="text-2xl font-semibold tabular-nums font-mono text-[var(--ink)]">{value}</p>
      {sub && <p className="text-12 mt-1 text-[var(--ink-soft)]">{sub}</p>}
    </div>
  );
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export default function BusinessDevelopmentPage() {
  const board = useResource("business-development", loadBoard);
  const state = { status: board.data ? "ready" : board.error ? "error" : "loading", ...(board.data ?? EMPTY_BOARD) };
  const { reload: refetch, mutate } = board;
  const [dialog, setDialog] = useState(null); // null | "new" | deal
  const [mineOnly, setMineOnly] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [error, setError] = useState("");
  const { user } = useUser();
  const myId = user?.id ?? null;

  const reload = useCallback(() => {
    setDialog(null);
    refetch();
  }, [refetch]);
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
      mutate((s) => ({ ...s, deals: s.deals.map((d) => (d.id === deal.id ? { ...d, stage, closedAt: stage === "won" || stage === "lost" ? new Date().toISOString() : null } : d)) }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function completeFollowUp(client) {
    setError("");
    try {
      await setClientNextAction(client.id, { completed: true });
      mutate((s) => ({ ...s, clients: s.clients.map((c) => (c.id === client.id ? { ...c, nextAction: null } : c)) }));
    } catch (err) {
      setError(err.message);
    }
  }

  const closed = deals.filter((d) => d.stage === "won" || d.stage === "lost");

  return (
    <Page>
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
      {error && <p className="text-13 text-[var(--score-low)]">{error}</p>}

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
                      <section key={stage} className="rounded-card p-3 min-w-0 bg-white border border-[var(--border)]" aria-label={OPPORTUNITY_STAGES[stage]}>
                        <header className="flex items-baseline justify-between px-1 mb-2">
                          <h2 className="text-13 font-semibold text-[var(--ink)]">{OPPORTUNITY_STAGES[stage]}</h2>
                          <span className="text-12 tabular-nums text-[var(--ink-faint)]">
                            {list.length} · {formatMoney(summary.byStage[stage].value)}
                          </span>
                        </header>
                        <ul className="space-y-2">
                          {list.length === 0 && <li className="text-13 px-1 py-2 text-[var(--ink-faint)]">None</li>}
                          {list.map((d) => {
                            const late = d.expectedClose && d.expectedClose < new Date().toISOString().slice(0, 10);
                            return (
                              <li key={d.id} className="rounded-btn p-3 bg-[var(--mist)]">
                                <button type="button" onClick={() => setDialog(d)} className="w-full text-left">
                                  <span className="block text-14 font-semibold truncate text-[var(--ink)]">{d.title}</span>
                                  <span className="block text-13 truncate text-[var(--ink-soft)]">{d.clientName}</span>
                                  <span className="block text-13 tabular-nums mt-1 text-[var(--ink-soft)]">
                                    {d.value != null ? formatMoney(d.value) : "No value"} · {effectiveProbability(d)}%
                                  </span>
                                  {d.expectedClose && (
                                    <span className={`block text-12 ${late ? "text-[var(--score-low)]" : "text-[var(--ink-faint)]"}`}>
                                      Close {formatDateOnly(d.expectedClose)}
                                    </span>
                                  )}
                                  {teamName(d.ownerId) && <span className="block text-12 text-[var(--ink-faint)]">{teamName(d.ownerId)}</span>}
                                </button>
                                <label className="sr-only" htmlFor={`stage-${d.id}`}>Move {d.title}</label>
                                <select
                                  id={`stage-${d.id}`}
                                  value={d.stage}
                                  onChange={(e) => move(d, e.target.value)}
                                  className="mt-2 w-full text-12 px-2 py-1 rounded-md bg-white border border-[var(--border)] text-[var(--ink-soft)]"
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
                    <p className="text-14 text-[var(--ink-soft)]">
                      {summary.wonCount} won and {summary.lostCount} lost this month.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {closed.map((d) => (
                        <li key={d.id} className="py-2.5 flex items-center justify-between gap-3 text-14">
                          <button type="button" onClick={() => setDialog(d)} className="min-w-0 text-left">
                            <span className="block font-semibold truncate text-[var(--ink)]">{d.title}</span>
                            <span className="block text-13 truncate text-[var(--ink-soft)]">
                              {d.clientName}
                              {d.closedAt ? ` · ${formatDateOnly(d.closedAt)}` : ""}
                              {d.stage === "lost" && d.lostReason ? ` · ${d.lostReason}` : ""}
                            </span>
                          </button>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="tabular-nums text-[var(--ink-soft)]">{d.value != null ? formatMoney(d.value) : ""}</span>
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
                  <p className="text-14 text-[var(--ink-soft)]">No follow-ups set. Add one from a client&apos;s page.</p>
                ) : (
                  <ul className="space-y-3">
                    {followUps.map((c) => {
                      const overdue = c.nextAction.dueAt && new Date(c.nextAction.dueAt) < new Date();
                      return (
                        <li key={c.id} className="text-14">
                          <Link href={`/dashboard/clients/${c.id}`} className="font-semibold" style={{ color: INK }}>{c.name}</Link>
                          <p className="text-[var(--ink-soft)]">{c.nextAction.label}</p>
                          <p className="flex items-center justify-between gap-2 text-13">
                            <span className={`${overdue ? "text-[var(--score-low)]" : "text-[var(--ink-faint)]"}`}>
                              {c.nextAction.dueAt ? `${overdue ? "Overdue · " : ""}${new Date(c.nextAction.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "No date"}
                            </span>
                            <button type="button" className="font-semibold text-[var(--forest)]" onClick={() => completeFollowUp(c)}>
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
