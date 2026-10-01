"use client";

// The application form on a public job page (POST /api/public/apply).
// The hidden "website" field is a honeypot for bots.

import { useState } from "react";

const input = "w-full text-[14px] px-3.5 py-2.5 rounded-[10px] bg-white focus-visible:outline focus-visible:outline-2";
const inputStyle = { border: "1px solid var(--border)", color: "var(--ink)" };

export default function ApplyForm({ slug, jobId, jobTitle, src, agencyName }) {
  const [state, setState] = useState("form");
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setState("sending");
    setError("");
    const form = new FormData(e.currentTarget);
    form.set("slug", slug);
    form.set("jobId", jobId);
    if (src) form.set("src", src);
    try {
      const res = await fetch("/api/public/apply", { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Something went wrong. Please try again.");
      setState("done");
    } catch (err) {
      setError(err.message);
      setState("form");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-[14px] bg-white p-6" style={{ border: "1px solid var(--border)" }}>
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>Application sent</h2>
        <p className="text-[14px]" style={{ color: "var(--ink-soft)" }}>
          Thanks for applying for {jobTitle}. {agencyName} will be in touch if your experience is a match.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[14px] bg-white p-6 space-y-4" style={{ border: "1px solid var(--border)" }}>
      <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>Apply for this job</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[13px] font-medium mb-1" style={{ color: "var(--ink)" }}>Full name</span>
          <input name="name" required maxLength={200} autoComplete="name" className={input} style={inputStyle} />
        </label>
        <label className="block">
          <span className="block text-[13px] font-medium mb-1" style={{ color: "var(--ink)" }}>Email</span>
          <input name="email" type="email" required maxLength={254} autoComplete="email" className={input} style={inputStyle} />
        </label>
        <label className="block">
          <span className="block text-[13px] font-medium mb-1" style={{ color: "var(--ink)" }}>Phone (optional)</span>
          <input name="phone" type="tel" maxLength={40} autoComplete="tel" className={input} style={inputStyle} />
        </label>
        <label className="block">
          <span className="block text-[13px] font-medium mb-1" style={{ color: "var(--ink)" }}>LinkedIn (optional)</span>
          <input name="linkedin" maxLength={200} placeholder="linkedin.com/in/…" className={input} style={inputStyle} />
        </label>
      </div>
      <label className="block">
        <span className="block text-[13px] font-medium mb-1" style={{ color: "var(--ink)" }}>CV (PDF or Word, up to 10 MB)</span>
        <input name="cv" type="file" required accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="block w-full text-[14px]" style={{ color: "var(--ink)" }} />
      </label>
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex items-start gap-2.5 text-[13px]" style={{ color: "var(--ink-soft)" }}>
        <input name="consent" type="checkbox" required value="yes" className="mt-0.5 accent-[var(--forest)]" />
        <span>
          I&apos;ve read{" "}
          <a href={`/jobs/${slug}/privacy`} target="_blank" rel="noopener noreferrer" className="underline">
            how {agencyName} uses my data
          </a>{" "}
          and agree to it processing my application, including software-assisted CV screening reviewed by a recruiter.
        </span>
      </label>
      {error && (
        <p role="alert" className="text-[13px]" style={{ color: "var(--score-low)" }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full sm:w-auto text-[14px] font-semibold px-6 py-3 rounded-full disabled:opacity-60"
        style={{ background: "var(--forest)", color: "white" }}
      >
        {state === "sending" ? "Sending…" : "Send application"}
      </button>
    </form>
  );
}
