"use client";

import { SignIn } from "@clerk/nextjs";
import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";

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
      mobileTagline="94% match accuracy · 10x faster screening"
      brandMiddle={
        <div className="relative z-10 space-y-9 auth-panel-in" style={{ animationDuration: "0.6s" }}>
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
                <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.62)" }}>{s.label}</p>
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
          className="w-full max-w-sm mb-4 rounded-[12px] px-4 py-3 text-[13px]"
          style={{ background: "rgba(11,58,42,0.08)", color: "#0b3a2a", border: "1px solid rgba(11,58,42,0.15)" }}
        >
          To reset your password, enter your email below and click <strong>&ldquo;Forgot password?&rdquo;</strong>.
        </div>
      )}
      {intent === "verify" && (
        <div
          role="status"
          className="w-full max-w-sm mb-4 rounded-[12px] px-4 py-3 text-[13px]"
          style={{ background: "rgba(11,58,42,0.08)", color: "#0b3a2a", border: "1px solid rgba(11,58,42,0.15)" }}
        >
          If you already finished creating your account, sign in below. Still partway through signing up? The verification code is on the signup screen itself - check your email for it.
        </div>
      )}

      <div
        ref={cardRef}
        onMouseMove={handleCardMouseMove}
        className="w-full max-w-sm relative rounded-[22px] p-7 sm:p-9 overflow-hidden auth-panel-in"
        style={{
          background: "rgba(255,255,255,0.68)",
          backdropFilter: "blur(26px)",
          WebkitBackdropFilter: "blur(26px)",
          border: "1px solid rgba(255,255,255,0.65)",
          boxShadow: "0 40px 80px -32px rgba(19,32,27,0.28), 0 1px 0 rgba(255,255,255,0.85) inset",
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
            fallbackRedirectUrl="/dashboard?welcome=1"
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
                cardBox: "!w-full !min-w-0 !shadow-none !bg-transparent",
                card: "!w-full !min-w-0 !max-w-full !box-border !shadow-none !bg-transparent !p-0 !gap-4",
                headerTitle: "tracking-tight",
                headerSubtitle: "text-[13px]",
                form: "!w-full gap-3.5",
                formField: "!w-full !min-w-0",
                formFieldInput: "!w-full box-border rounded-[12px]",
                socialButtonsBlockButton: "!w-full box-border rounded-[12px]",
                formButtonPrimary:
                  "normal-case text-sm font-semibold rounded-[12px] py-3 shadow-[0_12px_24px_-10px_rgba(11,58,42,0.55)] hover:brightness-95",
                footerAction: "!flex !flex-col !items-center !gap-1 text-[13px] text-center",
                footer: "!bg-transparent !px-0",
                dividerRow: "my-4",
              },
            }}
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
