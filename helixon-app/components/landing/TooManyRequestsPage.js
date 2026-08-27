"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/landing/Button";

// Simple, on-brand "Too Many Requests" page, matched to the landing
// page's nav/footer/Button so it doesn't feel like a dead end. If you
// have a Retry-After value from the response, pass it in as
// `retryAfterSeconds` and the button stays disabled until it counts down.

function HourglassScene() {
  return (
    <svg
      viewBox="0 0 200 130"
      width="140"
      height="91"
      aria-hidden="true"
      style={{ display: "block", margin: "0 auto 20px" }}
    >
      <ellipse cx="100" cy="112" rx="60" ry="6" fill="var(--border)" opacity="0.6" />

      <g stroke="var(--forest)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <line x1="72" y1="30" x2="128" y2="30" />
        <line x1="72" y1="94" x2="128" y2="94" />
        <path d="M76 30 Q76 58 100 62 Q124 58 124 30" />
        <path d="M76 94 Q76 66 100 62 Q124 66 124 94" />
      </g>

      <path className="sand-top" d="M84 36 Q84 54 100 60 Q116 54 116 36 Z" fill="var(--mint)" />
      <path className="sand-bottom" d="M92 88 Q100 78 108 88 L112 92 L88 92 Z" fill="var(--mint)" />
      <line className="sand-stream" x1="100" y1="62" x2="100" y2="80" stroke="var(--forest)" strokeWidth="1.6" strokeLinecap="round" />

      <line x1="72" y1="30" x2="72" y2="20" stroke="var(--forest)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="128" y1="30" x2="128" y2="20" stroke="var(--forest)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="66" y1="20" x2="134" y2="20" stroke="var(--forest)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="72" y1="94" x2="72" y2="104" stroke="var(--forest)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="128" y1="94" x2="128" y2="104" stroke="var(--forest)" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="66" y1="104" x2="134" y2="104" stroke="var(--forest)" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export default function TooManyRequestsPage({ retryAfterSeconds = null }) {
  const [remaining, setRemaining] = useState(retryAfterSeconds);

  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((s) => (s && s > 1 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  function handleRetry() {
    window.location.reload();
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--mist)" }}>
      {/* ── Nav (matches landing page) ─────────────────────────────────── */}
      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }} aria-label="Main">
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>Helixon</span>
              <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "var(--ink-faint)" }}>Screen candidates in seconds</span>
            </span>
          </Link>
          <Link href="/login" className="text-xs font-medium" style={{ color: "var(--ink-soft)" }}>Login</Link>
        </div>
      </nav>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 py-16 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(600px circle at 50% 0%, rgba(11,110,79,0.08), transparent 60%)",
          }}
        />

        <div className="relative w-full max-w-[440px]">
          <div
            className="rounded-[22px] p-8 sm:p-10 text-center"
            style={{
              background: "white",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-raise, 0 20px 40px -20px rgba(19,32,27,0.18))",
            }}
          >
            <HourglassScene />

            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-5" style={{ background: "#fef2f2", color: "var(--score-low)" }}>
              Error 429
            </span>

            <h1
              className="text-2xl sm:text-3xl font-semibold tracking-tight leading-[1.1] mb-3"
              style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
            >
              Too many requests
            </h1>

            <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--ink-soft)" }}>
              You&apos;ve been sending requests a little too quickly. Give it a
              moment and try again - your account and results are safe.
            </p>

            {remaining !== null && remaining > 0 ? (
              <p className="text-[13px] mb-6" style={{ color: "var(--ink-faint)" }}>
                You can try again in{" "}
                <span style={{ color: "var(--ink)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                  {remaining}s
                </span>
              </p>
            ) : null}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="primary"
                onClick={handleRetry}
                disabled={remaining !== null && remaining > 0}
                className="w-full sm:w-auto min-h-[48px]"
              >
                Try again
              </Button>
              <Button
                as="a"
                href="/"
                variant="outline"
                className="w-full sm:w-auto min-h-[48px]"
              >
                Back to home
              </Button>
            </div>
          </div>

          <p className="text-center text-[11px] mt-6" style={{ color: "var(--ink-mute)" }}>
            Still stuck?{" "}
            <a href="/contact" className="font-medium hover:underline" style={{ color: "var(--ink-faint)" }}>
              Contact support
            </a>
          </p>
        </div>
      </div>

      {/* ── Footer (matches landing page) ──────────────────────────────── */}
      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>© {new Date().getFullYear()} Helixon. Screen candidates in seconds.</span>
          <a href="/login" className="text-[11px] hover:underline" style={{ color: "var(--ink-faint)" }}>Login</a>
        </div>
      </footer>

      <style>{`
        @keyframes sandDrain {
          0%   { transform: scaleY(1); transform-origin: top; opacity: 1; }
          90%  { transform: scaleY(0.05); opacity: 1; }
          100% { transform: scaleY(0.05); opacity: 0; }
        }
        @keyframes sandFill {
          0%   { transform: scaleY(0.2); transform-origin: bottom; }
          100% { transform: scaleY(1); transform-origin: bottom; }
        }
        @keyframes streamFlicker {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 0.3; }
        }
        .sand-top { animation: sandDrain 2.4s ease-in-out infinite; }
        .sand-bottom { animation: sandFill 2.4s ease-in-out infinite; }
        .sand-stream { animation: streamFlicker 0.4s linear infinite; }

        @media (prefers-reduced-motion: reduce) {
          .sand-top, .sand-bottom, .sand-stream { animation: none; }
        }
      `}</style>
    </main>
  );
}