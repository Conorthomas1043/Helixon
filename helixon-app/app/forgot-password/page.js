"use client";
import { useState, useRef, useEffect } from "react";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// ── Floating-label field - matches /login ─────────────────────────────────
function FloatField({ id, label, value, onChange, type = "text", autoFocus, autoComplete, required, status }) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;
  const borderColor = status === "error" ? "rgba(220,38,38,0.55)" : focused ? "var(--forest)" : "var(--border)";

  return (
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
          color: active ? (status === "error" ? "#dc2626" : "var(--forest)") : "#8aaa9a",
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
        className="w-full bg-transparent outline-none"
        style={{
          color: "#13201b",
          fontSize: "14px",
          padding: active ? "22px 14px 8px" : "14px",
          transition: `padding 0.2s ${EASE}`,
        }}
      />
    </div>
  );
}

// ── Magnetic primary button - matches /login ──────────────────────────────
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      let data;
      try { data = await res.json(); }
      catch { data = null; }

      // Always show the same success state whether or not the email is on
      // file - avoids leaking which addresses have accounts.
      if (res.ok || res.status === 404) {
        setSent(true);
      } else {
        setError(data?.error || `Something went wrong (status ${res.status}).`);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex relative overflow-hidden">

      {/* ── Ambient mesh background - matches /login ────────────────────── */}
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

      {/* ── Left panel - branding, matches /login gradient + copy tone ──── */}
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
              Account recovery
            </p>
            <h1 className="text-white text-[2.6rem] font-semibold leading-[1.08] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Locked out is<br />temporary.
            </h1>
            <p className="text-[15px] leading-relaxed max-w-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
              Enter your email and we&apos;ll send a secure link to get you straight back into your candidate pipeline.
            </p>
          </div>

          <div className="flex items-start gap-3 max-w-sm">
            <svg className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--mint)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              Reset links expire after 30 minutes and can only be used once, for your account&apos;s security.
            </p>
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

          <div className="relative" key={sent ? "sent" : "form"} style={{ animation: `panelIn 0.4s ${EASE}` }}>
            {!sent ? (
              <>
                <div className="mb-7">
                  <h2 className="text-[1.5rem] font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
                    Reset your password
                  </h2>
                  <p className="text-[13px] mt-0.5" style={{ color: "#5a7a6a" }}>
                    Enter the email you signed up with and we&apos;ll send a reset link.
                  </p>
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

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <FloatField
                    id="email"
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoFocus
                    autoComplete="email"
                    required
                    status={error ? "error" : undefined}
                  />

                  <div className="pt-1">
                    <MagneticButton type="submit" onClick={handleSubmit} disabled={loading} loading={loading}>
                      Send reset link
                    </MagneticButton>
                  </div>

                  <a
                    href="/login"
                    className="block w-full text-center text-sm py-1.5 transition"
                    style={{ color: "#5a7a6a" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#13201b")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#5a7a6a")}
                  >
                    ← Back to sign in
                  </a>
                </form>

                <p className="text-[13px] text-center mt-5" style={{ color: "#5a7a6a" }}>
                  New to Helixon?{" "}
                  <a href="/signup" className="font-semibold hover:underline transition" style={{ color: "var(--forest)" }}>
                    Create an account
                  </a>
                </p>
              </>
            ) : (
              <div className="text-center">
                <div className="w-11 h-11 rounded-[12px] flex items-center justify-center mx-auto mb-5" style={{ background: "var(--mint)" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <h2 className="text-[1.4rem] font-semibold tracking-tight mb-1.5" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
                  Check your inbox
                </h2>
                <p className="text-[13px] leading-relaxed mb-7" style={{ color: "#5a7a6a" }}>
                  If an account exists for{" "}
                  <span className="font-semibold" style={{ color: "#13201b" }}>{email}</span>, a reset link
                  is on its way. It&apos;ll expire in 30 minutes.
                </p>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => { setSent(false); setEmail(""); setError(""); }}
                    className="w-full font-semibold py-3 rounded-[12px] text-sm transition-colors"
                    style={{ border: "1.5px solid var(--border)", color: "#13201b", background: "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    Use a different email
                  </button>
                  <a
                    href="/login"
                    className="block w-full text-center text-sm py-1.5 transition"
                    style={{ color: "#5a7a6a" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#13201b")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#5a7a6a")}
                  >
                    ← Back to sign in
                  </a>
                </div>
              </div>
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