"use client";

// The candidate profile's Emails card: everything sent to and received from
// them through Helixon, the sequences they're on (with a stop button), and
// buttons to write an email or start a sequence.

import { useCallback, useEffect, useState } from "react";
import { getCandidateEmails, getEmailSequences, enrollInSequence, stopEnrollment } from "@/lib/dashboard-api";
import { Card, Button, ErrorText, Pill, Select, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";
import ComposeEmail from "@/components/dashboard/ComposeEmail";
import { formatDate } from "@/lib/candidate-format";

function Message({ m }) {
  const [open, setOpen] = useState(false);
  const inbound = m.direction === "in";
  return (
    <li className="py-2.5">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left" aria-expanded={open}>
        <span className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-semibold truncate" style={{ color: INK }}>
            {inbound ? "↩ " : ""}
            {m.subject || "(no subject)"}
          </span>
          <span className="text-[12px] shrink-0" style={{ color: INK_FAINT }}>{formatDate(m.at)}</span>
        </span>
        <span className="block text-[12px]" style={{ color: INK_MUTED }}>
          {inbound ? `From ${m.from}` : `To ${m.to}`}
          {m.viaSequence ? " · sequence" : ""}
        </span>
      </button>
      {open && (
        <p className="mt-2 text-[13px] whitespace-pre-wrap rounded-[8px] p-3" style={{ background: inbound ? "var(--mint)" : "var(--mist)", color: INK }}>
          {m.body || "(empty)"}
        </p>
      )}
    </li>
  );
}

export default function EmailThreadPanel({ candidate, onChanged }) {
  const [data, setData] = useState(null);
  const [sequences, setSequences] = useState([]);
  const [composing, setComposing] = useState(false);
  const [sequenceId, setSequenceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCandidateEmails(candidate.id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData({ messages: [], enrollments: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [candidate.id, reloadKey]);

  useEffect(() => {
    getEmailSequences()
      .then((s) => setSequences(s.filter((x) => x.active)))
      .catch(() => {});
  }, []);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
    onChanged?.();
  }, [onChanged]);

  async function enroll() {
    if (!sequenceId) return;
    setBusy(true);
    setError("");
    try {
      const res = await enrollInSequence(sequenceId, [candidate.id]);
      if (!res.enrolled) setError(res.skipped?.[0]?.reason ? `Not added: ${res.skipped[0].reason}.` : "Not added.");
      setSequenceId("");
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function stop(id) {
    setBusy(true);
    try {
      await stopEnrollment(id);
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const active = (data?.enrollments ?? []).filter((e) => e.status === "active");

  return (
    <Card
      eyebrow="Emails"
      title={data?.messages?.length ? `${data.messages.length} message${data.messages.length === 1 ? "" : "s"}` : "Emails"}
      action={
        <Button size="sm" variant="primary" disabled={!candidate.email} onClick={() => setComposing(true)} title={candidate.email ? undefined : "No email address on file"}>
          Write
        </Button>
      }
    >
      {active.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-2 mb-3 rounded-[10px] px-3 py-2 text-[13px]" style={{ background: "var(--mist)", color: INK }}>
          <span>
            <Pill color="#5b4bc4" background="#f1effc">Sequence</Pill> {e.sequenceName} · email {Math.min(e.nextStep + 1, e.steps)} of {e.steps}
            {e.nextSendAt ? ` on ${formatDate(e.nextSendAt)}` : ""}
          </span>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => stop(e.id)}>
            Stop
          </Button>
        </div>
      ))}

      {data === null ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>Loading…</p>
      ) : data.messages.length === 0 ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>
          {candidate.email ? "Nothing sent from Helixon yet." : "No email address on file - add one with Edit details."}
        </p>
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {[...data.messages].reverse().map((m) => (
            <Message key={m.id} m={m} />
          ))}
        </ul>
      )}

      {candidate.email && sequences.length > 0 && (
        <div className="flex items-center gap-2 mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <Select aria-label="Sequence" value={sequenceId} onChange={(e) => setSequenceId(e.target.value)} options={[{ value: "", label: "Start a sequence…" }, ...sequences.map((s) => ({ value: s.id, label: `${s.name} (${s.steps.length} emails)` }))]} />
          <Button disabled={busy || !sequenceId} onClick={enroll}>
            Start
          </Button>
        </div>
      )}
      <ErrorText>{error}</ErrorText>

      {composing && (
        <ComposeEmail
          candidateIds={[candidate.id]}
          title={`Email ${candidate.fullName}`}
          onClose={() => setComposing(false)}
          onSent={() => reload()}
        />
      )}
    </Card>
  );
}
