"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// ── Floating-label field - same signature treatment as /signup ───────────
function FloatField({ id, label, value, onChange, type = "text", autoFocus, autoComplete, required, status, hint, trailing, center, mono, inputMode, maxLength }) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;
  const borderColor = status === "error" ? "rgba(220,38,38,0.55)" : focused ? "var(--forest)" : "var(--border)";

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
        <label
          htmlFor={id}
          className="absolute left-3.5 select-none pointer-events-none transition-all"
          style={{
            top: active ? "7px" : "50%",
            transform: active ? "translateY(0)" : "translateY(-50%)",
            fontSize: active ? "10px" : "13.5px",
            fontWeight: active ? 600 : 400,
            letterSpacing: active ? "0.03em" : "0",
            color: active ? (status === "error" ? "#dc2626" : "var(--forest)") : "var(--ink-soft)",
            textTransform: active ? "uppercase" : "none",
            transitionTimingFunction: EASE,
            transitionDuration: "0.2s",
          }}
        >
          {label}
        </label>
        <input
          id={id}
          name={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          required={required}
          inputMode={inputMode}
          maxLength={maxLength}
          className="w-full bg-transparent outline-none"
          style={{
            color: "#13201b",
            textAlign: center ? "center" : "left",
            fontFamily: mono ? "var(--font-mono)" : "inherit",
            fontSize: mono ? "18px" : "14px",
            letterSpacing: mono ? "0.5em" : "normal",
            padding: active
              ? `22px 14px 8px ${trailing ? "34px" : "14px"}`
              : `14px ${trailing ? "34px" : "14px"} 14px 14px`,
            transition: `padding 0.2s ${EASE}`,
          }}
        />
        {trailing && <span className="absolute right-3 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      {hint && (
        <p aria-live="polite" className="text-[11px] mt-1.5 pl-0.5" style={{ color: status === "error" ? "#dc2626" : "var(--ink-soft)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Magnetic primary button - same as /signup ─────────────────────────────
function MagneticButton({ children, type = "button", onClick, disabled, loading }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function handleMouseMove(e) {
    if (disabled || loading || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ x: (e.clientX - (r.left + r.width / 2)) * 0.08, y: (e.clientY - (r.top + r.height / 2)) * 0.25 });
  }
  function reset() { setPos({ x: 0, y: 0 }); }

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      className="w-full relative text-white font-semibold py-3 rounded-[12px] text-sm flex items-center justify-center gap-2 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : children}
    </button>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState("credentials"); // "credentials" | "mfa"

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [factorId, setFactorId] = useState(null);
  const [mfaCode, setMfaCode] = useState("");

  const errorRef = useRef(null);
  const cardRef = useRef(null);
  const [spot, setSpot] = useState({ x: 50, y: 0 });

  function handleCardMouseMove(e) {
    const r = cardRef.current?.getBoundingClientRect();
    if (!r) return;
    setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }

  useEffect(() => {
    if (error && errorRef.current) errorRef.current.focus();
  }, [error]);

  const getRecaptchaToken = useCallback(async () => {
    // Guard against a missing env var producing a confusing runtime error -
    // fail with a clear, actionable message instead.
    if (!RECAPTCHA_SITE_KEY) {
      throw new Error("Security check is unavailable right now. Please try again shortly.");
    }
    if (!window.grecaptcha?.execute) {
      throw new Error("Security check failed to load. Please refresh and try again.");
    }
    await new Promise((resolve) => window.grecaptcha.ready(resolve));
    return window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "login" });
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const recaptchaToken = await getRecaptchaToken();
      const res = await fetch("/api/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password, rememberMe, recaptchaToken }),
      });

      let data;
      try { data = await res.json(); }
      catch { setError(`Server error (status ${res.status}).`); return; }

      if (!res.ok || !data.ok) { setError(data?.error || `Login failed (status ${res.status}).`); return; }

      if (data.needsMfa) {
        setFactorId(data.factorId);
        setStep("mfa");
        return;
      }

      if (!data.isAdmin) {
        // One-time flag the dashboard reads on next load to show a
        // "Welcome back" banner, then clears - so it doesn't reappear on
        // every refresh, only right after an actual login.
        try { sessionStorage.setItem("helixon_just_logged_in", "1"); } catch { /* ignore */ }
      }

      router.push(data.isAdmin ? "/admin" : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message || "Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyMfa(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa-verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ factorId, code: mfaCode, rememberMe }),
      });

      let data;
      try { data = await res.json(); }
      catch { setError(`Server error (status ${res.status}).`); return; }

      if (!res.ok || !data.ok) { setError(data?.error || `Verification failed (status ${res.status}).`); return; }

      if (!data.isAdmin) {
        try { sessionStorage.setItem("helixon_just_logged_in", "1"); } catch { /* ignore */ }
      }

      router.push(data.isAdmin ? "/admin" : "/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex relative overflow-hidden">
      {RECAPTCHA_SITE_KEY && (
        <Script src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`} strategy="afterInteractive" />
      )}

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
              { value: "10�-", label: "Faster screening" },
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

      {/* ── Right panel - glass card form ───────────────────────────────── */}
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

          <div className="relative" key={step} style={{ animation: `panelIn 0.4s ${EASE}` }}>
            {step === "credentials" ? (
              <>
                <div className="mb-7">
                  <h2 className="text-[1.5rem] font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Welcome back</h2>
                  <p className="text-[13px] mt-0.5" style={{ color: "#5a7a6a" }}>Sign in to your Helixon account</p>
                </div>

                {error && (
                  <div
                    ref={errorRef}
                    tabIndex={-1}
                    role="alert"
                    aria-live="assertive"
                    className="mb-5 flex items-start gap-2.5 p-3.5 rounded-[10px] outline-none"
                    style={{ background: "rgba(254,242,242,0.9)", border: "1px solid #fecaca", animation: "shake 0.4s ease" }}
                  >
                    <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-[13px]" style={{ color: "#b91c1c" }}>{error}</p>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-3.5" noValidate>
                  <FloatField id="email" label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" required />

                  <div>
                    <FloatField
                      id="password"
                      label="Password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={setPassword}
                      autoComplete="current-password"
                      required
                      trailing={
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="rounded focus:outline-none focus-visible:ring-2"
                          style={{ color: "#8aaa9a" }}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          )}
                        </button>
                      }
                    />
                    <div className="flex justify-end mt-1.5">
                      <a href="/forgot-password" className="text-xs font-medium hover:underline transition" style={{ color: "var(--forest)" }}>
                        Forgot password?
                      </a>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 select-none cursor-pointer w-fit pt-1">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded"
                      style={{ accentColor: "var(--forest)" }}
                    />
                    <span className="text-[13px]" style={{ color: "#5a7a6a" }}>Remember me for 30 days</span>
                  </label>

                  <div className="pt-1">
                    <MagneticButton type="submit" onClick={handleLogin} disabled={loading} loading={loading}>
                      Sign in
                    </MagneticButton>
                  </div>
                </form>

                <p className="text-[11px] text-center mt-4 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  This site is protected by reCAPTCHA and the Google{" "}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline hover:opacity-80">Privacy Policy</a>{" "}
                  and{" "}
                  <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="underline hover:opacity-80">Terms of Service</a>{" "}
                  apply.
                </p>

                <p className="text-[13px] text-center mt-5" style={{ color: "#5a7a6a" }}>
                  New to Helixon?{" "}
                  <a href="/signup" className="font-semibold hover:underline transition" style={{ color: "var(--forest)" }}>Create an account</a>
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-7">
                  <div className="w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "var(--mint)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="5" y="10" width="14" height="10" rx="2.5" />
                      <path d="M8 10V7a4 4 0 018 0v3" />
                      <circle cx="12" cy="15" r="1.5" fill="var(--forest)" stroke="none" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-[1.35rem] font-semibold tracking-tight leading-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Two-factor verification</h2>
                    <p className="text-[13px] mt-0.5" style={{ color: "#5a7a6a" }}>Enter the 6-digit code from your app.</p>
                  </div>
                </div>

                {error && (
                  <div
                    ref={errorRef}
                    tabIndex={-1}
                    role="alert"
                    aria-live="assertive"
                    className="mb-5 flex items-start gap-2.5 p-3.5 rounded-[10px] outline-none"
                    style={{ background: "rgba(254,242,242,0.9)", border: "1px solid #fecaca", animation: "shake 0.4s ease" }}
                  >
                    <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-[13px]" style={{ color: "#b91c1c" }}>{error}</p>
                  </div>
                )}

                <form onSubmit={handleVerifyMfa} className="space-y-4" noValidate>
                  <FloatField
                    id="mfa-code"
                    label="Verification code"
                    value={mfaCode}
                    onChange={(v) => setMfaCode(v.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    required
                    center
                    mono
                  />

                  <MagneticButton type="submit" onClick={handleVerifyMfa} disabled={loading || mfaCode.length !== 6} loading={loading}>
                    Verify and sign in
                  </MagneticButton>

                  <button
                    type="button"
                    onClick={() => { setStep("credentials"); setMfaCode(""); setError(""); }}
                    className="w-full text-sm py-1.5 transition focus:outline-none focus-visible:ring-2 rounded"
                    style={{ color: "#5a7a6a" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#13201b")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#5a7a6a")}
                  >
                    ← Back to sign in
                  </button>
                </form>
              </>
            )}
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