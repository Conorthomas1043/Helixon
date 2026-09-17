"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SignUp, useUser } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // signature "expo-out" easing used across the flow

// Replaces the old 4-step custom wizard (name -> handle/agency -> security ->
// confirm) + api/auth/signup + api/auth/verify-email +
// api/auth/resend-confirmation + api/auth/username-available. Clerk's hosted
// <SignUp/> now owns first/last name, email, username, password + strength
// rules, bot protection, and email verification (its own code-entry step,
// shown automatically) - that was steps "You", "Handle", "Security", and the
// email-verification screen in the old wizard, all in one component.
//
// "Agency name" isn't a field Clerk knows about, so it's still collected
// here first (step 01) and passed through as `unsafeMetadata`. The webhook
// at app/api/webhooks/clerk/route.js reads it back out once the account is
// actually created and creates the `agencies` + `profiles` rows - the same
// inserts app/api/auth/signup/route.js used to do inline. The old "Confirm"
// review step is gone too - nothing left to double-check once Clerk is
// doing its own validation live, field by field.
//
// One-time setup needed in the Clerk dashboard (User & Authentication):
// enable "Username" and "Name" (first/last) as required fields, so Clerk
// collects those itself instead of this app needing to.
//
// The shared visual shell (ambient background, branding panel, glass card)
// lives in components/auth/AuthShell.jsx - this file supplies the
// step-aware branding panel content and the two-step form/Clerk widget.

const STEPS = [
  { key: "agency", label: "Agency" },
  { key: "account", label: "Account" },
];

const STEP_COPY = [
  { eyebrow: "01 · Agency", title: <>What&apos;s your<br />agency called?</>, body: "We'll use this to set up your workspace and where your team collaborates." },
  { eyebrow: "02 · Account", title: <>Create your<br />account.</>, body: "Set a username and password - Clerk keeps this part secure and verifies your email automatically." },
];

// ── Per-step mark - a small, quiet motif rather than a big illustration ──
function StepMark({ step }) {
  const stroke = "rgba(255,255,255,0.9)";
  const common = { width: 44, height: 44, viewBox: "0 0 44 44", fill: "none" };
  if (step === 0) return (
    <svg {...common}>
      <rect x="7" y="12" width="30" height="20" rx="4" stroke={stroke} strokeWidth="1.6" />
      <path d="M13 20h10M13 25h6" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="30" cy="25" r="2" fill={stroke} />
    </svg>
  );
  return (
    <svg {...common}>
      <circle cx="22" cy="16" r="7" stroke={stroke} strokeWidth="1.6" />
      <path d="M9 36c1.6-8 6.8-12.5 13-12.5S33.4 28 35 36" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ── Floating-label field - the signature input treatment for this flow ────
function FloatField({ label, value, onChange, autoFocus, autoComplete }) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;

  return (
    <div
      className="relative rounded-[12px] transition-all"
      style={{
        border: `1.5px solid ${focused ? "var(--forest)" : "var(--border)"}`,
        background: "rgba(255,255,255,0.6)",
        boxShadow: focused ? "0 0 0 4px var(--mint)" : "none",
        transitionTimingFunction: EASE,
        transitionDuration: "0.25s",
      }}
    >
      <label
        className="absolute left-3.5 select-none pointer-events-none transition-all"
        style={{
          top: active ? "7px" : "50%",
          transform: active ? "translateY(0)" : "translateY(-50%)",
          fontSize: active ? "10px" : "13.5px",
          fontWeight: active ? 600 : 400,
          letterSpacing: active ? "0.03em" : "0",
          color: active ? "var(--forest)" : "var(--ink-faint)",
          textTransform: active ? "uppercase" : "none",
          transitionTimingFunction: EASE,
          transitionDuration: "0.2s",
        }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        className="w-full bg-transparent text-sm outline-none"
        style={{
          color: "var(--ink)",
          padding: active ? "22px 14px 8px 14px" : "14px",
          transition: `padding 0.2s ${EASE}`,
        }}
      />
    </div>
  );
}

// ── Magnetic primary button - cursor-aware micro-displacement on hover ────
function MagneticButton({ children, disabled }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function handleMouseMove(e) {
    if (disabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: (e.clientX - (r.left + r.width / 2)) * 0.08, y: (e.clientY - (r.top + r.height / 2)) * 0.25 });
  }
  function reset() { setPos({ x: 0, y: 0 }); }

  return (
    <button
      ref={ref}
      type="submit"
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      className="flex-1 relative text-white font-semibold py-3 rounded-[12px] text-sm flex items-center justify-center gap-2 overflow-hidden"
      style={{
        background: disabled ? "var(--ink-mute)" : "var(--forest)",
        cursor: disabled ? "not-allowed" : "pointer",
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: `transform 0.25s ${EASE}, background 0.2s ease`,
        boxShadow: disabled ? "none" : "0 12px 24px -10px rgba(11,58,42,0.55)",
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "var(--forest-deep)"; }}
      onMouseOut={(e) => { if (!disabled) e.currentTarget.style.background = "var(--forest)"; }}
    >
      {children}
    </button>
  );
}

export default function SignupPage() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [animating, setAnimating] = useState(false);
  const [agencyName, setAgencyName] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");

  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn } = useUser();

  // Set by app/checkout/success's redirect for a logged-in user who paid
  // but doesn't have a profile/agency row yet. When both are present and
  // they're already signed in to Clerk, this page's job is just to
  // collect the agency name and finish setup via /api/complete-signup -
  // not to show Clerk's <SignUp/> again for an account that already exists.
  const plan = searchParams.get("plan") || "";
  const sessionId = searchParams.get("session_id") || "";
  const isPostCheckoutCompletion = isSignedIn && Boolean(sessionId);

  // Present when this page was reached via a Clerk Organization invite
  // email (Agency-plan team invite, see lib/clerk-org.js) rather than a
  // paid Stripe checkout. Clerk's <SignUp/> detects this ticket itself and
  // handles the accept-invitation flow internally - this page's only job
  // for that path is to get out of the way: no payment to check for, and
  // no "what's your agency called" step, since they're joining an agency
  // that already exists.
  const clerkTicket = searchParams.get("__clerk_ticket") || "";
  const isOrgInvite = Boolean(clerkTicket);

  const cardRef = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 0 });
  function handleCardMouseMove(e) {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  const trimmedAgency = agencyName.trim();

  // There's no standalone entry point to this page any more - the only
  // legitimate ways here are app/checkout/success's redirect after a paid
  // Stripe session (always includes session_id) and a team-invite email
  // (always includes __clerk_ticket). Anyone landing here with neither
  // (typed URL, stale bookmark, etc.) hasn't paid and wasn't invited, so
  // send them to pricing instead of letting them create an account for free.
  useEffect(() => {
    if (!sessionId && !isOrgInvite) {
      router.replace("/pricing");
    }
  }, [sessionId, isOrgInvite, router]);

  if (!sessionId && !isOrgInvite) {
    return null;
  }

  if (isOrgInvite) {
    return (
      <AuthShell
        brandPanelWidthClass="lg:w-[42%]"
        mobileLogoClassName="mb-8"
        brandMiddle={
          <div className="relative z-10 min-h-[260px]">
            <div className="auth-panel-in" style={{ animationDuration: "0.6s" }}>
              <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mb-7" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
                <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
                  <circle cx="16" cy="17" r="5.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" />
                  <path d="M4 34c1.4-6.8 5.8-10.5 12-10.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" strokeLinecap="round" />
                  <circle cx="30" cy="14" r="4.5" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" />
                  <path d="M22 34c1.1-5.6 4.6-8.5 9.5-8.5S39 28.4 40 34" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4" style={{ color: "var(--mint)" }}>Team invite</p>
              <h1 className="text-white text-[2.6rem] font-semibold leading-[1.08] tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>
                Join your<br />team on Helixon.
              </h1>
              <p className="text-[15px] leading-relaxed max-w-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                Set a username and password to finish joining - you&apos;ll land straight in the shared dashboard.
              </p>
            </div>
          </div>
        }
      >
        <div
          className="w-full max-w-sm relative rounded-[22px] p-7 sm:p-9 overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.68)",
            backdropFilter: "blur(26px)",
            WebkitBackdropFilter: "blur(26px)",
            border: "1px solid rgba(255,255,255,0.65)",
            boxShadow: "0 40px 80px -32px rgba(19,32,27,0.28), 0 1px 0 rgba(255,255,255,0.85) inset",
          }}
        >
          <SignUp
            path="/signup"
            signInUrl="/login"
            fallbackRedirectUrl="/dashboard"
            unsafeMetadata={{ viaOrgInvite: true }}
            appearance={{
              layout: { socialButtonsPlacement: "top" },
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
                header: "!px-0",
                headerTitle: "text-[1.5rem] font-semibold tracking-tight",
                headerSubtitle: "text-[13px]",
                form: "!w-full gap-3.5",
                formFieldRow: "flex-col gap-3.5",
                formField: "!w-full !min-w-0",
                formFieldInput: "!w-full box-border rounded-[12px]",
                socialButtonsBlockButton: "!w-full box-border rounded-[12px]",
                formButtonPrimary:
                  "normal-case text-sm font-semibold rounded-[12px] py-3 shadow-[0_12px_24px_-10px_rgba(11,58,42,0.55)] hover:brightness-95",
                footer: "!bg-transparent !px-0",
                footerAction: "!flex !flex-col !items-center !gap-1 text-[13px] text-center",
                dividerRow: "my-4",
              },
            }}
          />
        </div>
      </AuthShell>
    );
  }

  function goTo(next) {
    if (next === step) return;
    setDirection(next > step ? 1 : -1);
    setAnimating(true);
    setTimeout(() => { setStep(next); setAnimating(false); }, 260);
  }

  async function finishPostCheckoutSignup(e) {
    e.preventDefault();
    if (!trimmedAgency || completing) return;
    setCompleting(true);
    setCompleteError("");
    try {
      const res = await fetch("/api/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyName: trimmedAgency, sessionId, plan }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setCompleteError(data?.error || "Something went wrong. Please try again.");
        setCompleting(false);
        return;
      }
      router.push("/analyse");
    } catch {
      setCompleteError("Network error. Please try again.");
      setCompleting(false);
    }
  }

  const copy = STEP_COPY[step];

  return (
    <AuthShell
      brandPanelWidthClass="lg:w-[42%]"
      mobileLogoClassName="mb-8"
      brandMiddle={
        <div className="relative z-10 min-h-[260px]">
          <div key={step} className="auth-panel-in" style={{ animationDuration: "0.6s" }}>
            <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mb-7" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
              <StepMark step={step} />
            </div>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4" style={{ color: "var(--mint)" }}>{copy.eyebrow}</p>
            <h1 className="text-white text-[2.6rem] font-semibold leading-[1.08] tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{copy.title}</h1>
            <p className="text-[15px] leading-relaxed max-w-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{copy.body}</p>
          </div>
        </div>
      }
      brandBottom={
        <div className="relative z-10 flex items-center gap-2.5">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className="rounded-full transition-all"
              style={{ width: i === step ? "22px" : "6px", height: "6px", background: i <= step ? "var(--mint)" : "rgba(255,255,255,0.2)", transitionDuration: "0.4s", transitionTimingFunction: EASE }}
            />
          ))}
          <span className="text-[11px] ml-1 tabular-nums" style={{ color: "rgba(255,255,255,0.4)" }}>{step + 1}/{STEPS.length}</span>
        </div>
      }
    >
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
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{ background: `radial-gradient(420px circle at ${spot.x}% ${spot.y}%, rgba(255,255,255,0.5), transparent 60%)` }}
        />

        <div className="relative">
          {/* Progress */}
          <div className="flex items-center gap-1.5 mb-8">
            {STEPS.map((s, i) => (
              <div key={s.key} className="h-[3px] flex-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: i <= step ? "100%" : "0%", background: i <= step ? "var(--forest)" : "transparent", transition: `width 0.5s ${EASE}` }}
                />
              </div>
            ))}
          </div>

          <div
            key={step}
            style={{
              opacity: animating ? 0 : 1,
              transform: animating ? `translateX(${direction * 14}px)` : "translateX(0)",
              transition: `opacity 0.26s ${EASE}, transform 0.26s ${EASE}`,
            }}
          >
            {step === 0 ? (
              <form
                onSubmit={isPostCheckoutCompletion ? finishPostCheckoutSignup : (e) => {
                  e.preventDefault();
                  if (trimmedAgency) goTo(1);
                }}
                noValidate
              >
                <div className="mb-5">
                  <h2 className="text-[1.5rem] font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>What&apos;s your agency called?</h2>
                  <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-soft)" }}>
                    {isPostCheckoutCompletion
                      ? "Payment's done - just need this to finish setting up your workspace."
                      : "We'll use this to set up your workspace."}
                  </p>
                </div>

                <FloatField label="Agency name" value={agencyName} onChange={setAgencyName} autoFocus autoComplete="organization" />

                {completeError && (
                  <p role="alert" className="text-[13px] mt-3" style={{ color: "var(--score-low)" }}>{completeError}</p>
                )}

                <div className="flex items-center gap-3 mt-6">
                  <MagneticButton disabled={!trimmedAgency || completing}>
                    {isPostCheckoutCompletion ? (completing ? "Finishing up…" : "Finish setup") : "Continue"}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </MagneticButton>
                </div>

                {!isPostCheckoutCompletion && (
                  <p className="text-[13px] text-center mt-6" style={{ color: "var(--ink-soft)" }}>
                    Already have an account?{" "}
                    <Link href="/login" className="font-semibold hover:underline transition" style={{ color: "var(--forest)" }}>Sign in</Link>
                  </p>
                )}
              </form>
            ) : (
              <>
                <SignUp
                  path="/signup"
                  signInUrl="/login"
                  fallbackRedirectUrl="/dashboard"
                  unsafeMetadata={{ agencyName: trimmedAgency, plan, stripeSessionId: sessionId }}
                  localization={{
                    signUp: {
                      start: {
                        title: "Create your account",
                        subtitle: trimmedAgency
                          ? `Set a username and password to finish setting up ${trimmedAgency}.`
                          : "Set a username and password to get started.",
                      },
                    },
                  }}
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
                      header: "!px-0",
                      headerTitle: "text-[1.5rem] font-semibold tracking-tight",
                      headerSubtitle: "text-[13px]",
                      form: "!w-full gap-3.5",
                      formFieldRow: "flex-col gap-3.5",
                      formField: "!w-full !min-w-0",
                      formFieldInput: "!w-full box-border rounded-[12px]",
                      socialButtonsBlockButton: "!w-full box-border rounded-[12px]",
                      formButtonPrimary:
                        "normal-case text-sm font-semibold rounded-[12px] py-3 shadow-[0_12px_24px_-10px_rgba(11,58,42,0.55)] hover:brightness-95",
                      footer: "!bg-transparent !px-0",
                      footerAction: "!flex !flex-col !items-center !gap-1 text-[13px] text-center",
                      dividerRow: "my-4",
                    },
                  }}
                />

                <button
                  type="button"
                  onClick={() => goTo(0)}
                  className="w-full text-sm py-1.5 mt-3 transition rounded"
                  style={{ color: "var(--ink-soft)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
                >
                  ← Back
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthShell>
  );
}
