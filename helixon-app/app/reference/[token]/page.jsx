"use client";

// Public, account-free reference form (app/api/references/[token]), reached
// from the email a recruiter sends a referee. The token in the URL is the
// only credential.

import { use, useEffect, useState } from "react";
import PublicCard, { RatingPicker, PublicCardLoading } from "@/components/public/PublicCard";

const INK = "var(--ink)";
const MUTED = "var(--ink-soft)";
const input = "w-full text-[14px] px-3 py-2 rounded-[10px] focus-visible:outline focus-visible:outline-2";
const inputStyle = { border: "1px solid var(--border)", color: INK };

export default function ReferencePage({ params }) {
  const { token } = use(params);
  const [info, setInfo] = useState(null);
  const [state, setState] = useState("loading");
  const [answers, setAnswers] = useState({});
  const [who, setWho] = useState({ completedBy: "", completedByTitle: "" });
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    fetch(`/api/references/${token}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "This link isn't valid.");
        setInfo(d);
        setWho((w) => ({ ...w, completedBy: d.refereeName || "" }));
        setState(d.status !== "requested" ? "answered" : d.expired ? "expired" : "form");
      })
      .catch((e) => {
        setError(e.message);
        setState("error");
      });
  }, [token]);

  async function send(payload, next) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/references/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't send your reference.");
      setState(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));

  if (state === "loading") return <PublicCardLoading label="Loading the reference request…" />;
  if (state === "error" || state === "expired" || state === "answered") {
    const title = state === "error" ? "Link not available" : state === "expired" ? "This link has expired" : "Already answered";
    const body =
      state === "error" ? error : state === "expired" ? "Please ask the agency to send you a new link." : "This reference has already been given. Thank you.";
    return (
      <PublicCard agencyName={info?.agencyName}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: INK }}>{title}</h1>
        <p className="text-sm" style={{ color: MUTED }}>{body}</p>
      </PublicCard>
    );
  }
  if (state === "done" || state === "declined") {
    return (
      <PublicCard agencyName={info?.agencyName}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: INK }}>Thank you</h1>
        <p className="text-sm" style={{ color: MUTED }}>
          {state === "done" ? `Your reference for ${info.candidateName} has been sent to ${info.agencyName || "the agency"}.` : "We've let the agency know you won't be giving a reference."}
        </p>
      </PublicCard>
    );
  }

  return (
    <PublicCard agencyName={info.agencyName} width={640}>
      <h1 className="text-xl font-semibold" style={{ color: INK, fontFamily: "var(--font-display)" }}>
        Reference for {info.candidateName}
      </h1>
      <p className="text-[14px] mt-1 mb-6" style={{ color: MUTED }}>
        {info.agencyName || "A recruitment agency"} has asked you for a reference. Answer what you can - it&apos;s shared with the agency and may be passed to the employer considering {info.candidateName}.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send({ ...answers, ...who, confirm }, "done");
        }}
        className="space-y-5"
      >
        {info.questions.map((q) => (
          <div key={q.id}>
            <span className="block text-[14px] font-semibold mb-1.5" style={{ color: INK }}>{q.label}</span>
            {q.type === "rating" ? (
              <RatingPicker value={answers[q.id] ?? null} onChange={(n) => set(q.id, n)} label={q.label} />
            ) : q.type === "choice" ? (
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    aria-pressed={answers[q.id] === o}
                    onClick={() => set(q.id, o)}
                    className="text-[13px] font-semibold px-3 py-1.5 rounded-full"
                    style={answers[q.id] === o ? { background: "var(--forest)", color: "white" } : { border: "1px solid var(--border)", color: INK, background: "white" }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            ) : q.type === "longtext" ? (
              <textarea aria-label={q.label} rows={3} maxLength={3000} value={answers[q.id] || ""} onChange={(e) => set(q.id, e.target.value)} className={input} style={inputStyle} />
            ) : (
              <input aria-label={q.label} maxLength={300} placeholder={q.placeholder} value={answers[q.id] || ""} onChange={(e) => set(q.id, e.target.value)} className={input} style={inputStyle} />
            )}
          </div>
        ))}
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[14px] font-semibold mb-1.5" style={{ color: INK }}>Your name</span>
            <input required maxLength={200} value={who.completedBy} onChange={(e) => setWho((w) => ({ ...w, completedBy: e.target.value }))} className={input} style={inputStyle} />
          </label>
          <label className="block">
            <span className="block text-[14px] font-semibold mb-1.5" style={{ color: INK }}>Your job title</span>
            <input maxLength={200} value={who.completedByTitle} onChange={(e) => setWho((w) => ({ ...w, completedByTitle: e.target.value }))} className={input} style={inputStyle} />
          </label>
        </div>
        <label className="flex items-start gap-2 text-[14px]" style={{ color: INK }}>
          <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
          <span>To the best of my knowledge this reference is accurate, and I&apos;m happy for it to be shared with a prospective employer.</span>
        </label>
        {error && <p role="alert" className="text-[13px]" style={{ color: "var(--score-low)" }}>{error}</p>}
        <button type="submit" disabled={saving || !confirm} className="w-full text-[14px] font-semibold px-4 py-3 rounded-full disabled:opacity-50" style={{ background: "var(--forest)", color: "white" }}>
          {saving ? "Sending…" : "Send reference"}
        </button>
        {declining ? (
          <div className="rounded-[12px] p-4 space-y-3" style={{ border: "1px solid var(--border)", background: "var(--mist)" }} role="group" aria-label="Decline the reference">
            <p className="text-[14px]" style={{ color: INK }}>Let the agency know you won&apos;t be giving a reference?</p>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button type="button" disabled={saving} onClick={() => setDeclining(false)} className="flex-1 text-[14px] font-semibold px-4 py-2.5 rounded-full" style={{ border: "1px solid var(--border)", color: INK, background: "white" }}>
                Go back
              </button>
              <button type="button" disabled={saving} onClick={() => send({ decline: true }, "declined")} className="flex-1 text-[14px] font-semibold px-4 py-2.5 rounded-full disabled:opacity-50" style={{ background: "var(--score-low)", color: "white" }}>
                {saving ? "Sending…" : "Yes, let them know"}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" disabled={saving} onClick={() => setDeclining(true)} className="w-full text-[13px] underline" style={{ color: MUTED }}>
            I can&apos;t give a reference
          </button>
        )}
      </form>
    </PublicCard>
  );
}
