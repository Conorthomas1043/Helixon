"use client";

import { SignIn } from "@clerk/nextjs";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import ClerkWidgetStates from "@/components/auth/ClerkWidgetStates";
import { AUTH_CARD_ELEMENTS, authCardVariables } from "@/lib/ui/clerk-appearance";
import usePrefersDark from "@/lib/hooks/usePrefersDark";

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
// callback, etc). The shared visual shell (ambient background, branding
// panel, glass card) lives in components/auth/AuthShell.jsx - this file only
// supplies the branding panel's content and drops Clerk's component into
// the card.
function LoginContent() {
  const dark = usePrefersDark();
  const cardRef = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 0 });
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent");

  function handleCardMouseMove(e) {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  return (
    <AuthShell
      mobileTagline="Unlimited screening · Swiss-hosted"
      brandMiddle={
        <div className="relative z-10 space-y-9 auth-panel-in" style={{ animationDuration: "0.6s" }}>
          <div className="space-y-4">
            <p className="text-11 font-semibold tracking-[0.18em] uppercase text-[var(--on-brand-soft)]">
              AI CV screening for agencies
            </p>
            <h1 className="text-white text-40 font-semibold leading-[1.08] tracking-tight font-display">
              Screen every CV for a role in the time it takes to read one.
            </h1>
            <p className="text-15 leading-relaxed max-w-sm text-white/70">
              Every CV scored against your job spec, with the evidence behind each score and a ranked shortlist at the end.
            </p>
          </div>

          {/* The same three proof points as the homepage's stats strip. */}
          <div className="flex gap-9">
            {[
              { value: "50", label: "CVs per bulk upload" },
              { value: "< 1 min", label: "To score a CV" },
              { value: "Swiss", label: "Hosted and encrypted" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-white text-24 font-semibold tabular-nums font-display">{s.value}</p>
                <p className="text-11 mt-1 text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      }
      brandBottom={
        <p className="relative z-10 text-xs" style={{ color: "rgba(255,255,255,0.58)" }}>
          © {new Date().getFullYear()} Helixon. All rights reserved.
        </p>
      }
    >
      {intent === "reset" && (
        <div
          role="status"
          className="w-full max-w-sm mb-4 rounded-xl px-4 py-3 text-13 bg-[var(--mint)] text-[var(--forest-deep)] border border-[var(--border)]"
        >
          To reset your password, enter your email below and click <strong>&ldquo;Forgot password?&rdquo;</strong>.
        </div>
      )}
      {intent === "verify" && (
        <div
          role="status"
          className="w-full max-w-sm mb-4 rounded-xl px-4 py-3 text-13 bg-[var(--mint)] text-[var(--forest-deep)] border border-[var(--border)]"
        >
          If you already finished creating your account, sign in below. Still partway through signing up? The verification code is on the signup screen itself - check your email for it.
        </div>
      )}

      <div
        ref={cardRef}
        onMouseMove={handleCardMouseMove}
        className="w-full max-w-sm relative rounded-panel p-7 sm:p-9 overflow-hidden auth-panel-in"
        style={{
          background: "var(--glass-bg)",
          backdropFilter: "blur(26px)",
          WebkitBackdropFilter: "blur(26px)",
          border: "1px solid var(--glass-line)",
          boxShadow: "0 40px 80px -32px rgba(19,32,27,0.28), 0 1px 0 var(--glass-shine) inset",
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{ background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, var(--glass-spot), transparent 60%)` }}
        />

        <div className="relative flex justify-center">
          <ClerkWidgetStates what="Sign-in" />
          <SignIn
            path="/login"
            signUpUrl="/pricing"
            fallbackRedirectUrl="/dashboard?welcome=1"
            appearance={{ layout: { socialButtonsPlacement: "top" }, variables: authCardVariables(dark), elements: AUTH_CARD_ELEMENTS }}
          />
        </div>
      </div>
    </AuthShell>
  );
}

// useSearchParams() (for ?intent=reset) requires a Suspense boundary in
// the app router, or static prerendering fails the build.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
