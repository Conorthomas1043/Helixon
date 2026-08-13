"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TRIAL_EMAIL_KEY = "helixon-trial-email";

export default function CheckEmailPage() {
  const [email, setEmail] = useState("");
  const [knownEmail, setKnownEmail] = useState(true); // false → show manual input
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let saved = "";
    try {
      saved = sessionStorage.getItem(TRIAL_EMAIL_KEY) || "";
    } catch {
      /* private browsing */
    }

    if (saved) {
      setEmail(saved);
      setKnownEmail(true);
    } else {
      setKnownEmail(false);
    }
  }, []);

  async function sendTo(targetEmail) {
    setError("");
    setResending(true);
    try {
      const res = await fetch("/api/trial/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail, marketingOptIn: false }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }
      try {
        sessionStorage.setItem(TRIAL_EMAIL_KEY, targetEmail);
      } catch {
        /* ignore */
      }
      setEmail(targetEmail);
      setKnownEmail(true);
      setResent(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setResending(false);
    }
  }

  function handleResendClick() {
    if (!email) return;
    sendTo(email);
  }

  function handleManualSubmit(e) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    sendTo(email.trim());
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--mist)" }}
    >
      <div
        className="w-full max-w-[420px] rounded-[22px] p-8 sm:p-9 text-center"
        style={{
          background: "white",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-raise)",
        }}
      >
        <div
          className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-6"
          style={{ background: "var(--mint)" }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--forest)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 6 12 13 2 6" />
            <path d="M2 6h20v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" />
          </svg>
        </div>

        <h1
          className="text-[1.6rem] font-semibold tracking-tight mb-2"
          style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
        >
          Check your inbox
        </h1>

        {knownEmail ? (
          <>
            <p className="text-[13.5px] leading-relaxed mb-1" style={{ color: "var(--ink-soft)" }}>
              We&apos;ve sent a confirmation link to{" "}
              <strong style={{ color: "var(--ink)" }}>{email}</strong>.
            </p>
            <p className="text-[13.5px] leading-relaxed mb-7" style={{ color: "var(--ink-soft)" }}>
              Click it to verify your address and start your 3 free analyses.
            </p>
          </>
        ) : (
          <p className="text-[13.5px] leading-relaxed mb-7" style={{ color: "var(--ink-soft)" }}>
            We&apos;ve sent a confirmation link to your email. If you don&apos;t see it, enter your
            email below and we&apos;ll send a new one.
          </p>
        )}

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-5 flex items-start gap-2.5 p-3 rounded-[10px] text-left"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
          >
            <svg
              className="mt-0.5 shrink-0"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--score-low)"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-[13px]" style={{ color: "var(--score-low)" }}>
              {error}
            </p>
          </div>
        )}

        {resent && (
          <div
            className="flex items-center justify-center gap-2 py-3 rounded-[12px] text-sm font-medium mb-4"
            style={{ background: "var(--mint)", color: "var(--forest)" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M4 6l1.5 1.5L8 4" />
            </svg>
            New link sent — check your inbox
          </div>
        )}

        {!resent && knownEmail && (
          <button
            type="button"
            onClick={handleResendClick}
            disabled={resending}
            aria-busy={resending}
            className="btn-forest w-full text-white font-semibold py-3 rounded-[12px] text-sm transition-all flex items-center justify-center gap-2 mb-4"
            style={{
              background: resending ? "var(--ink-mute)" : "var(--forest)",
              cursor: resending ? "not-allowed" : "pointer",
              boxShadow: resending ? "none" : "0 12px 24px -10px rgba(11,58,42,0.5)",
            }}
          >
            {resending ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Sending…
              </>
            ) : (
              "Resend the link"
            )}
          </button>
        )}

        {!resent && !knownEmail && (
          <form onSubmit={handleManualSubmit} className="mb-4">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              placeholder="you@agency.com"
              autoComplete="email"
              inputMode="email"
              required
              className="w-full text-sm outline-none rounded-[12px] px-4 py-3 mb-3"
              style={{
                border: "1.5px solid var(--border)",
                color: "var(--ink)",
              }}
            />
            <button
              type="submit"
              disabled={resending}
              aria-busy={resending}
              className="btn-forest w-full text-white font-semibold py-3 rounded-[12px] text-sm transition-all flex items-center justify-center gap-2"
              style={{
                background: resending ? "var(--ink-mute)" : "var(--forest)",
                cursor: resending ? "not-allowed" : "pointer",
                boxShadow: resending ? "none" : "0 12px 24px -10px rgba(11,58,42,0.5)",
              }}
            >
              {resending ? "Sending…" : "Send confirmation link"}
            </button>
          </form>
        )}

        <p className="text-[11px]" style={{ color: "var(--ink-mute)" }}>
          Wrong email?{" "}
          <Link href="/" className="font-medium hover:underline" style={{ color: "var(--ink-faint)" }}>
            Start over
          </Link>
        </p>
      </div>
    </main>
  );
}