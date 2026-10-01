"use client";

// Public, account-free interview scorecard (app/api/scorecards/[token]),
// reached from the link a recruiter sends an interviewer. The token in the
// URL is the only credential.

import { use, useEffect, useState } from "react";
import PublicCard, { RatingPicker } from "@/components/public/PublicCard";

const INK = "var(--ink)";
const MUTED = "var(--ink-soft)";
const input = "w-full text-[13px] px-3 py-2 rounded-[10px] focus-visible:outline focus-visible:outline-2";
const inputStyle = { border: "1px solid var(--border)", color: INK };

export default function ScorecardPage({ params }) {
  const { token } = use(params);
  const [info, setInfo] = useState(null);
  const [state, setState] = useState("loading");
  const [overall, setOverall] = useState(null);
  const [recommendation, setRecommendation] = useState("");
  const [ratings, setRatings] = useState({});
  const [text, setText] = useState({ strengths: "", concerns: "", comments: "", reviewerName: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/scorecards/${token}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "This link isn't valid.");
        setInfo(d);
        setText((t) => ({ ...t, reviewerName: d.reviewerName || "" }));
        setState(d.submitted ? "done" : "form");
      })
      .catch((e) => {
        setError(e.message);
        setState("error");
      });
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/scorecards/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overallRating: overall,
          recommendation,
          criteria: info.criteria.map((name) => ({ name, rating: ratings[name] ?? null })),
          ...text,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't save your scorecard.");
      setState("done");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (state === "loading") return <PublicCard><p className="text-sm" style={{ color: MUTED }}>Loading…</p></PublicCard>;
  if (state === "error") {
    return (
      <PublicCard>
        <h1 className="text-lg font-semibold mb-2" style={{ color: INK }}>Link not available</h1>
        <p className="text-sm" style={{ color: MUTED }}>{error}</p>
      </PublicCard>
    );
  }
  if (state === "done") {
    return (
      <PublicCard agencyName={info?.agencyName}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: INK }}>Thank you</h1>
        <p className="text-sm" style={{ color: MUTED }}>Your feedback on {info?.candidateName} has been sent to the recruiter.</p>
      </PublicCard>
    );
  }

  return (
    <PublicCard agencyName={info.agencyName} width={620}>
      <h1 className="text-xl font-semibold" style={{ color: INK, fontFamily: "var(--font-display)" }}>
        Interview scorecard: {info.candidateName}
      </h1>
      <p className="text-[13px] mt-1 mb-6" style={{ color: MUTED }}>
        {[info.jobTitle, info.client, info.when, info.round > 1 ? `Round ${info.round}` : null].filter(Boolean).join(" · ")}
      </p>
      <form onSubmit={submit} className="space-y-5">
        <div>
          <p className="text-[13px] font-semibold mb-2" style={{ color: INK }}>Overall (1 = poor, 5 = excellent)</p>
          <RatingPicker value={overall} onChange={setOverall} label="Overall rating" />
        </div>
        <div>
          <p className="text-[13px] font-semibold mb-2" style={{ color: INK }}>Recommendation</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(info.recommendations).map(([v, l]) => (
              <button
                key={v}
                type="button"
                aria-pressed={recommendation === v}
                onClick={() => setRecommendation(v)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
                style={recommendation === v ? { background: "var(--forest)", color: "white" } : { border: "1px solid var(--border)", color: INK, background: "white" }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {info.criteria.map((name) => (
            <div key={name} className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px]" style={{ color: INK }}>{name}</span>
              <RatingPicker value={ratings[name] ?? null} onChange={(n) => setRatings((r) => ({ ...r, [name]: n }))} label={name} />
            </div>
          ))}
        </div>
        {[
          ["strengths", "Strengths"],
          ["concerns", "Concerns"],
          ["comments", "Anything else"],
        ].map(([k, l]) => (
          <label key={k} className="block">
            <span className="block text-[13px] font-semibold mb-1.5" style={{ color: INK }}>{l}</span>
            <textarea rows={3} maxLength={3000} value={text[k]} onChange={(e) => setText((t) => ({ ...t, [k]: e.target.value }))} className={input} style={inputStyle} />
          </label>
        ))}
        <label className="block">
          <span className="block text-[13px] font-semibold mb-1.5" style={{ color: INK }}>Your name</span>
          <input maxLength={200} value={text.reviewerName} onChange={(e) => setText((t) => ({ ...t, reviewerName: e.target.value }))} className={input} style={inputStyle} />
        </label>
        {error && <p role="alert" className="text-[12px]" style={{ color: "var(--score-low)" }}>{error}</p>}
        <button
          type="submit"
          disabled={saving || !overall || !recommendation}
          className="w-full text-[14px] font-semibold px-4 py-3 rounded-full disabled:opacity-50"
          style={{ background: "var(--forest)", color: "white" }}
        >
          {saving ? "Sending…" : "Send scorecard"}
        </button>
      </form>
    </PublicCard>
  );
}
