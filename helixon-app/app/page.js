"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CookieConsentBanner from "../components/CookieConsentBanner";
import Button from "@/components/landing/Button";
import ChatWidget from "@/components/landing/ChatWidget";

const TRIAL_EMAIL_KEY = "helixon-trial-email";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function usePageVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);
  return visible;
}

function useInView(ref, options = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: options.threshold ?? 0.15, rootMargin: options.rootMargin ?? "0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, options.threshold, options.rootMargin]);
  return inView;
}

function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -32px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "reveal--visible" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEMO_CANDIDATES = [
  { name: "R. Okafor",   role: "Sales Executive",        score: 91 },
  { name: "J. Marchetti",role: "Software Engineer",      score: 74 },
  { name: "S. Devine",   role: "Operations Manager",     score: 58 },
  { name: "L. Yang",     role: "Customer Success Mgr",   score: 96 },
];

const STAGES = ["Reading CV", "Parsing job description", "Analysing candidate fit", "Generating score"];

function scoreColor(score) {
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return "var(--score-mid)";
  return "var(--score-low)";
}

// ── Live scan demo — the hero's signature element ───────────────────────
function LiveScanDemo() {
  const containerRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const pageVisible = usePageVisible();
  const inView = useInView(containerRef);
  const animating = pageVisible && inView && !reducedMotion;

  const [index, setIndex]   = useState(0);
  const [stage, setStage]   = useState(reducedMotion ? STAGES.length - 1 : 0);
  const [revealed, setRevealed] = useState(reducedMotion);

  useEffect(() => {
    if (!animating) return;
    setStage(0);
    setRevealed(false);
    const stageIv = setInterval(() => {
      setStage((s) => {
        if (s >= STAGES.length - 1) {
          clearInterval(stageIv);
          setTimeout(() => setRevealed(true), 250);
          return s;
        }
        return s + 1;
      });
    }, 550);
    return () => clearInterval(stageIv);
  }, [index, animating]);

  useEffect(() => {
    if (!animating || !revealed) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % DEMO_CANDIDATES.length), 2200);
    return () => clearTimeout(t);
  }, [revealed, animating]);

  const candidate = DEMO_CANDIDATES[index];

  return (
    <div
      ref={containerRef}
      className="rounded-[16px] p-6 w-full max-w-sm mx-auto lg:mx-0"
      style={{ background: "white", border: "1px solid var(--border)", boxShadow: "var(--shadow-raise, 0 20px 40px -20px rgba(19,32,27,0.18))" }}
      aria-live="polite"
      aria-label="Live CV scan demonstration"
    >
      <div className="flex items-center justify-between mb-5">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--ink-faint)" }}>
          Live scan
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-medium" style={{ color: "var(--ink-soft)" }}>
          <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: revealed ? "var(--forest)" : "var(--score-mid)" }} />
          {revealed ? "Scored" : "Scanning…"}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "var(--mint)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.8" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: "var(--ink)" }}>{candidate.name}.pdf</p>
          <p className="text-[10px]" style={{ color: "var(--ink-faint)" }}>vs {candidate.role}</p>
        </div>
      </div>

      <div className="space-y-1.5 mb-5">
        {STAGES.map((s, i) => {
          const complete = i < stage || revealed;
          const active = i === stage && !revealed;
          return (
            <div key={s} className={`flex items-center gap-2.5 transition-opacity duration-300 ${!complete && !active ? "opacity-30" : ""}`}>
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold transition-colors"
                style={{
                  background: complete ? "var(--forest)" : active ? "var(--mint)" : "var(--border)",
                  color: complete ? "white" : active ? "var(--forest)" : "var(--ink-mute)",
                }}
              >
                {complete ? "✓" : ""}
              </div>
              <span className="text-[10px]" style={{ color: active ? "var(--ink)" : "var(--ink-faint)", fontWeight: active ? 600 : 400 }}>
                {s}{active ? "…" : ""}
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="rounded-[10px] p-4 flex items-center justify-between transition-all duration-500"
        style={{
          background: revealed ? "var(--mist)" : "transparent",
          opacity: revealed ? 1 : 0,
          transform: revealed ? "translateY(0)" : "translateY(4px)",
        }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Match score</span>
        <span className="text-2xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: scoreColor(candidate.score) }}>
          {revealed ? candidate.score : "—"}
        </span>
      </div>
    </div>
  );
}

// ── Free-trial email gate — captures email for retention before granting access ──
function TrialGateModal({ open, onClose, returnFocusRef }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      try {
        const saved = sessionStorage.getItem(TRIAL_EMAIL_KEY);
        if (saved) setEmail(saved);
      } catch { /* private browsing */ }
      setTimeout(() => inputRef.current?.focus(), reducedMotion ? 0 : 250);
    } else {
      document.body.style.overflow = "";
      returnFocusRef?.current?.focus({ preventScroll: true });
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, returnFocusRef, reducedMotion]);

  useEffect(() => {
    if (!email) return;
    try { sessionStorage.setItem(TRIAL_EMAIL_KEY, email); } catch { /* ignore */ }
  }, [email]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!open) return null;

  const active = focused || email.length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address to continue.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/trial/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), marketingOptIn }),
      });
      let data;
      try { data = await res.json(); } catch { data = null; }

      if (!res.ok || !data?.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }

      try { sessionStorage.removeItem(TRIAL_EMAIL_KEY); } catch { /* ignore */ }
      router.push(data?.redirectTo || "/analyse");
      router.refresh();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-gate-title"
      aria-describedby="trial-gate-desc"
    >
      <div
        className="absolute inset-0"
        style={{ background: "rgba(11,26,20,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", animation: reducedMotion ? "none" : `fadeIn 0.25s ${EASE}` }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={dialogRef}
        className="relative w-full max-w-[400px] rounded-[22px] p-7 sm:p-8 overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.7)",
          boxShadow: "0 50px 100px -30px rgba(11,26,20,0.45)",
          animation: reducedMotion ? "none" : `popIn 0.35s ${EASE}`,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="btn-ghost absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ color: "var(--ink-faint)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>

        <div className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-5" style={{ background: "var(--mint)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>

        <h2 id="trial-gate-title" className="text-[1.4rem] font-semibold tracking-tight mb-1.5" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          Start your 3 free analyses
        </h2>
        <p id="trial-gate-desc" className="text-[13px] leading-relaxed mb-6" style={{ color: "var(--ink-soft)" }}>
          No card, no signup form — just your email so we can save your results and let you pick up where you left off.
        </p>

        {error && (
          <div role="alert" aria-live="assertive" className="mb-4 flex items-start gap-2.5 p-3 rounded-[10px]" style={{ background: "#fef2f2", border: "1px solid #fecaca", animation: reducedMotion ? "none" : "shake 0.4s ease" }}>
            <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--score-low)" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p id="trial-email-error" className="text-[13px]" style={{ color: "var(--score-low)" }}>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div
            className="relative rounded-[12px] mb-3.5"
            style={{
              border: `1.5px solid ${error ? "rgba(192,57,43,0.5)" : focused ? "var(--forest)" : "var(--border)"}`,
              boxShadow: focused ? "0 0 0 4px var(--mint)" : "none",
              transition: `all 0.2s ${EASE}`,
            }}
          >
            <label
              htmlFor="trial-email"
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
              Email address
            </label>
            <input
              ref={inputRef}
              id="trial-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "trial-email-error" : undefined}
              required
              className="w-full bg-transparent text-sm outline-none"
              style={{
                color: "var(--ink)",
                padding: active ? "22px 14px 8px" : "14px",
                transition: `padding 0.2s ${EASE}`,
              }}
            />
          </div>

          <label className="flex items-start gap-2.5 text-[12px] select-none mb-5" style={{ color: "var(--ink-faint)" }}>
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 rounded"
              style={{ accentColor: "var(--forest)" }}
            />
            <span>Send me occasional tips on hiring smarter. Unsubscribe anytime.</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="btn-forest w-full text-white font-semibold py-3 rounded-[12px] text-sm transition-all flex items-center justify-center gap-2"
            style={{
              background: loading ? "var(--ink-mute)" : "var(--forest)",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 12px 24px -10px rgba(11,58,42,0.5)",
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Starting…
              </>
            ) : (
              <>
                Start scanning — it&apos;s free
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </>
            )}
          </button>
        </form>

        <p className="text-[11px] text-center mt-4" style={{ color: "var(--ink-mute)" }}>
          Already have an account?{" "}
          <Link href="/login" className="font-medium hover:underline" style={{ color: "var(--ink-faint)" }}>Sign in</Link>
        </p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.94) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
      `}</style>
    </div>
  );
}

// ── Pricing plan buy button — calls /api/checkout, then redirects ────────
function BuyPlanButton({ plan, label, highlight }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      let data;
      try { data = await res.json(); } catch { data = null; }

      if (!res.ok || !data?.ok || !data?.redirectTo) {
        setError(data?.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = data.redirectTo;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-busy={loading}
        className="text-center text-xs font-semibold py-3 rounded-[10px] transition-all w-full min-h-[44px]"
        style={{
          background: loading ? "var(--ink-mute)" : highlight ? "white" : "var(--forest)",
          color: highlight ? "var(--forest)" : "white",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Redirecting…" : label}
      </button>
      {error && (
        <p role="alert" aria-live="polite" className="text-[11px] text-center" style={{ color: highlight ? "#fecaca" : "var(--score-low)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ── Reusable CTA button pair ─────────────────────────────────────────────
function CtaButtons({ align = "left", onTryFree }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 w-full sm:w-auto ${align === "center" ? "justify-center items-center" : ""}`}>
      <Button
        variant="primary"
        onClick={onTryFree}
        className="w-full sm:w-auto min-h-[48px]"
      >
        Try it free
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Button>
      <Button
        as="a"
        href="#pricing"
        variant="outline"
        className="w-full sm:w-auto min-h-[48px]"
      >
        See plans &amp; buy
      </Button>
    </div>
  );
}

export default function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const trialTriggerRef = useRef(null);
  const gateReturnFocusRef = useRef(null);

  const openGate = useCallback((e) => {
    gateReturnFocusRef.current = e?.currentTarget || trialTriggerRef.current;
    setGateOpen(true);
  }, []);
  const closeGate = useCallback(() => setGateOpen(false), []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [mobileNavOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileNavOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;
    function onKey(e) {
      if (e.key === "Escape") setMobileNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  const plans = [
    {
      name: "Free", price: "£0", period: "forever",
      features: ["3 free analyses", "Match score & summary", "Email drafting"],
      cta: "Try it free", highlight: false, action: "trial",
    },
    {
      name: "Individual", price: "£249", period: "/ month",
      features: ["Unlimited analyses", "Bulk upload", "Shortlists & history", "Priority support"],
      cta: "Buy Individual", highlight: true, plan: "individual",
    },
    {
      name: "Agency", price: "£349", period: "/ month",
      features: ["Everything in Individual", "Multi-seat access", "Shared templates", "Dedicated onboarding"],
      cta: "Buy Agency", highlight: false, plan: "agency",
    },
  ];

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <CookieConsentBanner />
      <main className="min-h-screen" style={{ background: "var(--mist)" }}>

        <TrialGateModal open={gateOpen} onClose={closeGate} returnFocusRef={gateReturnFocusRef} />

        {/* ── Nav ─────────────────────────────────────────────────────────── */}
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

            <div className="hidden md:flex items-center gap-1 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
              <a href="#how" className="nav-link">How it works</a>
              <a href="#pricing" className="nav-link">Pricing</a>
              <Link href="/login" className="nav-link">Login</Link>
              <Link href="/signup" className="nav-link">Sign up</Link>
            </div>

            <div className="flex items-center gap-2">
              <Button
                ref={trialTriggerRef}
                variant="primary"
                size="sm"
                onClick={openGate}
                className="hidden md:inline-flex min-h-[36px]"
              >
                Try now
              </Button>
              <button
                type="button"
                onClick={() => setMobileNavOpen(v => !v)}
                aria-expanded={mobileNavOpen}
                aria-controls="mobile-nav"
                aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                className="md:hidden w-10 h-10 rounded-[8px] flex items-center justify-center"
                style={{ color: "var(--ink)" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {mobileNavOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
                </svg>
              </button>
            </div>
          </div>
          {mobileNavOpen && (
            <div id="mobile-nav" className="md:hidden border-t px-4 py-3 flex flex-col gap-0.5 bg-white" style={{ borderColor: "var(--border)" }}>
              {[["How it works", "#how"], ["Pricing", "#pricing"], ["Login", "/login"], ["Sign up", "/signup"]].map(([label, href]) => (
                href.startsWith("/") ? (
                  <Link key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-3 rounded-[8px] min-h-[44px] flex items-center" style={{ color: "var(--ink-soft)" }}>{label}</Link>
                ) : (
                  <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-3 rounded-[8px] min-h-[44px] flex items-center" style={{ color: "var(--ink-soft)" }}>{label}</a>
                )
              ))}
              <Button
                variant="primary"
                size="sm"
                onClick={(e) => { setMobileNavOpen(false); openGate(e); }}
                className="mt-1 min-h-[44px]"
              >
                Try now
              </Button>
            </div>
          )}
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section id="main-content" className="max-w-[1100px] mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "var(--mint)", color: "var(--forest)" }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                GDPR-ready · Data held in the EU
              </span>

              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Stop reading CVs.<br />Start reading scores.
              </h1>

              <p className="text-sm leading-relaxed mb-8 max-w-md" style={{ color: "var(--ink-soft)" }}>
                Drop in a CV and a job requirement. Helixon reads both, scores the fit, flags red flags, and drafts the
                follow-up email — in under 30 seconds. Built for agency recruiters who screen dozens of CVs a day.
              </p>

              <CtaButtons onTryFree={openGate} />

              <p className="text-[11px] mt-4" style={{ color: "var(--ink-faint)" }}>No card required · 3 free analyses · Cancel anytime</p>
            </div>

            <LiveScanDemo />
          </div>
        </section>

        {/* ── Trust strip ─────────────────────────────────────────────────── */}
        <section className="border-y" style={{ borderColor: "var(--border-soft, var(--border))", background: "white" }}>
          <div className="max-w-[1100px] mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              { val: "30 sec", label: "Avg. time to score" },
              { val: "50+", label: "CVs screened per agency/wk" },
              { val: "GDPR", label: "EU-hosted, never used to train" },
              { val: "4.8/5", label: "Recruiter satisfaction" },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--forest)" }}>{m.val}</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--ink-faint)" }}>{m.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── How it works ────────────────────────────────────────────────── */}
        <section id="how" className="max-w-[1100px] mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-faint)" }}>How it works</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              Three steps. No spreadsheet required.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { n: "1", title: "Name & pick the job", body: "Name the analysis, then pick a preset role or paste your own job description." },
              { n: "2", title: "Upload the CV", body: "Drag in a PDF or Word file — Helixon reads it in seconds, no formatting required." },
              { n: "3", title: "Get your score", body: "A match score, standout factors, red flags, and a ready-to-send email — all in one screen." },
            ].map((s) => (
              <div key={s.n} className="rounded-[14px] p-6" style={{ background: "white", border: "1px solid var(--border)" }}>
                <span className="w-8 h-8 rounded-[9px] flex items-center justify-center text-xs font-bold mb-4" style={{ background: "var(--mint)", color: "var(--forest)" }}>{s.n}</span>
                <h3 className="text-sm font-semibold mb-1.5" style={{ color: "var(--ink)" }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing / buy ───────────────────────────────────────────────── */}
        <section id="pricing" className="max-w-[1100px] mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-faint)" }}>Pricing</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              Plans that pay for themselves in one placement
            </h2>
            <p className="text-xs max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>Start free. Upgrade the moment you need more than 3 analyses.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto items-stretch">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className="rounded-[16px] p-6 flex flex-col relative h-full"
                style={{
                  background: plan.highlight ? "var(--forest)" : "white",
                  border: plan.highlight ? "1px solid var(--forest)" : "1px solid var(--border)",
                  boxShadow: plan.highlight ? "0 12px 28px -12px rgba(11,110,79,0.5)" : "none",
                }}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: plan.highlight ? "rgba(255,255,255,0.8)" : "var(--ink-faint)" }}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-3xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: plan.highlight ? "white" : "var(--ink)" }}>{plan.price}</span>
                  <span className="text-[11px]" style={{ color: plan.highlight ? "rgba(255,255,255,0.7)" : "var(--ink-faint)" }}>{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs" style={{ color: plan.highlight ? "rgba(255,255,255,0.92)" : "var(--ink-soft)" }}>
                      <span className="shrink-0 mt-0.5">✓</span>{f}
                    </li>
                  ))}
                </ul>
                {plan.action === "trial" ? (
                  <Button
                    variant="primary"
                    size="block"
                    onClick={openGate}
                    className="min-h-[44px]"
                  >
                    {plan.cta}
                  </Button>
                ) : (
                  <BuyPlanButton plan={plan.plan} label={plan.cta} highlight={plan.highlight} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section className="max-w-[1100px] mx-auto px-6 pb-24">
          <div className="rounded-[20px] px-8 py-14 text-center" style={{ background: "var(--forest)" }}>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3 text-white" style={{ fontFamily: "var(--font-display)" }}>
              Your next great hire is in that pile of CVs.
            </h2>
            <p className="text-xs mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.75)" }}>
              Find them in seconds, not hours. Try Helixon free — no card needed.
            </p>
            <div className="flex justify-center">
              <Button
                as="a"
                href="/demo"
                variant="onForest"
                className="motion-safe-scale hover:scale-[1.02] min-h-[48px]"
              >
                Get a demo
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </Button>
            </div>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t" style={{ borderColor: "var(--border)" }}>
          <div className="max-w-[1100px] mx-auto px-6 py-12 grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
                  <svg width="15" height="15" viewBox="0 0 28 28" fill="none">
                    <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                    <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                    <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
                  </svg>
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>Helixon</span>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--ink-faint)" }}>
                Screen candidates in seconds. GDPR-ready, EU-hosted.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Product</p>
              <ul className="space-y-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                <li><a href="/how-it-works" className="hover:underline">How it works</a></li>
                <li><a href="/pricing" className="hover:underline">Pricing</a></li>
                <li><a href="/faq" className="hover:underline">FAQ</a></li>
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Company</p>
              <ul className="space-y-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                <li><a href="/about" className="hover:underline">About</a></li>
                <li><a href="/careers" className="hover:underline">Careers</a></li>
                <li><a href="/blog" className="hover:underline">Blog</a></li>
                <li><a href="/contact" className="hover:underline">Contact</a></li>
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Legal</p>
              <ul className="space-y-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                <li><a href="/privacy" className="hover:underline">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:underline">Terms of Service</a></li>
                <li><a href="/CookiePolicy" className="hover:underline">Cookie Policy</a></li>
                <li><a href="/dpa" className="hover:underline">Data Processing Agreement</a></li>
                <li><a href="/complaints" className="hover:underline">Complaints</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t" style={{ borderColor: "var(--border)" }}>
            <div className="max-w-[1100px] mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>© {new Date().getFullYear()} Helixon. Screen candidates in seconds.</span>
              <a href="/login" className="text-[11px] hover:underline" style={{ color: "var(--ink-faint)" }}>Login</a>
            </div>
          </div>
        </footer>
      </main>
      <ChatWidget />
    </>
  );
}
