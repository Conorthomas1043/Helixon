"use client";

// The application form on a public job page (POST /api/public/apply).
// The hidden "website" field is a honeypot for bots.

import { useState } from "react";

// Same rule as acceptableCv() in lib/applications.js, checked before the
// upload starts: a too-large file used to upload in full (slow on a phone)
// and only then come back as an error.
const MAX_CV_BYTES = 10 * 1024 * 1024;
function cvProblem(file) {
  if (!file) return null;
  if (file.size > MAX_CV_BYTES) return "Your CV is too large - the limit is 10 MB.";
  const name = String(file.name || "").toLowerCase();
  if (!name.endsWith(".pdf") && !name.endsWith(".docx")) return "Upload your CV as a PDF or Word (.docx) file.";
  return null;
}

const input = "w-full text-[14px] px-3.5 py-2.5 rounded-[10px] bg-white focus-visible:outline focus-visible:outline-2";
const inputStyle = { border: "1px solid var(--border)", color: "var(--ink)" };

export default function ApplyForm({ slug, jobId, jobTitle, src, agencyName }) {
  const [state, setState] = useState("form");
  const [error, setError] = useState("");
  const [cvError, setCvError] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [emailed, setEmailed] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const problem = cvProblem(form.get("cv"));
    if (problem) {
      setCvError(problem);
      e.currentTarget.elements.namedItem("cv")?.focus();
      return;
    }
    setState("sending");
    setError("");
    form.set("slug", slug);
    form.set("jobId", jobId);
    if (src) form.set("src", src);
    try {
      const res = await fetch("/api/public/apply", { method: "POST", body: form });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          d.error ||
            (res.status === 413
              ? "Your CV is too large to upload - the limit is 10 MB."
              : res.status === 429
                ? "You've sent several applications recently - please try again later."
                : "Your application didn't send. Please try again; your details are still filled in.")
        );
      }
      setSentTo(String(form.get("email") || ""));
      setEmailed(Boolean(d.confirmationEmail));
      setState("done");
    } catch (err) {
      // A dropped connection throws a TypeError with a browser message.
      setError(err instanceof TypeError ? "We couldn't reach the server. Check your connection and try again; your details are still filled in." : err.message);
      setState("form");
    }
  }

  if (state === "done") {
    return (
      <div id="apply" role="status" className="rounded-[14px] bg-white p-6" style={{ border: "1px solid var(--border)" }}>
        <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>Application sent</h2>
        <p className="text-[14px]" style={{ color: "var(--ink-soft)" }}>
          Thanks for applying for {jobTitle}. A recruiter at {agencyName} will review your application
          {sentTo ? <> and contact you at <strong style={{ color: "var(--ink)" }}>{sentTo}</strong></> : " and contact you"} if it&apos;s a match for the role.
        </p>
        <p className="text-[14px] mt-2" style={{ color: "var(--ink-faint)" }}>
          {emailed
            ? "We've emailed you a confirmation. If it isn't in your inbox in a few minutes, check your spam folder. You can close this page."
            : "It's worth checking your spam folder in the next few days. You can close this page."}
        </p>
      </div>
    );
  }

  return (
    <form id="apply" onSubmit={submit} className="rounded-[14px] bg-white p-6 space-y-4 scroll-mt-6" style={{ border: "1px solid var(--border)" }}>
      <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>Apply for this job</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[14px] font-medium mb-1" style={{ color: "var(--ink)" }}>Full name</span>
          <input name="name" required maxLength={200} autoComplete="name" className={input} style={inputStyle} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-medium mb-1" style={{ color: "var(--ink)" }}>Email</span>
          <input name="email" type="email" required maxLength={254} autoComplete="email" className={input} style={inputStyle} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-medium mb-1" style={{ color: "var(--ink)" }}>Phone (optional)</span>
          <input name="phone" type="tel" maxLength={40} autoComplete="tel" className={input} style={inputStyle} />
        </label>
        <label className="block">
          <span className="block text-[14px] font-medium mb-1" style={{ color: "var(--ink)" }}>LinkedIn (optional)</span>
          <input name="linkedin" maxLength={200} placeholder="linkedin.com/in/…" className={input} style={inputStyle} />
        </label>
      </div>
      <label className="block">
        <span className="block text-[14px] font-medium mb-1" style={{ color: "var(--ink)" }}>CV (PDF or Word, up to 10 MB)</span>
        <input
          name="cv"
          type="file"
          required
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setCvError(cvProblem(e.target.files?.[0]) || "")}
          aria-invalid={cvError ? "true" : "false"}
          aria-describedby={cvError ? "apply-cv-error" : undefined}
          className="block w-full text-[14px]"
          style={{ color: "var(--ink)" }}
        />
      </label>
      {cvError && (
        <p id="apply-cv-error" className="text-[14px] -mt-2" style={{ color: "var(--score-low)" }}>
          {cvError}
        </p>
      )}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex items-start gap-2.5 text-[14px]" style={{ color: "var(--ink-soft)" }}>
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
        <p role="alert" className="text-[14px]" style={{ color: "var(--score-low)" }}>
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
