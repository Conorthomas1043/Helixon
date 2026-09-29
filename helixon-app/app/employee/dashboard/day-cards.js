"use client";
// app/employee/dashboard/day-cards.js
// Side-column cards for the employee dashboard. Each one is a read-only
// summary of another part of the portal with a link through to it, built
// from data the dashboard page has already fetched (see page.js).

import Link from "next/link";
import { eventsOnDay, formatTime, goalProgress, relativeDayLabel, toDayKey, upcomingEvents } from "@/lib/employee-day";
import { Card, CardHeader, Chip, EmptyLine, HeaderLink, ProgressBar } from "../_shared/ui";

function ListSkeleton({ rows = 2 }) {
  return (
    <div className="px-5 pb-5 space-y-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="shimmer-block h-10 rounded-[10px]" />)}
    </div>
  );
}

/* ── Agenda ────────────────────────────────────────────────────────────── */

function EventRow({ event, todayKey, showDay }) {
  const startKey = toDayKey(event.start_at);
  const when = event.all_day ? "All day" : formatTime(event.start_at);
  return (
    <li className="flex gap-3 px-5 py-2.5">
      <div className="w-[62px] shrink-0 text-right">
        {showDay && <p className="text-[11px] font-semibold" style={{ color: "var(--ink-soft)" }}>{relativeDayLabel(startKey, todayKey)}</p>}
        <p className="text-xs tabular-nums" style={{ color: "var(--ink-faint)", fontFamily: "var(--font-mono)" }}>{when}</p>
      </div>
      <div className="min-w-0 border-l-2 pl-3" style={{ borderColor: "var(--forest)" }}>
        <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{event.title}</p>
        {(event.location || event.creator) && (
          <p className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>
            {[event.location, event.creator?.full_name || event.creator?.display_name].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </li>
  );
}

export function AgendaCard({ events, loaded, todayKey }) {
  const today = eventsOnDay(events, todayKey);
  const next = upcomingEvents(events, todayKey, 7).slice(0, 3);
  return (
    <Card aria-labelledby="agenda-title">
      <CardHeader id="agenda-title" eyebrow="Calendar" title="Today" count={today.length} action={<HeaderLink href="/employee/calendar">Open calendar</HeaderLink>} />
      {!loaded ? (
        <ListSkeleton />
      ) : (
        <>
          {today.length === 0 ? (
            <EmptyLine>Nothing on the team calendar today.</EmptyLine>
          ) : (
            <ul className="pb-2">{today.map((e) => <EventRow key={e.id} event={e} todayKey={todayKey} />)}</ul>
          )}
          {next.length > 0 && (
            <div className="border-t pb-2" style={{ borderColor: "var(--border-soft)" }}>
              <p className="px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ink-faint)" }}>Coming up</p>
              <ul>{next.map((e) => <EventRow key={e.id} event={e} todayKey={todayKey} showDay />)}</ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* ── Calls & follow-ups ────────────────────────────────────────────────── */

const OUTCOME_LABELS = {
  no_answer: "No answer",
  voicemail: "Voicemail",
  gatekeeper: "Gatekeeper",
  not_interested: "Not interested",
  callback_requested: "Callback requested",
  interested: "Interested",
  meeting_booked: "Meeting booked",
  wrong_number: "Wrong number",
};

export function CallsCard({ stats, follow, loaded, employeeId, todayKey }) {
  const board = stats?.byEmployee || [];
  const me = board.find((r) => r.employeeId === employeeId);
  const rank = me ? board.indexOf(me) + 1 : null;
  const due = follow?.due || [];
  const upcoming = follow?.upcoming || [];

  return (
    <Card aria-labelledby="calls-title">
      <CardHeader id="calls-title" eyebrow="Cold calls" title="Follow-ups due" count={due.length} action={<HeaderLink href="/employee/cold-calls">Log a call</HeaderLink>} />
      {!loaded ? (
        <ListSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 px-5 pb-3">
            {[
              { label: "Today", value: me?.today ?? 0 },
              { label: "This week", value: me?.thisWeek ?? 0 },
              { label: "Team rank", value: rank ? `#${rank}` : "-" },
            ].map((s) => (
              <div key={s.label} className="rounded-[10px] px-3 py-2" style={{ background: "var(--mist)" }}>
                <p className="text-lg font-semibold leading-tight tabular-nums" style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{s.value}</p>
                <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {due.length === 0 ? (
            <EmptyLine>
              No follow-ups due.{upcoming.length > 0 ? ` ${upcoming.length} coming up this week.` : ""}
            </EmptyLine>
          ) : (
            <ul className="divide-y divide-[var(--border-soft)] pb-2">
              {due.slice(0, 5).map((c) => {
                const overdue = c.followUpKey < todayKey;
                return (
                  <li key={c.id} className="px-5 py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>{c.contact_name || c.company || c.phone || "Unnamed contact"}</p>
                      <p className="text-xs truncate" style={{ color: "var(--ink-faint)" }}>
                        {[c.contact_name ? c.company : null, OUTCOME_LABELS[c.outcome], c.phone].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Chip tone={overdue ? "red" : "green"}>{relativeDayLabel(c.followUpKey, todayKey)}</Chip>
                  </li>
                );
              })}
              {due.length > 5 && (
                <li className="px-5 py-2 text-xs" style={{ color: "var(--ink-soft)" }}>
                  and {due.length - 5} more on the <Link href="/employee/cold-calls" className="underline">calls page</Link>
                </li>
              )}
            </ul>
          )}

          {board.length > 1 && (
            <div className="border-t px-5 py-3" style={{ borderColor: "var(--border-soft)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: "var(--ink-faint)" }}>This week</p>
              <ol className="space-y-1.5">
                {board.slice(0, 3).map((r, i) => (
                  <li key={r.employeeId} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 min-w-0" style={{ color: "var(--ink)" }}>
                      <span className="w-5 text-xs tabular-nums" style={{ color: "var(--ink-faint)" }}>{i + 1}.</span>
                      <span className="truncate" style={r.employeeId === employeeId ? { fontWeight: 600 } : undefined}>
                        {r.name}{r.employeeId === employeeId ? " (you)" : ""}
                      </span>
                    </span>
                    <span className="tabular-nums text-xs font-semibold" style={{ color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}>{r.thisWeek}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* ── Goals ─────────────────────────────────────────────────────────────── */

const STATUS = {
  blocked: { label: "Blocked", tone: "red" },
  in_progress: { label: "In progress", tone: "green" },
  not_started: { label: "Not started", tone: "neutral" },
};

export function GoalsCard({ goals, loaded, todayKey }) {
  return (
    <Card aria-labelledby="goals-title">
      <CardHeader id="goals-title" eyebrow="Goals" title="Yours" count={goals.length} action={<HeaderLink href="/employee/goals">All goals</HeaderLink>} />
      {!loaded ? (
        <ListSkeleton />
      ) : goals.length === 0 ? (
        <EmptyLine>No open goals assigned to you.</EmptyLine>
      ) : (
        <ul className="px-5 pb-4 space-y-3.5">
          {goals.slice(0, 4).map((g) => {
            const p = goalProgress(g);
            const status = STATUS[g.status] || STATUS.not_started;
            const deadline = toDayKey(g.deadline);
            const late = deadline && deadline < todayKey;
            return (
              <li key={g.id}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <p className="text-sm font-medium leading-snug" style={{ color: "var(--ink)" }}>{g.title}</p>
                  <Chip tone={status.tone}>{status.label}</Chip>
                </div>
                <ProgressBar pct={p.pct} tone={g.status === "blocked" ? "#c0392b" : "var(--forest)"} label={`${g.title} progress`} />
                <p className="text-xs mt-1 flex justify-between gap-2" style={{ color: "var(--ink-faint)" }}>
                  <span>{p.total ? `${p.done} of ${p.total} steps` : "No steps yet"}</span>
                  {deadline && <span style={late ? { color: "#a83226", fontWeight: 600 } : undefined}>{late ? "Was due " : "Due "}{relativeDayLabel(deadline, todayKey).toLowerCase()}</span>}
                </p>
              </li>
            );
          })}
          {goals.length > 4 && (
            <li className="text-xs" style={{ color: "var(--ink-soft)" }}>
              and {goals.length - 4} more on the <Link href="/employee/goals" className="underline">goals page</Link>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}

/* ── Platform ──────────────────────────────────────────────────────────── */

export function PlatformCard({ stats }) {
  const items = [
    { label: "Customers", value: stats?.totalUsers },
    { label: "Site views today", value: stats?.siteViewsToday },
    { label: "Unique visitors", value: stats?.uniqueVisitorsToday },
    { label: "Blocked today", value: stats?.blockedToday },
  ];
  return (
    <Card aria-labelledby="platform-title">
      <CardHeader id="platform-title" eyebrow="Platform" title="Right now" action={<HeaderLink href="/employee/ops">Details</HeaderLink>} />
      <dl className="grid grid-cols-2 gap-2 px-5 pb-5">
        {items.map((s) => (
          <div key={s.label} className="flex flex-col-reverse rounded-[10px] px-3 py-2" style={{ background: "var(--mist)" }}>
            <dt className="text-[11px]" style={{ color: "var(--ink-faint)" }}>{s.label}</dt>
            <dd className="text-lg font-semibold leading-tight tabular-nums" style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>
              {typeof s.value === "number" ? s.value.toLocaleString("en-GB") : "-"}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
