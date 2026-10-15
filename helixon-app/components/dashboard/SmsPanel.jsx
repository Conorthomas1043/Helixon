"use client";

// Texts with a candidate (app/api/candidates/[id]/sms). Hidden until
// texting is set up (Twilio env vars), unless there's history to show.

import { useEffect, useState } from "react";
import { getCandidateSms, sendCandidateSms } from "@/lib/dashboard-api";
import { Button, Card, ErrorText, TextArea, INK, INK_MUTED, INK_FAINT } from "@/components/dashboard/ui";

const MAX = 640;

function when(iso) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function SmsPanel({ candidate, onSent }) {
  const [state, setState] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getCandidateSms(candidate.id)
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setState({ configured: false, phone: null, messages: [] }));
    return () => {
      cancelled = true;
    };
  }, [candidate.id]);

  if (!state || (!state.configured && state.messages.length === 0)) return null;

  async function send(e) {
    e.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const message = await sendCandidateSms(candidate.id, draft);
      setState((s) => ({ ...s, messages: [...s.messages, message] }));
      setDraft("");
      onSent?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card eyebrow={state.phone ? `To ${state.phone}` : "No mobile number"} title="Texts">
      {state.messages.length > 0 && (
        <ul className="space-y-2 mb-4 max-h-72 overflow-y-auto">
          {state.messages.map((m) => (
            <li key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-14 text-[var(--ink)] ${m.direction === "out" ? "bg-[var(--mint)]" : "bg-[var(--mist)]"}`}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="text-12 mt-1 text-[var(--ink-faint)]">
                  {when(m.createdAt)}
                  {m.direction === "out" && m.status ? ` · ${m.status}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {state.configured ? (
        state.phone ? (
          <form onSubmit={send} className="space-y-2">
            <TextArea rows={2} maxLength={MAX} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a text…" aria-label="Text message" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-12 text-[var(--ink-faint)]">
                {draft.length}/{MAX}
              </span>
              <Button type="submit" variant="primary" disabled={busy || !draft.trim()}>
                {busy ? "Sending…" : "Send text"}
              </Button>
            </div>
            {error && <ErrorText>{error}</ErrorText>}
          </form>
        ) : (
          <p className="text-14 text-[var(--ink-soft)]">
            Add a mobile number to their details to text them.
          </p>
        )
      ) : (
        <p className="text-13 text-[var(--ink-soft)]">
          Texting is switched off.
        </p>
      )}
    </Card>
  );
}
