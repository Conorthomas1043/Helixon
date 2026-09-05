"use client";

import { useRef, useState } from "react";
import { SignUp } from "@clerk/nextjs";

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
          color: active ? "var(--forest)" : "#8aaa9a",
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
          color: "#13201b",
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
        background: disabled ? "#b0c4ba" : "var(--forest)",
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

  const cardRef = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 0 });
  function handleCardMouseMove(e) {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  const trimmedAgency = agencyName.trim();

  function goTo(next) {
    if (next === step) return;
    setDirection(next > step ? 1 : -1);
    setAnimating(true);
    setTimeout(() => { setStep(next); setAnimating(false); }, 260);
  }

  const bg = (
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
  );

  const copy = STEP_COPY[step];

  return (
    <main className="min-h-screen flex relative overflow-hidden">
      {bg}

      {/* ── Left panel - brand narrative, one motif per step ─────────────── */}
      <div className="hidden lg:flex lg:w-[42%] flex-col justify-between p-12 relative overflow-hidden" style={{ background: "linear-gradient(160deg, #0b3a2a 0%, var(--forest) 55%, #0e4531 100%)" }}>
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: "30px 30px" }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: `repeating-linear-gradient(115deg, white 0px, white 1px, transparent 1px, transparent 64px)` }} />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl animate-[driftA_16s_ease-in-out_infinite]" style={{ background: "var(--mint)" }} />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full opacity-10 blur-3xl animate-[driftB_20s_ease-in-out_infinite]" style={{ background: "var(--signal, #f59e0b)" }} />

        <a href="/" className="relative flex items-center gap-3 z-10" aria-label="Helixon home">
          <div className="w-9 h-9 bg-white rounded-[10px] flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="var(--forest)" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="var(--forest)" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal, #f59e0b)" />
            </svg>
          </div>
          <span className="text-white text-lg font-semibold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Helixon</span>
        </a>

        <div className="relative z-10 min-h-[260px]">
          <div key={step} style={{ animation: `panelIn 0.6s ${EASE}` }}>
            <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mb-7" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)" }}>
              <StepMark step={step} />
            </div>
            <p className="text-[11px] font-semibold tracking-[0.18em] uppercase mb-4" style={{ color: "var(--mint)" }}>{copy.eyebrow}</p>
            <h1 className="text-white text-[2.6rem] font-semibold leading-[1.08] tracking-tight mb-4" style={{ fontFamily: "var(--font-display)" }}>{copy.title}</h1>
            <p className="text-[15px] leading-relaxed max-w-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{copy.body}</p>
          </div>
        </div>

        {/* Step rail */}
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
      </div>

      {/* ── Right panel - agency step, then Clerk <SignUp/> ─────────────── */}
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
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (trimmedAgency) goTo(1);
                  }}
                  noValidate
                >
                  <div className="mb-5">
                    <h2 className="text-[1.5rem] font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>What&apos;s your agency called?</h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "#5a7a6a" }}>We&apos;ll use this to set up your workspace.</p>
                  </div>

                  <FloatField label="Agency name" value={agencyName} onChange={setAgencyName} autoFocus autoComplete="organization" />

                  <div className="flex items-center gap-3 mt-6">
                    <MagneticButton disabled={!trimmedAgency}>
                      Continue
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                    </MagneticButton>
                  </div>

                  <p className="text-[13px] text-center mt-6" style={{ color: "#5a7a6a" }}>
                    Already have an account?{" "}
                    <a href="/login" className="font-semibold hover:underline transition" style={{ color: "var(--forest)" }}>Sign in</a>
                  </p>
                </form>
              ) : (
                <>
                  <SignUp
                    path="/signup"
                    signInUrl="/login"
                    fallbackRedirectUrl="/dashboard"
                    unsafeMetadata={{ agencyName: trimmedAgency }}
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
                        cardBox: "!w-full !min-w-0 shadow-none bg-transparent",
                        card: "!w-full !min-w-0 !max-w-full box-border shadow-none bg-transparent p-0 gap-4",
                        header: "px-0",
                        headerTitle: "text-[1.5rem] font-semibold tracking-tight",
                        headerSubtitle: "text-[13px]",
                        form: "!w-full gap-3.5",
                        formFieldRow: "flex-col gap-3.5",
                        formField: "!w-full !min-w-0",
                        formFieldInput: "!w-full box-border rounded-[12px]",
                        socialButtonsBlockButton: "!w-full box-border rounded-[12px]",
                        formButtonPrimary:
                          "normal-case text-sm font-semibold rounded-[12px] py-3 shadow-[0_12px_24px_-10px_rgba(11,58,42,0.55)] hover:brightness-95",
                        footer: "bg-transparent px-0",
                        footerAction: "text-[13px]",
                        dividerRow: "my-4",
                      },
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => goTo(0)}
                    className="w-full text-sm py-1.5 mt-3 transition rounded"
                    style={{ color: "#5a7a6a" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#13201b")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#5a7a6a")}
                  >
                    ← Back
                  </button>
                </>
              )}
            </div>
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