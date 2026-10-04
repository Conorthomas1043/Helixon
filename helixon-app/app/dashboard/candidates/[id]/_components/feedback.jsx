"use client";

// Part of the candidate profile page (../page.jsx).

import { CARD, INK, INK_FAINT, INK_MUTED } from "@/lib/candidate-format";
import { useState } from "react";
import { SectionHeading } from "./primitives";

export const FEEDBACK_KINDS = {
  candidate_nps: { button: "Request candidate feedback", title: "Candidate feedback" },
  client_feedback: { button: "Request client feedback", title: "Client feedback" },
};

// "Send to" form for a feedback link - pre-filled with the candidate's email
// or the job's client contact. Sending is optional: "Just create link" makes
// the link to copy and send yourself.
export function FeedbackSendForm({ defaultTo, busy, onSend, onLinkOnly, onCancel }) {
  const [to, setTo] = useState(defaultTo || "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (to.trim()) onSend(to.trim());
      }}
      className="flex flex-wrap items-center gap-2 p-3 rounded-[10px]"
      style={{ background: "var(--mist)" }}
    >
      <input
        type="email"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="name@example.com"
        aria-label="Send the link to"
        autoFocus
        className="flex-1 min-w-[180px] text-[13px] px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2"
        style={{ border: "1px solid var(--border)", color: INK }}
      />
      <button
        type="submit"
        disabled={busy || !to.trim()}
        className="text-[13px] font-semibold px-3 py-1.5 rounded-full disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--forest)", color: "white" }}
      >
        {busy ? "Sending…" : "Send email"}
      </button>
      {onLinkOnly && (
        <button type="button" onClick={onLinkOnly} disabled={busy} className="text-[13px] font-semibold disabled:opacity-50" style={{ color: INK }}>
          Just create link
        </button>
      )}
      <button type="button" onClick={onCancel} disabled={busy} className="text-[13px] font-semibold" style={{ color: INK_MUTED }}>
        Cancel
      </button>
    </form>
  );
}

export function FeedbackRequestsPanel({ requests, onCreate, onEmail, creating, candidateEmail, clientEmail }) {
  const [copiedId, setCopiedId] = useState(null);
  // Which form is open: a kind (new request) or a request id (email an existing one).
  const [open, setOpen] = useState(null);

  function copy(req) {
    navigator.clipboard?.writeText(req.url).then(() => {
      setCopiedId(req.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const defaultTo = (kind) => (kind === "candidate_nps" ? candidateEmail : clientEmail) || "";

  async function run(fn) {
    if (await fn()) setOpen(null);
  }

  return (
    <div className="rounded-[14px] p-5 sm:p-6 space-y-4" style={CARD}>
      <SectionHeading eyebrow="Feedback" title="Request feedback" />
      <p className="text-[13px] -mt-2" style={{ color: INK_FAINT }}>
        Emails them a link to a one-question page - no account needed on their end. Feeds candidate NPS / client
        satisfaction figures in Analytics.
      </p>

      <div className="flex flex-wrap gap-2">
        {Object.entries(FEEDBACK_KINDS).map(([kind, k]) => (
          <button
            key={kind}
            type="button"
            onClick={() => setOpen(open === kind ? null : kind)}
            aria-expanded={open === kind}
            className="text-[13px] font-semibold px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: `1px solid ${open === kind ? "var(--forest)" : "var(--border)"}`, color: INK, background: "white" }}
          >
            {k.button}
          </button>
        ))}
      </div>
      {FEEDBACK_KINDS[open] && (
        <FeedbackSendForm
          key={open}
          defaultTo={defaultTo(open)}
          busy={creating === open}
          onSend={(to) => run(() => onCreate(open, to))}
          onLinkOnly={() => run(() => onCreate(open, null))}
          onCancel={() => setOpen(null)}
        />
      )}

      {requests.length > 0 && (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {requests.map((req) => (
            <li key={req.id} className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold" style={{ color: INK }}>
                    {FEEDBACK_KINDS[req.kind]?.title ?? "Feedback"}
                    {req.recipientLabel && <span className="font-normal" style={{ color: INK_MUTED }}> · {req.recipientLabel}</span>}
                  </p>
                  <p className="text-[12px]" style={{ color: INK_MUTED }}>
                    {req.respondedAt
                      ? `Responded · rated ${req.rating}${req.kind === "candidate_nps" ? "/10" : "/5"}${req.comment ? ` · "${req.comment}"` : ""}`
                      : "Awaiting response"}
                  </p>
                </div>
                {!req.respondedAt && req.url && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpen(open === req.id ? null : req.id)}
                      className="text-[12px] font-semibold px-2.5 py-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(req)}
                      className="text-[12px] font-semibold px-2.5 py-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
                    >
                      {copiedId === req.id ? "Copied" : "Copy link"}
                    </button>
                  </div>
                )}
              </div>
              {open === req.id && (
                <FeedbackSendForm
                  defaultTo={req.recipientLabel?.includes("@") ? req.recipientLabel : defaultTo(req.kind)}
                  busy={creating === req.id}
                  onSend={(to) => run(() => onEmail(req.id, to))}
                  onCancel={() => setOpen(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Notes
 * ---------------------------------------------------------------------- */
