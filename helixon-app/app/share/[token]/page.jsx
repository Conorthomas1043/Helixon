"use client";

// Public, account-free shortlist review (app/api/shares/[token]): the
// client reads each candidate's profile and says interview / maybe / not
// for us, with a comment. Responses go straight back to the recruiter.

import { use, useEffect, useState } from "react";
import ClientProfileDocument from "@/components/dashboard/ClientProfileDocument";

const INK = "var(--ink)";
const MUTED = "var(--ink-soft)";

function Decision({ token, candidate, decisions, name, onSaved }) {
  const [decision, setDecision] = useState(candidate.decision || "");
  const [comment, setComment] = useState(candidate.comment || "");
  const [state, setState] = useState(candidate.decision ? "saved" : "idle");
  const [error, setError] = useState("");

  async function save(next = decision) {
    if (!next) return;
    setState("saving");
    setError("");
    try {
      const res = await fetch(`/api/shares/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.candidateId, decision: next, comment, name }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't save that.");
      setState("saved");
      onSaved();
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  }

  return (
    <div className="rounded-[14px] bg-white p-4 sm:p-5 space-y-3" style={{ border: "1px solid var(--border)" }}>
      <p className="text-[13px] font-semibold" style={{ color: INK }}>Would you like to meet {candidate.profile.name}?</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(decisions).map(([v, l]) => (
          <button
            key={v}
            type="button"
            aria-pressed={decision === v}
            onClick={() => {
              setDecision(v);
              setState("idle");
            }}
            className="text-[13px] font-semibold px-4 py-2 rounded-full"
            style={decision === v ? { background: v === "reject" ? "#b42318" : "var(--forest)", color: "white" } : { border: "1px solid var(--border)", color: INK, background: "white" }}
          >
            {l}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        maxLength={2000}
        value={comment}
        onChange={(e) => {
          setComment(e.target.value);
          setState("idle");
        }}
        placeholder="Any comments for the recruiter (optional)"
        className="w-full text-[13px] px-3 py-2 rounded-[10px]"
        style={{ border: "1px solid var(--border)", color: INK }}
      />
      <div className="flex items-center gap-3">
        <button type="button" disabled={!decision || state === "saving" || state === "saved"} onClick={() => save()} className="text-[13px] font-semibold px-4 py-2 rounded-full disabled:opacity-50" style={{ background: "var(--forest)", color: "white" }}>
          {state === "saving" ? "Sending…" : state === "saved" ? "Sent ✓" : "Send"}
        </button>
        {error && <span role="alert" className="text-[12px]" style={{ color: "var(--score-low)" }}>{error}</span>}
      </div>
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
  if (!data) return <main className="min-h-screen p-10 text-center text-sm" style={{ background: "var(--mist)", color: MUTED }}>Loading…</main>;

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <div className="mx-auto max-w-[860px] px-4 sm:px-6 py-10 space-y-6">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--ink-faint)" }}>{data.agencyName}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold" style={{ color: INK, fontFamily: "var(--font-display)" }}>
            {data.jobTitle ? `Shortlist: ${data.jobTitle}` : data.shortlistName}
          </h1>
          <p className="text-[14px] mt-2" style={{ color: MUTED }}>
            {data.candidates.length} candidate{data.candidates.length === 1 ? "" : "s"} · {respondedIds.size} responded to. Read each profile and let us know who you&apos;d like to meet.
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
      </div>
    </main>
  );
}
