"use client";

// Week view for /dashboard/interviews: Monday to Sunday, one column a day,
// with previous / this week / next. Loads only the week it shows.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getInterviews } from "@/lib/dashboard-api";
import { INTERVIEW_KINDS } from "@/lib/interviews";
import { addWeeks, groupByWeekday, startOfWeek, weekDays, weekLabel } from "@/lib/interview-week";
import { Button, Card, ErrorState, LoadingCard, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

const STATUS_COLOUR = {
  scheduled: "#5b4bc4",
  completed: "var(--forest)",
  cancelled: INK_FAINT,
  no_show: "#b42318",
};

function time(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function InterviewWeek({ scope }) {
  const [start, setStart] = useState(() => startOfWeek());
  const [state, setState] = useState({ key: null, list: [], error: false });
  const [reloadKey, setReloadKey] = useState(0);
  const key = `${scope}:${start.toISOString()}:${reloadKey}`;

  useEffect(() => {
    let cancelled = false;
    getInterviews({ scope, from: start.toISOString(), to: addWeeks(start, 1).toISOString() })
      .then((list) => !cancelled && setState({ key, list, error: false }))
      .catch(() => !cancelled && setState({ key, list: [], error: true }));
    return () => {
      cancelled = true;
    };
  }, [scope, start, key]);

  const days = useMemo(() => weekDays(start), [start]);
  const byDay = useMemo(() => groupByWeekday(state.list, start), [state.list, start]);
  const [today] = useState(() => new Date().toDateString());
  const loading = state.key !== key;
  const isThisWeek = startOfWeek().getTime() === start.getTime();

  return (
    <Card
      eyebrow={loading ? "Loading…" : `${state.list.filter((i) => i.status !== "cancelled").length} interviews`}
      title={weekLabel(start)}
      action={
        <div className="flex gap-1.5">
          <Button size="sm" onClick={() => setStart((s) => addWeeks(s, -1))} aria-label="Previous week">
            ←
          </Button>
          {!isThisWeek && (
            <Button size="sm" onClick={() => setStart(startOfWeek())}>
              This week
            </Button>
          )}
          <Button size="sm" onClick={() => setStart((s) => addWeeks(s, 1))} aria-label="Next week">
            →
          </Button>
        </div>
      }
    >
      {loading && <LoadingCard rows={3} />}
      {!loading && state.error && <ErrorState title="Unable to load this week" onRetry={() => setReloadKey((k) => k + 1)} />}
      {!loading && !state.error && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {days.map((day, index) => {
            const isToday = day.toDateString() === today;
            return (
              <div
                key={day.toISOString()}
                className="rounded-lg p-2 min-h-[90px]"
                style={{ background: isToday ? "var(--mint)" : "var(--mist)" }}
              >
                <p className="text-[12px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: isToday ? "var(--forest)" : INK_MUTED }}>
                  {day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}
                </p>
                {byDay[index].length === 0 && <p className="text-[12px]" style={{ color: INK_FAINT }}>-</p>}
                <ul className="space-y-1.5">
                  {byDay[index].map((i) => (
                    <li
                      key={i.id}
                      className="rounded-md bg-white px-2 py-1.5"
                      style={{ borderLeft: `3px solid ${STATUS_COLOUR[i.status] || INK_MUTED}`, opacity: i.status === "cancelled" ? 0.6 : 1 }}
                    >
                      <p className="text-[12px] font-semibold" style={{ color: INK_MUTED }}>
                        {time(i.startsAt)} · {i.durationMinutes}m
                      </p>
                      <Link
                        href={`/dashboard/candidates/${i.candidateId}`}
                        className="block text-[13px] font-semibold truncate hover:underline"
                        style={{ color: INK, textDecoration: i.status === "cancelled" ? "line-through" : undefined }}
                      >
                        {i.candidateName}
                      </Link>
                      <p className="text-[12px] truncate" style={{ color: INK_FAINT }}>
                        {[i.jobTitle, i.client].filter(Boolean).join(" · ") || INTERVIEW_KINDS[i.kind]}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
