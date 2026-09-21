"use client";
// app/feedback/[token]/page.jsx
// Public, unauthenticated response page for the feedback-request system -
// reached by a candidate (their own NPS-style survey) or a hiring-manager/
// client contact (candidate fit/quality rating). No Helixon account
// involved on either side; the token in the URL is the only "auth".
// See app/api/feedback-requests/[token]/route.js.

import { use, useEffect, useState } from "react";

const CANDIDATE_TAGS = [
  { value: "clear_process", label: "Process was clear" },
  { value: "unclear_process", label: "Process was unclear" },
  { value: "great_communication", label: "Great communication" },
  { value: "slow_communication", label: "Slow communication" },
  { value: "fair_interview", label: "Interview felt fair" },
  { value: "unfair_interview", label: "Interview felt unfair" },
];

const CLIENT_TAGS = [
  { value: "strong_quality", label: "Strong candidate quality" },
  { value: "weak_quality", label: "Weak candidate quality" },
  { value: "fast_submission", label: "Fast submission" },
  { value: "slow_submission", label: "Slow submission" },
  { value: "good_partnership", label: "Good partnership overall" },
];

function Card({ children }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--mist)" }}>
      <div
        className="w-full max-w-lg rounded-[20px] p-6 sm:p-8"
        style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 20px 50px -20px rgba(11,26,20,0.25)" }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
            <svg width="15" height="15" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Helixon
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}

function TagPicker({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((t) => {
        const active = selected.includes(t.value);
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onToggle(t.value)}
            className="text-[12px] font-medium px-3 py-1.5 rounded-full transition"
            style={
              active
                ? { background: "var(--forest)", color: "white" }
                : { border: "1px solid var(--border)", color: "var(--ink-soft, #5a7a6a)", background: "white" }
            }
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function NpsScale({ value, onChange }) {
  return (
    <div className="grid grid-cols-11 gap-1">
      {Array.from({ length: 11 }, (_, i) => i).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`Score ${n}`}
          className="aspect-square rounded-[8px] text-[12px] font-semibold transition flex items-center justify-center"
          style={
            value === n
              ? { background: "var(--forest)", color: "white" }
              : { border: "1px solid var(--border)", color: "var(--ink)", background: "white" }
          }
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function StarScale({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} out of 5`}
          className="w-11 h-11 rounded-[10px] text-base font-semibold transition"
          style={
            value !== null && n <= value
              ? { background: "var(--forest)", color: "white" }
              : { border: "1px solid var(--border)", color: "var(--ink)", background: "white" }
          }
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function FeedbackPage({ params }) {
  const { token } = use(params);
  const [status, setStatus] = useState("loading");
  const [info, setInfo] = useState(null);
  const [rating, setRating] = useState(null);
  const [tags, setTags] = useState([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    fetch(`/api/feedback-requests/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "This link isn't valid.");
        return data;
      })
      .then((data) => {
        setInfo(data);
        setStatus(data.responded ? "already-responded" : "ready");
      })
      .catch((err) => {
        setInfo({ error: err.message });
        setStatus("error");
      });
  }, [token]);

  function toggleTag(value) {
    setTags((t) => (t.includes(value) ? t.filter((v) => v !== value) : [...t, value]));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (rating === null) {
      setSubmitError("Please choose a rating.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/feedback-requests/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, tags, comment }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save your response.");
      setStatus("submitted");
    } catch (err) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <Card>
        <div className="w-6 h-6 rounded-full animate-spin mx-auto" style={{ border: "3px solid var(--border)", borderTopColor: "var(--forest)" }} />
      </Card>
    );
  }

  if (status === "error") {
    return (
      <Card>
        <p className="text-sm" style={{ color: "var(--ink)" }}>
          {info?.error || "This link isn't valid."}
        </p>
      </Card>
    );
  }

  if (status === "already-responded" || status === "submitted") {
    return (
      <Card>
        <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          Thanks for the feedback
        </h1>
        <p className="text-sm" style={{ color: "var(--ink-soft, #5a7a6a)" }}>
          {status === "submitted"
            ? `Your response has been sent to ${info.agencyName}.`
            : "This link has already been used - thanks for getting back to us."}
        </p>
      </Card>
    );
  }

  const isNps = info.kind === "candidate_nps";

  return (
    <Card>
      <h1 className="text-lg font-semibold mb-1.5" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
        {isNps ? "How was your experience?" : `How was ${info.candidateName}?`}
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--ink-soft, #5a7a6a)" }}>
        {isNps
          ? `A quick, honest read on applying${info.jobTitle ? ` for ${info.jobTitle}` : ""} with ${info.agencyName}. Takes under a minute.`
          : `For the ${info.jobTitle || "role"}${info.company ? ` at ${info.company}` : ""} - your read helps ${info.agencyName} improve future submissions.`}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint, #8aaa9a)" }}>
            {isNps ? "How likely are you to recommend this agency to a friend? (0-10)" : "Overall fit for the role (1-5)"}
          </p>
          {isNps ? <NpsScale value={rating} onChange={setRating} /> : <StarScale value={rating} onChange={setRating} />}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint, #8aaa9a)" }}>
            What stood out? (optional)
          </p>
          <TagPicker options={isNps ? CANDIDATE_TAGS : CLIENT_TAGS} selected={tags} onToggle={toggleTag} />
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint, #8aaa9a)" }}>
            Anything else? (optional)
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={isNps ? "Communication, clarity, the interview itself…" : "Candidate quality, speed, anything else…"}
            className="w-full text-sm px-3.5 py-2.5 rounded-[12px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 resize-none"
            style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
          />
        </div>

        {submitError && (
          <p className="text-[13px] rounded-[10px] px-3 py-2" style={{ background: "#fef2f2", color: "#b91c1c" }}>
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full font-semibold py-3 rounded-[12px] text-sm transition-all disabled:opacity-60"
          style={{ background: "var(--forest)", color: "white" }}
        >
          {submitting ? "Sending…" : "Send feedback"}
        </button>
      </form>
    </Card>
  );
}
