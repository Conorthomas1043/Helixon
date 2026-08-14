"use client";
import { useState, useRef, useEffect } from "react";

// Set this to whatever you want the gate password to be. Client-side only —
// this is a "keep casual visitors out while we work" gate, not real auth.
// Don't reuse a real account password here.
const SITE_PASSWORD = "helixon2026";
const SESSION_KEY = "helixon-dev-unlocked";

export default function UnderDevelopmentPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [checked, setChecked] = useState(false); // avoids flash before sessionStorage check
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY) === "true") {
        setUnlocked(true);
      }
    } catch {
      /* private browsing */
    }
    setChecked(true);
  }, []);

  useEffect(() => {
    if (!unlocked) inputRef.current?.focus();
  }, [unlocked]);

  function handleSubmit(e) {
    e.preventDefault();
    if (password === SITE_PASSWORD) {
      try {
        sessionStorage.setItem(SESSION_KEY, "true");
      } catch {
        /* ignore */
      }
      setUnlocked(true);
      setError("");
    } else {
      setError("That's not it — try again.");
      setShake(true);
      setTimeout(() => setShake(false), 400);
      setPassword("");
    }
  }

  if (!checked) return null;

  if (unlocked) {
    return (
      <main
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: "var(--mist)" }}
      >
        <div className="text-center">
          <h1
            className="text-2xl font-semibold mb-2"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
          >
            You're in.
          </h1>
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Continue to{" "}
            <a href="/" className="font-medium hover:underline" style={{ color: "var(--forest)" }}>
              the site
            </a>
            .
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: "var(--mist)" }}
    >
      {/* Ambient background glow — same restrained, single-accent motion
          language as the landing page, not generic decoration. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at 50% 0%, rgba(11,110,79,0.08), transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-[440px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center"
            style={{ background: "var(--forest)" }}
          >
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span
            className="text-base font-semibold tracking-tight"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
          >
            Helixon
          </span>
        </div>

        <div
          className="rounded-[22px] p-8 sm:p-10 text-center"
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.7)",
            boxShadow: "0 50px 100px -30px rgba(11,26,20,0.25)",
          }}
        >
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-6"
            style={{ background: "var(--mint)", color: "var(--forest)" }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M6 3.5v3l2 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Building something new
          </span>

          <h1
            className="text-[1.7rem] sm:text-3xl font-semibold tracking-tight leading-[1.1] mb-3"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
          >
            We're under construction
          </h1>

          <p className="text-[13.5px] leading-relaxed mb-8" style={{ color: "var(--ink-soft)" }}>
            Helixon is getting some upgrades behind the scenes. If you've got
            the password, come on in — otherwise, check back soon.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div
              className="relative rounded-[12px] mb-3.5"
              style={{
                border: `1.5px solid ${error ? "rgba(192,57,43,0.5)" : "var(--border)"}`,
                animation: shake ? "shake 0.4s ease" : "none",
              }}
            >
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Enter password"
                autoComplete="off"
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "dev-gate-error" : undefined}
                className="w-full bg-transparent text-sm outline-none px-4 py-3.5 text-center"
                style={{ color: "var(--ink)" }}
              />
            </div>

            {error && (
              <p
                id="dev-gate-error"
                role="alert"
                className="text-[12.5px] mb-4"
                style={{ color: "var(--score-low)" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn-forest w-full text-white font-semibold py-3.5 rounded-[12px] text-sm transition-all"
              style={{
                background: "var(--forest)",
                boxShadow: "0 12px 24px -10px rgba(11,58,42,0.5)",
              }}
            >
              Unlock
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] mt-6" style={{ color: "var(--ink-mute)" }}>
          © {new Date().getFullYear()} Helixon. Screen candidates in seconds.
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
      `}</style>
    </main>
  );
}