"use client";

import { SignIn } from "@clerk/nextjs";
import { useRef, useState } from "react";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// Clerk's hosted <SignIn/> replaces the old custom login form + api/auth/login
// + api/auth/mfa-verify. reCAPTCHA/bot-detection, rate limiting, "forgot
// password", email/TOTP MFA, and "remember me" session duration are all built
// into Clerk and configured from the Clerk dashboard (User & Authentication)
// rather than in this app's code.
//
// Forgot password: <SignIn/> already shows a "Forgot password?" link under
// the password field and walks the user through the reset (code + new
// password) as extra internal steps - no separate component or prop needed.
// It only requires two things to actually work: "Reset password" turned on
// in the Clerk dashboard (User & Authentication -> Email, Phone, Username ->
// Password), and the [[...rest]] catch-all route below, since the reset
// flow needs sub-paths just like the MFA challenge and SSO callback do.
//
// The [[...rest]] catch-all route is required by Clerk - the component needs
// sub-paths for its own internal steps (password reset, MFA challenge, SSO
// callback, etc). This file keeps the app's existing visual shell (ambient
// background, branding panel, glass card) and drops Clerk's component into
// the card instead of the old hand-rolled form.
export default function LoginPage() {
  const cardRef = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 0 });

  function handleCardMouseMove(e) {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  return (
    <main className="min-h-screen flex relative overflow-hidden">
      {/* ── Ambient mesh background - matches /signup and /forgot-password ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #eef4f0 0%, #e7f0ea 45%, #dcebe0 100%)" }} />
        <div className="absolute w-[620px] h-[620px] rounded-full blur-3xl animate-[driftA_20s_ease-in-out_infinite]" style={{ background: "var(--mint)", opacity: 0.5, top: "-14%", left: "32%" }} />
        <div className="absolute w-[440px] h-[440px] rounded-full blur-3xl animate-[driftB_24s_ease-in-out_infinite]" style={{ background: "var(--forest)", opacity: 0.1, bottom: "-10%", left: "58%" }} />
        <div className="absolute w-[340px] h-[340px] rounded-full blur-3xl animate-[driftA_28s_ease-in-out_infinite_reverse]" style={{ background: "var(--signal, #f59e0b)", opacity: 0.12, bottom: "12%", left: "72%" }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.05] mix-blend-overlay">
          <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /></filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      {/* ── Left panel - branding, matches /signup gradient + stats ────── */}
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12 relative overflow-hidden" style={{ background: "linear-gradient(160deg, #0b3a2a 0%, var(--forest) 55%, #0e4531 100%)" }}>
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: "30px 30px" }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `repeating-linear-gradient(115deg, white 0px, white 1px, transparent 1px, transparent 64px)` }} />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl animate-[driftA_16s_ease-in-out_infinite]" style={{ background: "var(--mint)" }} />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full opacity-10 blur-3xl animate-[driftB_20s_ease-in-out_infinite]" style={{ background: "var(--signal, #f59e0b)" }} />

        <a href="/" className="relative z-10 flex items-center gap-3" aria-label="Helixon home">
          <div className="w-9 h-9 bg-white rounded-[10px] flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="var(--forest)" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="var(--forest)" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal, #f59e0b)" />
            </svg>
          </div>
          <span className="text-white text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Helixon</span>
        </a>

        <div className="relative z-10 space-y-9" style={{ animation: `panelIn 0.6s ${EASE}` }}>
          <div className="space-y-4">
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: "var(--mint)" }}>
              AI-powered recruitment
            </p>
            <h1 className="text-white text-[2.6rem] font-semibold leading-[1.08] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Match the right<br />candidate, faster.
            </h1>
            <p className="text-[15px] leading-relaxed max-w-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
              Helixon analyses CVs against job requirements in seconds, giving your team an objective match score and recommendation.
            </p>
          </div>

          <div className="flex gap-9">
            {[
              { value: "94%", label: "Match accuracy" },
              { value: "10x", label: "Faster screening" },
              { value: "∞", label: "Analyses / month" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-white text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)" }}>{s.value}</p>
                <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          © {new Date().getFullYear()} Helixon. All rights reserved.
        </p>
      </div>

      {/* ── Right panel - glass card holding Clerk's <SignIn/> ─────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 relative z-10">
        <a href="/" className="flex lg:hidden items-center gap-2.5 mb-8" aria-label="Helixon home">
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
            <span className="text-white text-sm font-bold">H</span>
          </div>
          <span className="text-base font-semibold" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
        </a>

        <div
          ref={cardRef}
          onMouseMove={handleCardMouseMove}
          className="w-full max-w-sm relative rounded-[22px] p-7 sm:p-9 overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.68)",
            backdropFilter: "blur(26px)",
            WebkitBackdropFilter: "blur(26px)",
            border: "1px solid rgba(255,255,255,0.65)",
            boxShadow: "0 40px 80px -32px rgba(19,32,27,0.28), 0 1px 0 rgba(255,255,255,0.85) inset",
            animation: `panelIn 0.4s ${EASE}`,
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{ background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.5), transparent 60%)` }}
          />

          <div className="relative flex justify-center">
            <SignIn
              path="/login"
              signUpUrl="/pricing"
              fallbackRedirectUrl="/dashboard"
              appearance={{
                layout: {
                  socialButtonsPlacement: "top",
                },
                variables: {
                  colorPrimary: "#0b3a2a",
                  colorText: "#13201b",
                  colorTextSecondary: "#5a7a6a",
                  colorInputBackground: "rgba(255,255,255,0.6)",
                  colorInputText: "#13201b",
                  borderRadius: "12px",
                  fontFamily: "inherit",
                },
                elements: {
                  rootBox: "!w-full !min-w-0",
                  cardBox: "!w-full !min-w-0 shadow-none bg-transparent",
                  card: "!w-full !min-w-0 !max-w-full box-border shadow-none bg-transparent p-0 gap-4",
                  headerTitle: "tracking-tight",
                  headerSubtitle: "text-[13px]",
                  form: "!w-full gap-3.5",
                  formField: "!w-full !min-w-0",
                  formFieldInput: "!w-full box-border rounded-[12px]",
                  socialButtonsBlockButton: "!w-full box-border rounded-[12px]",
                  formButtonPrimary:
                    "normal-case text-sm font-semibold rounded-[12px] py-3 shadow-[0_12px_24px_-10px_rgba(11,58,42,0.55)] hover:brightness-95",
                  footerAction: "text-[13px]",
                  footer: "bg-transparent px-0",
                  dividerRow: "my-4",
                },
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes panelIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes driftA { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-34px, 28px) scale(1.09); } }
        @keyframes driftB { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(28px, -22px) scale(1.06); } }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </main>
  );
}