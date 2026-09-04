"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)"; // signature "expo-out" easing used across the flow

const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PW_CHECKS = [
  { key: "minLength",    label: "8+ characters",   test: (p) => p.length >= 8 },
  { key: "hasUppercase", label: "Uppercase",       test: (p) => /[A-Z]/.test(p) },
  { key: "hasNumber",    label: "Number",          test: (p) => /[0-9]/.test(p) },
  { key: "hasSymbol",    label: "Symbol",          test: (p) => /[!@#$%^&*()\-_=+\[\]{};':",.<>?]/.test(p) },
];

const STEPS = [
  { key: "name",     label: "You" },
  { key: "agency",   label: "Agency" },
  { key: "security", label: "Security" },
  { key: "confirm",  label: "Confirm" },
];

const STEP_COPY = [
  { eyebrow: "01 - Identity", title: <>Let&apos;s get<br />your name.</>, body: "We'll use this to personalise your workspace and greet you by name." },
  { eyebrow: "02 - Handle", title: <>Claim your<br />handle.</>, body: "Your username is how teammates will find and mention you once you invite them in." },
  { eyebrow: "03 - Security", title: <>Secure your<br />account.</>, body: "Pick a password you don't use anywhere else. We'll never store it in plain text." },
  { eyebrow: "04 - Review", title: <>Almost<br />there.</>, body: "Double-check everything looks right, then create your workspace." },
];

// ── Per-step mark - a small, quiet motif rather than a big illustration ──
function StepMark({ step }) {
  const stroke = "rgba(255,255,255,0.9)";
  const common = { width: 44, height: 44, viewBox: "0 0 44 44", fill: "none" };
  if (step === 0) return (
    <svg {...common}>
      <circle cx="22" cy="16" r="7" stroke={stroke} strokeWidth="1.6" />
      <path d="M9 36c1.6-8 6.8-12.5 13-12.5S33.4 28 35 36" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
  if (step === 1) return (
    <svg {...common}>
      <rect x="7" y="12" width="30" height="20" rx="4" stroke={stroke} strokeWidth="1.6" />
      <path d="M13 20h10M13 25h6" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="30" cy="25" r="2" fill={stroke} />
    </svg>
  );
  if (step === 2) return (
    <svg {...common}>
      <rect x="11" y="20" width="22" height="16" rx="3.5" stroke={stroke} strokeWidth="1.6" />
      <path d="M15.5 20v-5a6.5 6.5 0 0113 0v5" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="22" cy="27.5" r="2" fill={stroke} />
    </svg>
  );
  return (
    <svg {...common}>
      <circle cx="22" cy="22" r="14" stroke={stroke} strokeWidth="1.6" />
      <path d="M16 22.5l4.5 4.5L29 17" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Floating-label field - the signature input treatment for this flow ────
function FloatField({ label, value, onChange, type = "text", autoFocus, autoComplete, status, hint, maxLength, prefix, trailing, onKeyDownCapture }) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;
  const borderColor =
    status === "error" ? "rgba(220,38,38,0.55)"
    : status === "success" ? "var(--forest)"
    : focused ? "var(--forest)"
    : "var(--border)";

  return (
    <div>
      <div
        className="relative rounded-[12px] transition-all"
        style={{
          border: `1.5px solid ${borderColor}`,
          background: "rgba(255,255,255,0.6)",
          boxShadow: focused ? "0 0 0 4px var(--mint)" : "none",
          transitionTimingFunction: EASE,
          transitionDuration: "0.25s",
        }}
      >
        {prefix && (
          <span
            className="absolute left-3.5 select-none text-sm transition-all"
            style={{ color: "#8aaa9a", top: active ? "20px" : "50%", transform: active ? "translateY(0)" : "translateY(-50%)", transitionTimingFunction: EASE, transitionDuration: "0.2s" }}
          >
            {prefix}
          </span>
        )}
        <label
          className="absolute left-3.5 select-none pointer-events-none transition-all"
          style={{
            top: active ? "7px" : "50%",
            transform: active ? "translateY(0)" : "translateY(-50%)",
            left: prefix && !active ? "26px" : "14px",
            fontSize: active ? "10px" : "13.5px",
            fontWeight: active ? 600 : 400,
            letterSpacing: active ? "0.03em" : "0",
            color: active ? (status === "error" ? "#dc2626" : "var(--forest)") : "#8aaa9a",
            textTransform: active ? "uppercase" : "none",
            transitionTimingFunction: EASE,
            transitionDuration: "0.2s",
          }}
        >
          {label}
        </label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDownCapture={onKeyDownCapture}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          maxLength={maxLength}
          className="w-full bg-transparent text-sm outline-none"
          style={{
            color: "#13201b",
            padding: active ? `22px ${trailing ? "34px" : "14px"} 8px ${prefix ? "26px" : "14px"}` : `14px ${trailing ? "34px" : "14px"} 14px ${prefix ? "26px" : "14px"}`,
            transition: `padding 0.2s ${EASE}`,
          }}
        />
        {trailing && <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      {hint && (
        <p aria-live="polite" className="text-[11px] mt-1.5 pl-0.5" style={{ color: status === "error" ? "#dc2626" : status === "success" ? "var(--forest)" : "#8aaa9a" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Magnetic primary button - cursor-aware micro-displacement on hover ────
function MagneticButton({ children, onClick, disabled, loading }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function handleMouseMove(e) {
    if (disabled || loading || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const relX = e.clientX - (r.left + r.width / 2);
    const relY = e.clientY - (r.top + r.height / 2);
    setPos({ x: relX * 0.08, y: relY * 0.25 });
  }
  function reset() { setPos({ x: 0, y: 0 }); }

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
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
      {loading ? (
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : children}
    </button>
  );
}

export default function SignupPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [animating, setAnimating] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState("idle");
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // Card spotlight - follows cursor for a subtle premium sheen
  const cardRef = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 0 });
  function handleCardMouseMove(e) {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  const cleanUsername = username.trim().toLowerCase();
  const trimmedAgency = agencyName.trim();
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();

  const checkUsername = useCallback(async (value) => {
    if (!USERNAME_RE.test(value)) {
      setUsernameStatus(value.length === 0 ? "idle" : "invalid");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setUsernameStatus("checking");
    try {
      const res = await fetch(`/api/auth/username-available?u=${encodeURIComponent(value)}`, { signal: controller.signal });
      const data = await res.json().catch(() => null);
      setUsernameStatus(data?.available ? "available" : "taken");
    } catch (err) {
      if (err.name !== "AbortError") setUsernameStatus("idle");
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!cleanUsername) { setUsernameStatus("idle"); return; }
    debounceRef.current = setTimeout(() => checkUsername(cleanUsername), 400);
    return () => clearTimeout(debounceRef.current);
  }, [cleanUsername, checkUsername]);

  const pwResults  = useMemo(() => PW_CHECKS.map((c) => ({ ...c, pass: c.test(password) })), [password]);
  const pwScore    = pwResults.filter((c) => c.pass).length;
  const pwAllValid = pwScore === PW_CHECKS.length;

  const stepValid = [
    trimmedFirst.length > 0 && trimmedLast.length > 0 && EMAIL_RE.test(email),
    USERNAME_RE.test(cleanUsername) && usernameStatus === "available" && trimmedAgency.length > 0,
    pwAllValid,
    agreedToTerms,
  ];

  function goTo(next) {
    if (next === step) return;
    setDirection(next > step ? 1 : -1);
    setAnimating(true);
    setError("");
    setTimeout(() => { setStep(next); setAnimating(false); }, 260);
  }

  function handleNext() {
    if (!stepValid[step]) {
      const msgs = [
        "Enter your first name, last name, and a valid email address.",
        usernameStatus === "taken" ? "That username is already taken." : "Choose an available username and enter your agency name.",
        "Your password doesn't meet all the requirements yet.",
        "Please agree to the Terms and Privacy Policy to continue.",
      ];
      setError(msgs[step]);
      return;
    }
    if (step < STEPS.length - 1) goTo(step + 1);
    else handleSignup();
  }

  function handleBack() { if (step > 0) goTo(step - 1); }

  function handleKeyDown(e) {
    if (e.key === "Enter" && step < STEPS.length - 1) { e.preventDefault(); handleNext(); }
  }

  async function handleSignup() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: trimmedFirst, lastName: trimmedLast, username: cleanUsername, email, password, agencyName: trimmedAgency, plan: "solo" }),
      });
      let data;
      try { data = await res.json(); }
      catch { setError(`Server error (status ${res.status}).`); return; }
      if (!res.ok || !data.ok) { setError(data?.error || `Signup failed (status ${res.status}).`); return; }
      if (!data.user) { setCheckEmail(true); return; }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const bg = (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #eef4f0 0%, #e7f0ea 45%, #dcebe0 100%)" }} />
      <div className="absolute w-[620px] h-[620px] rounded-full blur-3xl animate-[driftA_20s_ease-in-out_infinite]" style={{ background: "var(--mint)", opacity: 0.5, top: "-14%", left: "32%" }} />
      <div className="absolute w-[440px] h-[440px] rounded-full blur-3xl animate-[driftB_24s_ease-in-out_infinite]" style={{ background: "var(--forest)", opacity: 0.1, bottom: "-10%", left: "58%" }} />
      <div className="absolute w-[340px] h-[340px] rounded-full blur-3xl animate-[driftA_28s_ease-in-out_infinite_reverse]" style={{ background: "var(--signal, #f59e0b)", opacity: 0.12, bottom: "12%", left: "72%" }} />
      {/* film grain */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.05] mix-blend-overlay">
        <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" /></filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
    </div>
  );

  if (checkEmail) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        {bg}
        <div
          className="relative rounded-[20px] p-9 w-full max-w-sm text-center animate-[popIn_0.5s_cubic-bezier(0.16,1,0.3,1)]"
          style={{ background: "rgba(255,255,255,0.78)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 40px 80px -30px rgba(19,32,27,0.28), 0 1px 0 rgba(255,255,255,0.9) inset" }}
        >
          <div className="w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-5" style={{ background: "var(--forest)" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold mb-2 tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Check your email</h1>
          <p className="text-sm leading-relaxed" style={{ color: "#5a7a6a" }}>
            We&apos;ve sent a confirmation link to <span className="font-medium" style={{ color: "#13201b" }}>{email}</span>. Click it to activate your account.
          </p>
        </div>
        <style>{`
          @keyframes popIn { from { opacity:0; transform: scale(0.94) translateY(10px);} to { opacity:1; transform: scale(1) translateY(0);} }
          @keyframes driftA { 0%,100% { transform: translate(0,0) scale(1);} 50% { transform: translate(-34px,28px) scale(1.09);} }
          @keyframes driftB { 0%,100% { transform: translate(0,0) scale(1);} 50% { transform: translate(28px,-22px) scale(1.06);} }
        `}</style>
      </main>
    );
  }

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

        <div className="relative z-10 min-h-[300px]">
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
            <div key={s.key} className="flex items-center gap-2.5">
              <div
                className="rounded-full transition-all"
                style={{ width: i === step ? "22px" : "6px", height: "6px", background: i <= step ? "var(--mint)" : "rgba(255,255,255,0.2)", transitionDuration: "0.4s", transitionTimingFunction: EASE }}
              />
            </div>
          ))}
          <span className="text-[11px] ml-1 tabular-nums" style={{ color: "rgba(255,255,255,0.4)" }}>{step + 1}/{STEPS.length}</span>
        </div>
      </div>

      {/* ── Right panel - form ───────────────────────────────────────────── */}
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
          {/* cursor-follow sheen */}
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
                    style={{
                      width: i < step ? "100%" : i === step ? "100%" : "0%",
                      background: i <= step ? "var(--forest)" : "transparent",
                      transition: `width 0.5s ${EASE}`,
                      opacity: i === step ? 1 : i < step ? 0.85 : 1,
                    }}
                  />
                </div>
              ))}
            </div>

            {error && (
              <div role="alert" className="mb-5 flex items-start gap-2.5 p-3.5 rounded-[10px]" style={{ background: "rgba(254,242,242,0.9)", border: "1px solid #fecaca", animation: "shake 0.4s ease" }}>
                <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-[13px]" style={{ color: "#b91c1c" }}>{error}</p>
              </div>
            )}

            <div
              key={step}
              onKeyDownCapture={handleKeyDown}
              style={{
                opacity: animating ? 0 : 1,
                transform: animating ? `translateX(${direction * 14}px)` : "translateX(0)",
                transition: `opacity 0.26s ${EASE}, transform 0.26s ${EASE}`,
              }}
            >
              {step === 0 && (
                <div className="space-y-3.5">
                  <div className="mb-1">
                    <h2 className="text-[1.5rem] font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>What&apos;s your name?</h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "#5a7a6a" }}>So we know what to call you.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FloatField label="First name" value={firstName} onChange={setFirstName} autoFocus autoComplete="given-name" />
                    <FloatField label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" />
                  </div>
                  <FloatField label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" />
                </div>
              )}

              {step === 1 && (
                <div className="space-y-3.5">
                  <div className="mb-1">
                    <h2 className="text-[1.5rem] font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Claim your handle</h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "#5a7a6a" }}>Pick a username and tell us your agency.</p>
                  </div>
                  <FloatField
                    label="Username"
                    value={username}
                    onChange={(v) => setUsername(v.replace(/\s/g, ""))}
                    autoFocus
                    autoComplete="username"
                    maxLength={20}
                    prefix="@"
                    status={usernameStatus === "taken" || usernameStatus === "invalid" ? "error" : usernameStatus === "available" ? "success" : "idle"}
                    hint={
                      usernameStatus === "taken" ? "That username is already taken."
                      : usernameStatus === "invalid" ? "3–20 chars, start with a letter, letters/numbers/underscores only."
                      : usernameStatus === "available" ? `helixon.com/@${cleanUsername} is yours.`
                      : usernameStatus === "checking" ? "Checking availability…"
                      : "This is how teammates will mention and find you."
                    }
                    trailing={
                      usernameStatus === "checking" ? (
                        <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ color: "#b0c4ba" }}>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : usernameStatus === "available" ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (usernameStatus === "taken" || usernameStatus === "invalid") ? (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : null
                    }
                  />
                  <FloatField label="Agency name" value={agencyName} onChange={setAgencyName} autoComplete="organization" />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-3.5">
                  <div className="mb-1">
                    <h2 className="text-[1.5rem] font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Secure your account</h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "#5a7a6a" }}>Make it strong - this protects your candidates&apos; data too.</p>
                  </div>
                  <FloatField
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={setPassword}
                    autoFocus
                    autoComplete="new-password"
                    trailing={
                      <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ color: "#8aaa9a" }} aria-label={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        )}
                      </button>
                    }
                  />
                  <div className="pt-0.5">
                    <div className="flex gap-1">
                      {PW_CHECKS.map((c, i) => (
                        <div key={c.key} className="h-[3px] flex-1 rounded-full" style={{ background: i < pwScore ? (pwScore === PW_CHECKS.length ? "var(--forest)" : pwScore >= 3 ? "#f59e0b" : "#f87171") : "var(--border)", transition: `background 0.3s ${EASE}` }} />
                      ))}
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5">
                      {pwResults.map((c) => (
                        <span key={c.key} className="flex items-center gap-1 text-[11px] transition-colors" style={{ color: c.pass ? "var(--forest)" : "#a8bdb2" }}>
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                            {c.pass ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /> : <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />}
                          </svg>
                          {c.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <div className="mb-1">
                    <h2 className="text-[1.5rem] font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Review &amp; confirm</h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "#5a7a6a" }}>Tap any field to jump back and edit it.</p>
                  </div>

                  <div className="rounded-[14px] overflow-hidden" style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,0.5)" }}>
                    <SummaryRow label="Name" value={`${trimmedFirst} ${trimmedLast}`} onEdit={() => goTo(0)} />
                    <SummaryRow label="Email" value={email} onEdit={() => goTo(0)} />
                    <SummaryRow label="Username" value={`@${cleanUsername}`} onEdit={() => goTo(1)} />
                    <SummaryRow label="Agency" value={trimmedAgency} onEdit={() => goTo(1)} last />
                  </div>

                  <label className="flex items-start gap-2.5 text-[12px] select-none pt-1" style={{ color: "#5a7a6a" }}>
                    <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-0.5 w-3.5 h-3.5 rounded" style={{ accentColor: "var(--forest)" }} />
                    <span>
                      I agree to Helixon&apos;s{" "}
                      <a href="/terms" className="font-medium hover:underline" style={{ color: "var(--forest)" }} target="_blank" rel="noopener noreferrer">Terms</a>{" "}
                      and{" "}
                      <a href="/privacy" className="font-medium hover:underline" style={{ color: "var(--forest)" }} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                    </span>
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mt-7">
              {step > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="text-sm font-semibold px-4 py-3 rounded-[12px] transition-colors shrink-0"
                  style={{ border: "1.5px solid var(--border)", color: "#13201b" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.6)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  Back
                </button>
              )}
              <MagneticButton onClick={handleNext} disabled={loading} loading={loading}>
                {step === STEPS.length - 1 ? "Create account" : (
                  <>
                    Continue
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </>
                )}
              </MagneticButton>
            </div>

            <p className="text-[13px] text-center mt-6" style={{ color: "#5a7a6a" }}>
              Already have an account?{" "}
              <a href="/login" className="font-semibold hover:underline transition" style={{ color: "var(--forest)" }}>Sign in</a>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes panelIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        @keyframes driftA { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-34px, 28px) scale(1.09); } }
        @keyframes driftB { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(28px, -22px) scale(1.06); } }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
    </main>
  );
}

function SummaryRow({ label, value, onEdit, last }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors group"
      style={{ borderBottom: last ? "none" : "1px solid var(--border)" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.7)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#8aaa9a" }}>{label}</p>
        <p className="text-sm font-medium mt-0.5" style={{ color: "#13201b" }}>{value || "-"}</p>
      </div>
      <span className="text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--forest)" }}>Edit</span>
    </button>
  );
}