"use client";

// Public, account-free shortlist review (app/api/shares/[token]): the
// client reads each candidate's profile and says interview / maybe / not
// for us, with a comment. Responses go straight back to the recruiter.

import { use, useEffect, useState } from "react";
import ClientProfileDocument from "@/components/dashboard/ClientProfileDocument";

const INK = "var(--ink)";
const MUTED = "var(--ink-soft)";

// One tap is an answer. The choice used to be only a selection until a
// separate "Send" was pressed, so a client who tapped "Interview" and closed
// the tab had silently answered nothing. Saving on selection follows
// Nielsen's "error prevention" and "visibility of system status" heuristics
// (Nielsen, 1994, "Enhancing the explanatory power of usability heuristics", Proc. CHI '94): the state on screen is the state
// the recruiter sees. The comment is optional and saved separately.
function Decision({ token, candidate, decisions, name, onSaved }) {
  const [decision, setDecision] = useState(candidate.decision || "");
  const [comment, setComment] = useState(candidate.comment || "");
  const [savedComment, setSavedComment] = useState(candidate.comment || "");
  const [state, setState] = useState(candidate.decision ? "saved" : "idle");
  const [error, setError] = useState("");
  const commentId = `comment-${candidate.candidateId}`;

  async function save(next, nextComment = comment) {
    if (!next) return;
    setState("saving");
    setError("");
    try {
      const res = await fetch(`/api/shares/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.candidateId, decision: next, comment: nextComment, name }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't save that.");
      setSavedComment(nextComment);
      setState("saved");
      onSaved();
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  const commentDirty = comment !== savedComment;
  return (
    <div className="rounded-[14px] bg-white p-4 sm:p-5 space-y-3" style={{ border: "1px solid var(--border)" }}>
      <p className="text-[14px] font-semibold" style={{ color: INK }} id={`q-${candidate.candidateId}`}>
        Would you like to meet {candidate.profile.name}?
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`q-${candidate.candidateId}`}>
        {Object.entries(decisions).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={decision === v}
            disabled={state === "saving"}
            onClick={() => {
              setDecision(v);
              save(v);
            }}
            className="text-[14px] font-semibold px-4 rounded-full min-h-[44px]"
            style={decision === v ? { background: v === "reject" ? "#b42318" : "var(--forest)", color: "white" } : { border: "1px solid var(--border)", color: INK, background: "white" }}
          >
            {l}
          </button>
        ))}
      </div>
      <p className="text-[12px] min-h-[18px]" role="status" style={{ color: error ? "var(--score-low)" : "var(--ink-faint)" }}>
        {error || (state === "saving" ? "Saving…" : state === "saved" ? `Saved - ${decisions[decision] || "answer"} sent to the recruiter.` : "Tap an answer - it's sent straight away.")}
      </p>
      {decision && (
        <div>
          <label htmlFor={commentId} className="block text-[13px] font-medium mb-1" style={{ color: INK }}>
            Comment for the recruiter (optional)
          </label>
          <textarea
            id={commentId}
            rows={2}
            maxLength={2000}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full text-[14px] px-3 py-2 rounded-[10px]"
            style={{ border: "1px solid var(--border)", color: INK }}
          />
          {commentDirty && (
            <button
              type="button"
              onClick={() => save(decision, comment)}
              disabled={state === "saving"}
              className="mt-2 text-[13px] font-semibold px-4 rounded-full min-h-[40px]"
              style={{ background: "var(--forest)", color: "white" }}
            >
              Save comment
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SharedShortlistPage({ params }) {
  const { token } = use(params);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [respondedIds, setRespondedIds] = useState(() => new Set());

  useEffect(() => {
    fetch(`/api/shares/${token}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "This link isn't available.");
        setData(d);
        setName(d.recipientName || "");
        setRespondedIds(new Set(d.candidates.filter((c) => c.decision).map((c) => c.candidateId)));
      })
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--mist)" }}>
        <div className="max-w-md rounded-[16px] bg-white p-8 text-center" style={{ border: "1px solid var(--border)" }}>
          <h1 className="text-lg font-semibold mb-2" style={{ color: INK }}>Link not available</h1>
          <p className="text-sm" style={{ color: MUTED }}>{error} Ask your recruiter for a new one.</p>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="min-h-screen" style={{ background: "var(--mist)" }} aria-busy="true">
        <div className="mx-auto max-w-[860px] px-4 sm:px-6 py-10 space-y-4">
          <p className="sr-only">Loading the shortlist…</p>
          <div className="h-3 w-32 rounded-full bg-white" />
          <div className="h-8 w-2/3 rounded-[8px] bg-white" />
          <div className="h-64 rounded-[14px] bg-white" />
        </div>
      </main>
    );
  }
  const total = data.candidates.length;
  const answered = respondedIds.size;

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <div className="mx-auto max-w-[860px] px-4 sm:px-6 py-10 space-y-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--ink-faint)" }}>{data.agencyName}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold" style={{ color: INK, fontFamily: "var(--font-display)" }}>
            {data.jobTitle ? `Shortlist: ${data.jobTitle}` : data.shortlistName}
          </h1>
          <p className="text-[14px] mt-2" style={{ color: MUTED }}>
            {total} candidate{total === 1 ? "" : "s"}. Read each profile and tap whether you&apos;d like to meet them - each answer goes straight to {data.agencyName}.
          </p>
          <label className="mt-4 flex items-center gap-2 text-[13px]" style={{ color: INK }}>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} className="text-[13px] px-3 py-1.5 rounded-[8px] bg-white" style={{ border: "1px solid var(--border)", color: INK }} />
          </label>
        </header>
        {data.candidates.length === 0 && <p className="text-sm" style={{ color: MUTED }}>Nobody on this shortlist yet.</p>}
        {data.candidates.map((c) => (
          <section key={c.candidateId} className="space-y-3">
            <ClientProfileDocument profile={c.profile} agencyName={data.agencyName} showScore={data.showScore} />
            {c.note && (
              <p className="text-[13px] rounded-[10px] px-4 py-3" style={{ background: "var(--mint)", color: INK }}>
                <strong>Recruiter&apos;s note:</strong> {c.note}
              </p>
            )}
            <Decision token={token} candidate={c} decisions={data.decisions} name={name} onSaved={() => setRespondedIds((prev) => new Set(prev).add(c.candidateId))} />
          </section>
        ))}
        {total > 0 && answered === total && (
          <p role="status" className="rounded-[14px] p-5 text-[14px]" style={{ background: "var(--mint)", color: INK }}>
            <strong>All done - thank you.</strong> {data.agencyName} has your answers on all {total} and will be in touch about next steps. You can change any answer on this page.
          </p>
        )}
      </div>
      {/* Progress the client can see from anywhere on a long page. People
          speed up as a visible goal gets closer (Kivetz, Urminsky & Zheng,
          2006, "The goal-gradient hypothesis resurrected", Journal of
          Marketing Research 43(1)). */}
      {total > 1 && (
        <div className="sticky bottom-0 border-t bg-white/95 backdrop-blur" style={{ borderColor: "var(--border)" }}>
          <div className="mx-auto max-w-[860px] px-4 sm:px-6 py-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border-soft)" }} role="progressbar" aria-label="Answered" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}>
              <div className="h-full rounded-full" style={{ width: `${(answered / total) * 100}%`, background: "var(--forest)" }} />
            </div>
            <span className="text-[13px] font-medium tabular-nums" style={{ color: INK }}>{answered} of {total} answered</span>
          </div>
        </div>
      )}
    </main>
  );
}
