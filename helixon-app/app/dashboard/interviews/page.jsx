"use client";

// /dashboard/interviews - every interview across the agency (or just
// yours): upcoming, grouped by day; ones that have happened but still need
// an outcome or scorecard; and recent ones (app/api/interviews).

import { useCallback, useEffect, useMemo, useState } from "react";
import { getInterviews } from "@/lib/dashboard-api";
import { Page, PageHeader, Card, EmptyState, ErrorState, LoadingCard, INK, INK_MUTED } from "@/components/dashboard/ui";
import { InterviewItem } from "@/components/dashboard/interviews";

const DAY = 86400000;

function dayLabel(date) {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - today) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export default function InterviewsPage() {
  const [scope, setScope] = useState("mine");
  const [state, setState] = useState({ scope: null, list: [], error: false, at: 0 });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // From 60 days back (to catch ones still needing an outcome) onwards.
    getInterviews({ scope, from: new Date(Date.now() - 60 * DAY).toISOString() })
      .then((list) => {
        if (!cancelled) setState({ scope, list, error: false, at: Date.now() });
      })
      .catch(() => {
        if (!cancelled) setState({ scope, list: [], error: true, at: Date.now() });
      });
    return () => {
      cancelled = true;
    };
  }, [scope, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const loading = state.scope !== scope;

  const groups = useMemo(() => {
    const now = state.at;
    const upcoming = state.list.filter((i) => i.status === "scheduled" && new Date(i.startsAt).getTime() >= now);
    const needsOutcome = state.list.filter(
      (i) =>
        new Date(i.startsAt).getTime() < now &&
        (i.status === "scheduled" || (i.status === "completed" && (!i.outcome || i.scorecardSummary.submitted === 0)))
    );
    const recent = state.list
      .filter((i) => !upcoming.includes(i) && !needsOutcome.includes(i))
      .sort((a, b) => String(b.startsAt).localeCompare(String(a.startsAt)))
      .slice(0, 20);
    const byDay = new Map();
    for (const i of upcoming) {
      const key = dayLabel(i.startsAt);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(i);
    }
    return { byDay: [...byDay.entries()], needsOutcome, recent, upcomingCount: upcoming.length };
  }, [state.list, state.at]);

  const tab = (v, l) => (
    <button
      key={v}
      type="button"
      aria-pressed={scope === v}
      onClick={() => setScope(v)}
      className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
      style={{ background: scope === v ? "var(--forest)" : "white", color: scope === v ? "white" : INK_MUTED, border: `1px solid ${scope === v ? "var(--forest)" : "var(--border)"}` }}
    >
      {l}
    </button>
  );

  return (
    <Page width={1000}>
      <PageHeader
        eyebrow="Schedule"
        title="Interviews"
        subtitle={loading ? null : `${groups.upcomingCount} upcoming · ${groups.needsOutcome.length} need an outcome or scorecard`}
        actions={[tab("mine", "Mine"), tab("all", "Everyone")]}
      />
      {loading && <LoadingCard rows={5} />}
      {!loading && state.error && <ErrorState title="Unable to load interviews" onRetry={reload} />}
      {!loading && !state.error && state.list.length === 0 && (
        <EmptyState title="No interviews" body="Schedule one from a candidate's profile - it sends calendar invites to them and the client." />
      )}
      {!loading && !state.error && state.list.length > 0 && (
        <>
          {groups.needsOutcome.length > 0 && (
            <Card eyebrow="To close out" title="Happened - record how it went">
              <ul className="divide-y -my-3.5" style={{ borderColor: "var(--border)" }}>
                {groups.needsOutcome.map((i) => (
                  <InterviewItem key={i.id} interview={i} onChanged={reload} showCandidate />
                ))}
              </ul>
            </Card>
          )}
          {groups.byDay.map(([day, list]) => (
            <Card key={day} eyebrow={`${list.length} interview${list.length === 1 ? "" : "s"}`} title={day}>
              <ul className="divide-y -my-3.5" style={{ borderColor: "var(--border)" }}>
                {list.map((i) => (
                  <InterviewItem key={i.id} interview={i} onChanged={reload} showCandidate />
                ))}
              </ul>
            </Card>
          ))}
          {groups.recent.length > 0 && (
            <Card eyebrow="Recent" title="Done and dusted">
              <ul className="divide-y -my-3.5" style={{ borderColor: "var(--border)" }}>
                {groups.recent.map((i) => (
                  <InterviewItem key={i.id} interview={i} onChanged={reload} showCandidate />
                ))}
              </ul>
            </Card>
          )}
          {groups.byDay.length === 0 && (
            <p className="text-[13px]" style={{ color: INK }}>Nothing coming up.</p>
          )}
        </>
      )}
    </Page>
  );
}
