"use client";

// The candidate profile's Interviews card: every round, with scheduling,
// outcomes and scorecards (components/dashboard/interviews.jsx).

import { useCallback, useEffect, useState } from "react";
import { getInterviews } from "@/lib/dashboard-api";
import { Card, Button, INK_MUTED } from "@/components/dashboard/ui";
import { InterviewItem, ScheduleInterviewDialog } from "@/components/dashboard/interviews";

export default function InterviewsPanel({ candidate, onChanged }) {
  const [interviews, setInterviews] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getInterviews({ candidateId: candidate.id })
      .then((list) => {
        if (!cancelled) setInterviews(list);
      })
      .catch(() => {
        if (!cancelled) setInterviews([]);
      });
    return () => {
      cancelled = true;
    };
  }, [candidate.id, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
    onChanged?.();
  }, [onChanged]);
  const close = useCallback(() => setScheduling(false), []);

  return (
    <Card
      eyebrow="Interviews"
      title={interviews?.length ? `${interviews.length} round${interviews.length === 1 ? "" : "s"}` : "Interviews"}
      action={
        <Button variant="primary" size="sm" onClick={() => setScheduling(true)}>
          Schedule
        </Button>
      }
    >
      {interviews === null ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>Loading…</p>
      ) : interviews.length === 0 ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>
          No interviews yet. Scheduling one sends calendar invites to the candidate and the client.
        </p>
      ) : (
        <ul className="divide-y -my-3.5" style={{ borderColor: "var(--border)" }}>
          {[...interviews].reverse().map((i) => (
            <InterviewItem key={i.id} interview={i} onChanged={reload} />
          ))}
        </ul>
      )}
      {scheduling && (
        <ScheduleInterviewDialog
          candidate={{ id: candidate.id, name: candidate.fullName, email: candidate.email }}
          onClose={close}
          onSaved={() => {
            setScheduling(false);
            reload();
          }}
        />
      )}
    </Card>
  );
}
