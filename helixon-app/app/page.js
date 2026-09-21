"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { useUser } from "@clerk/nextjs";
import Button from "@/components/landing/Button";
import ChatWidget from "@/components/landing/ChatWidget";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import CtaBand from "@/components/marketing/CtaBand";
import CountUp from "@/components/dashboard/CountUp";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Shared hooks ─────────────────────────────────────────────────────── */

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

/**
 * Decides whether a scroll-animated block should render its FINAL state.
 *
 * The rule is progressive enhancement: the finished content is what gets
 * server-rendered, and the "empty" starting frame only ever exists once we
 * know the browser is actually running the animation. Without this, the
 * pre-hydration and no-JS render is the zero frame - which on this page
 * meant a hero card of blank grey bars and a headline metric reading
 * "0 CVs per bulk upload" to anything that doesn't execute JS, crawlers
 * and social-preview bots included.
 *
 * Returns true when: not yet mounted (SSR/pre-hydration), the visitor has
 * asked for reduced motion, or the element has been scrolled into view.
 */
function useRevealedValue(ref, options) {
  const reducedMotion = usePrefersReducedMotion();
  const inView = useInView(ref, options);
  const [mounted, setMounted] = useState(false);
  const [seen, setSeen] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (inView) setSeen(true);
  }, [inView]);

  return !mounted || reducedMotion || seen;
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

/* ── Score helpers ────────────────────────────────────────────────────── */

function scoreColor(score) {
  if (score === null || score === undefined) return "var(--ink-faint)";
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return "var(--score-mid)";
  return "var(--score-low)";
}

function scoreLabel(score) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Review";
  return "Weak";
}

/* ── Hero product visual - a miniature recruiter workspace, not a toy demo ─
   This replaces a single-CV "scanning" animation with the thing a recruiter
   actually wants to see: several candidates, ranked, against one role. */

const WORKSPACE_ROLE = "Senior Software Engineer";
const WORKSPACE_CANDIDATES = [
  { name: "Jordan Williams", score: 94 },
  { name: "Sarah Evans", score: 88 },
  { name: "James Martin", score: 73 },
  { name: "Alex Jones", score: 51 },
];
const WORKSPACE_TOP_BREAKDOWN = {
  strengths: ["React", "TypeScript", "5 years' experience"],
  watch: ["Notice period"],
};

function RecruiterWorkspaceDemo() {
  const containerRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const pageVisible = usePageVisible();
  const inView = useInView(containerRef);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const animate = mounted && pageVisible && inView && !reducedMotion;

  // Both start fully revealed so the server render, a no-JS visitor and a
  // reduced-motion visitor all get the finished card. Previously these were
  // seeded from `reducedMotion`, which is always false on first render, so
  // the card painted empty and only filled in once the reveal timers ran -
  // leaving it permanently blank for anyone the animation never ran for.
  const [revealedCount, setRevealedCount] = useState(WORKSPACE_CANDIDATES.length);
  const [breakdownVisible, setBreakdownVisible] = useState(true);

  useEffect(() => {
    if (!animate) return undefined;
    setRevealedCount(0);
    setBreakdownVisible(false);
    const timeouts = [];
    WORKSPACE_CANDIDATES.forEach((_, i) => {
      timeouts.push(setTimeout(() => setRevealedCount((c) => Math.max(c, i + 1)), 260 * (i + 1)));
    });
    timeouts.push(setTimeout(() => setBreakdownVisible(true), 260 * WORKSPACE_CANDIDATES.length + 350));
    return () => timeouts.forEach(clearTimeout);
  }, [animate]);

  const topCandidate = WORKSPACE_CANDIDATES[0];

  return (
    <div
      ref={containerRef}
      className="rounded-[18px] p-6 w-full max-w-sm mx-auto lg:mx-0"
      style={{ background: "white", border: "1px solid var(--border)", boxShadow: "var(--shadow-raise, 0 20px 40px -20px rgba(19,32,27,0.18))" }}
      aria-label="Example recruiter workspace showing ranked candidates for one role"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold truncate" style={{ color: "var(--ink)" }}>{WORKSPACE_ROLE}</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--mint)", color: "var(--forest)" }}>Example role</span>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--ink-faint)" }}>{WORKSPACE_CANDIDATES.length} candidates analysed</p>

      <div className="rounded-[12px] overflow-hidden mb-5" style={{ border: "1px solid var(--border)" }}>
        {WORKSPACE_CANDIDATES.map((c, i) => {
          const shown = i < revealedCount;
          return (
            <div
              key={c.name}
              className="flex items-center justify-between px-3 py-2.5 transition-all duration-300"
              style={{
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
                background: i % 2 === 0 ? "white" : "var(--mist)",
                // Rows used to be fully transparent until the reveal animation
                // ran, so the card first painted as an empty white box. They now
                // paint immediately as grey placeholders and fill in.
                transform: shown ? "translateY(0)" : "translateY(0)",
              }}
            >
              <span className="text-[11px] font-medium truncate" style={{ color: "var(--ink)" }}>
                {shown ? c.name : <span aria-hidden="true" className="inline-block h-2.5 w-28 rounded-full align-middle" style={{ background: "var(--border)" }} />}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-semibold" style={{ color: scoreColor(c.score) }}>{shown ? scoreLabel(c.score) : ""}</span>
                <span className="text-xs font-semibold w-6 text-right" style={{ fontFamily: "var(--font-mono)", color: scoreColor(c.score) }}>
                  {shown ? c.score : "-"}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div
        className="rounded-[10px] p-4 transition-all duration-500"
        style={{
          background: "var(--mist)",
          opacity: breakdownVisible ? 1 : 0.3,
          transform: breakdownVisible ? "translateY(0)" : "translateY(4px)",
        }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Strongest match</span>
          <span className="text-xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--forest)" }}>{topCandidate.score}</span>
        </div>
        <ul className="space-y-1">
          {WORKSPACE_TOP_BREAKDOWN.strengths.map((s) => (
            <li key={s} className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}>
              <span style={{ color: "var(--forest)" }}>✓</span>{s}
            </li>
          ))}
          {WORKSPACE_TOP_BREAKDOWN.watch.map((w) => (
            <li key={w} className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ink-faint)" }}>
              <span style={{ color: "var(--signal, #c9922e)" }}>△</span>{w}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}


/* ── Dashboard preview - a miniature of the real /dashboard Overview (KPI
   cards, pipeline snapshot, attention list) built from sample data, not a
   live embed of the authenticated app. Numbers count up and bars grow the
   first time it scrolls into view, using the same motion vocabulary the
   real dashboard uses (see app/globals.css). ── */

const DASH_KPIS = [
  { label: "Analyses", value: 248, sub: "42 this week" },
  { label: "Strong matches", value: 61, sub: "25% of completed", accent: true },
  { label: "In pipeline", value: 34, sub: "Active, not yet placed" },
  { label: "Avg. score", value: 72, sub: "Across completed", meter: 72 },
];

const DASH_STAGES = [
  { label: "Screened", count: 96 },
  { label: "Shortlisted", count: 48 },
  { label: "Interview", count: 21 },
  { label: "Offer", count: 9 },
  { label: "Placed", count: 6 },
];

const DASH_ATTENTION = [
  { name: "Priya Anand", role: "Senior Software Engineer", reason: "Strong match", tone: "good", score: 91 },
  { name: "Marcus Webb", role: "Product Designer", reason: "Stalled · Interview", tone: "warn", score: 76 },
  { name: "Chloe Ferreira", role: "Data Analyst", reason: "Awaiting stage", tone: "neutral", score: 68 },
];

const DASH_TONES = {
  good: { bg: "var(--mint)", fg: "var(--forest)" },
  warn: { bg: "#fff8e6", fg: "#92620f" },
  neutral: { bg: "var(--mist)", fg: "var(--ink-soft)" },
};

function DashboardPreview() {
  const containerRef = useRef(null);
  // Latched by useRevealedValue: once played it stays at its final state,
  // so the counters never rewind when the card scrolls back out of view.
  const live = useRevealedValue(containerRef, { threshold: 0.25 });

  const maxStage = Math.max(...DASH_STAGES.map((s) => s.count));

  return (
    <div
      ref={containerRef}
      className="rounded-[18px] overflow-hidden w-full"
      style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 24px 48px -24px rgba(19,32,27,0.22)" }}
      aria-label="Example Helixon dashboard showing pipeline metrics for one agency"
    >
      {/* Window chrome, so it reads as a product screenshot rather than a widget */}
      <div className="flex items-center gap-1.5 px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--mist)" }} aria-hidden="true">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#e0e5e1" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#e0e5e1" }} />
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#e0e5e1" }} />
        <span className="ml-2 text-[11px]" style={{ color: "var(--ink-faint)" }}>Dashboard</span>
      </div>

      <div className="p-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
          {DASH_KPIS.map((k, i) => (
            <div
              key={k.label}
              className="rounded-[10px] p-3"
              style={{ border: "1px solid var(--border)", background: "white" }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--ink-faint)" }}>{k.label}</p>
              <p
                className="text-xl font-semibold tabular-nums leading-none"
                style={{ fontFamily: "var(--font-mono)", color: k.accent ? "var(--forest)" : "var(--ink)" }}
              >
                <CountUp value={live ? k.value : 0} duration={900 + i * 120} />
              </p>
              {typeof k.meter === "number" && (
                <div className="h-[3px] rounded-full mt-2 overflow-hidden" style={{ background: "var(--border-soft)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: live ? `${k.meter}%` : 0,
                      background: "var(--forest)",
                      transition: `width 0.9s ${EASE} ${i * 90}ms`,
                    }}
                  />
                </div>
              )}
              <p className="text-[10px] mt-1.5" style={{ color: "var(--ink-faint)" }}>{k.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5">
          {/* Pipeline snapshot */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Where candidates stand</p>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
              {DASH_STAGES.map((s, i) => (
                <div key={s.label} className="flex flex-col items-center min-w-0">
                  <span className="text-[13px] font-semibold tabular-nums leading-none" style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                    <CountUp value={live ? s.count : 0} duration={900} />
                  </span>
                  <div className="w-full flex items-end rounded-[4px] overflow-hidden mt-2 mb-1.5" style={{ height: 44, background: "var(--border-soft)" }}>
                    <div
                      className="w-full rounded-b-[4px]"
                      style={{
                        height: live ? `${Math.max(10, (s.count / maxStage) * 100)}%` : 0,
                        background: i === DASH_STAGES.length - 1 ? "var(--forest)" : "#a9c4b5",
                        transition: `height 0.8s ${EASE} ${i * 90}ms`,
                      }}
                    />
                  </div>
                  {/* Sentence case, not uppercase: at this size uppercase is
                      both wider (these five labels collided at 1440px) and
                      harder to read. */}
                  <span className="text-[10px] font-medium text-center leading-tight tracking-tight" style={{ color: "var(--ink-faint)" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Needs attention */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Needs your attention</p>
            <ul className="space-y-1.5">
              {DASH_ATTENTION.map((a, i) => (
                <li
                  key={a.name}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-[8px]"
                  style={{
                    background: "var(--mist)",
                    opacity: live ? 1 : 0,
                    transform: live ? "translateY(0)" : "translateY(6px)",
                    transition: `opacity 0.5s ${EASE} ${400 + i * 110}ms, transform 0.5s ${EASE} ${400 + i * 110}ms`,
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold truncate" style={{ color: "var(--ink)" }}>{a.name}</span>
                    <span className="block text-[10px] truncate" style={{ color: "var(--ink-faint)" }}>{a.role}</span>
                  </span>
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
                    style={{ background: DASH_TONES[a.tone].bg, color: DASH_TONES[a.tone].fg }}
                  >
                    {a.reason}
                  </span>
                  <span className="text-[11px] font-semibold tabular-nums shrink-0 w-5 text-right" style={{ fontFamily: "var(--font-mono)", color: scoreColor(a.score) }}>
                    {a.score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Pricing plan buy button - unchanged: calls /api/checkout, then redirects ── */
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

      if (posthog.__loaded) {
        posthog.capture("checkout_started", { plan });
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
        <p role="alert" aria-live="polite" className="text-[11px] text-center" style={{ color: highlight ? "#f2d7d5" /* light tint of --score-low, for contrast on the dark forest card */ : "var(--score-low)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Reusable CTA pair - label/target vary by context, never more than two ──
   When signed in, the primary CTA takes the visitor straight to their
   dashboard instead of pitching a demo they've already bought. */
function CtaButtons({ secondaryLabel = "See how it works", secondaryHref = "#how", align = "left", signedIn = false }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 w-full sm:w-auto ${align === "center" ? "justify-center items-center" : ""}`}>
      <Button as="a" href={signedIn ? "/dashboard" : "/demo"} variant="primary" className="w-full sm:w-auto min-h-[48px]">
        {signedIn ? "Go to dashboard" : "Get a demo"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Button>
      {!signedIn && (
        <Button as="a" href={secondaryHref} variant="outline" className="w-full sm:w-auto min-h-[48px]">
          {secondaryLabel}
        </Button>
      )}
    </div>
  );
}

/* ── Pain / before-after: two workflows, side by side ────────────────────── */

const MANUAL_STEPS = ["Open the CV", "Read it top to bottom", "Open the job description", "Compare by eye", "Note it down somewhere", "Decide", "Repeat, 50 times"];
const HELIXON_STEPS = ["Upload the CVs", "Helixon analyses each one", "Candidates are ranked", "Review the strongest matches", "Shortlist and move on"];

function TimelineColumn({ label, steps, tone }) {
  const accent = tone === "forest" ? "var(--forest)" : "var(--ink-mute)";
  return (
    <div className="rounded-[16px] p-7 h-full lift-on-hover" style={{ background: "white", border: "1px solid var(--border)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-widest mb-6" style={{ color: tone === "forest" ? "var(--forest)" : "var(--ink-faint)" }}>{label}</p>
      <ol className="relative pl-5">
        <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px" style={{ background: "var(--border)" }} aria-hidden="true" />
        {steps.map((step) => (
          <li key={step} className="relative pb-5 last:pb-0">
            <span className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full" style={{ background: tone === "forest" ? accent : "white", border: `2px solid ${accent}` }} aria-hidden="true" />
            <span className="text-sm" style={{ color: "var(--ink)" }}>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BeforeAfterSection() {
  return (
    <section className="max-w-[1100px] mx-auto px-6 py-24">
      <Reveal>
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            The bottleneck isn&rsquo;t hiring. It&rsquo;s everything before the shortlist.
          </h2>
          <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
            Most agencies still screen the way they did a decade ago — one CV, one tab,
            one spreadsheet at a time.
          </p>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Reveal><TimelineColumn label="Screening by hand" steps={MANUAL_STEPS} tone="muted" /></Reveal>
        <Reveal delay={80}><TimelineColumn label="Screening with Helixon" steps={HELIXON_STEPS} tone="forest" /></Reveal>
      </div>
    </section>
  );
}

/* ── Product workflow - interactive tabs standing in for the real product ── */

const WORKFLOW_TABS = ["Upload", "Analyse", "Compare", "Act"];

function UploadTabContent() {
  const files = ["A. Chen - CV.pdf", "R. Osei - CV.pdf", "M. Laurent - CV.docx"];
  return (
    <div>
      <div className="rounded-[12px] p-6 text-center mb-4" style={{ border: "1.5px dashed var(--border)" }}>
        <svg className="mx-auto mb-2" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4m0 0L7 9m5-5 5 5" />
          <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
        </svg>
        <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>Drop up to 50 CVs</p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-faint)" }}>PDF or Word, scanned or typed</p>
      </div>
      <div className="space-y-1.5">
        {files.map((f) => (
          <div key={f} className="flex items-center gap-2 text-[11px] px-3 py-2 rounded-[8px]" style={{ background: "var(--mist)", color: "var(--ink-soft)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
            {f}
          </div>
        ))}
        <p className="text-[11px] text-right" style={{ color: "var(--ink-faint)" }}>+ 9 more</p>
      </div>
    </div>
  );
}

function AnalyseTabContent() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Match score</span>
        <span className="text-2xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--forest)" }}>92</span>
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>Strong</p>
      <ul className="space-y-1 mb-4">
        {["5 years' React experience", "TypeScript", "SaaS product experience"].map((s) => (
          <li key={s} className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}><span style={{ color: "var(--forest)" }}>✓</span>{s}</li>
        ))}
      </ul>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>Worth a second look</p>
      <ul className="space-y-1">
        <li className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}><span style={{ color: "var(--signal, #c9922e)" }}>△</span>2-month notice period</li>
      </ul>
    </div>
  );
}

function CompareTabContent() {
  return (
    <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
      {WORKSPACE_CANDIDATES.map((c, i) => (
        <div key={c.name} className="flex items-center justify-between px-3 py-2.5" style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)", background: i % 2 === 0 ? "white" : "var(--mist)" }}>
          <span className="text-[11px] font-medium" style={{ color: "var(--ink)" }}>{c.name}</span>
          <span className="flex items-center gap-2">
            <span className="text-[11px] font-semibold" style={{ color: scoreColor(c.score) }}>{scoreLabel(c.score)}</span>
            <span className="text-xs font-semibold" style={{ fontFamily: "var(--font-mono)", color: scoreColor(c.score) }}>{c.score}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function ActTabContent() {
  const actions = ["Shortlist", "Tag: Strong lead", "Send draft email", "Move to interviewing"];
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <span key={a} className="text-[11px] font-medium px-3 py-2 rounded-[8px]" style={{ background: "var(--mint)", color: "var(--forest)" }}>{a}</span>
      ))}
    </div>
  );
}

const WORKFLOW_TAB_CONTENT = [UploadTabContent, AnalyseTabContent, CompareTabContent, ActTabContent];

function ProductWorkflowSection() {
  const [activeTab, setActiveTab] = useState(0);
  const TabContent = WORKFLOW_TAB_CONTENT[activeTab];

  return (
    <section id="how" className="py-24" style={{ background: "white", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}>
      <div className="max-w-[1100px] mx-auto px-6">
      <Reveal>
        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>How it works</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            From CV to shortlist, in one workflow
          </h2>
          <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
            Four steps, from the first upload to the candidate you pick up the phone to.
          </p>
        </div>
      </Reveal>

      <Reveal>
        <div className="rounded-[18px] overflow-hidden max-w-lg mx-auto" style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 20px 40px -20px rgba(19,32,27,0.12)" }}>
          <div className="flex items-center gap-1 px-3 pt-3" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#e0e5e1" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#e0e5e1" }} />
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#e0e5e1" }} />
          </div>
          <div className="flex gap-1 px-3 pt-3 overflow-x-auto" role="tablist" aria-label="Product workflow steps">
            {WORKFLOW_TABS.map((tab, i) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === i}
                onClick={() => setActiveTab(i)}
                className="text-[11px] font-semibold px-3 py-2 rounded-t-[8px] whitespace-nowrap transition-colors min-h-[36px]"
                style={{
                  color: activeTab === i ? "var(--forest)" : "var(--ink-faint)",
                  background: activeTab === i ? "var(--mist)" : "transparent",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div key={activeTab} className="p-6 fade-up-in" style={{ background: "var(--mist)", minHeight: "260px" }}>
            <TabContent />
          </div>
        </div>
      </Reveal>
      </div>
    </section>
  );
}

/* ── Built for recruiters - outcome pillars + the commercial "why" ───────── */

const BENEFIT_PILLARS = [
  { title: "Screen faster", body: "See the fit before you open the file, instead of reading every CV top to bottom.", icon: (<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />) },
  { title: "Prioritise instantly", body: "The strongest candidates rise to the top of every role automatically.", icon: (<path d="M12 2l3 6 6 .9-4.5 4.3 1 6-5.5-3-5.5 3 1-6L3 8.9 9 8z" />) },
  { title: "Decide consistently", body: "Every candidate is compared against the same role criteria, every time.", icon: (<><rect x="3" y="10" width="4" height="10" /><rect x="10" y="6" width="4" height="14" /><rect x="17" y="3" width="4" height="17" /></>) },
  { title: "Work as a team", body: "Notes, tags and shortlists stay in one place instead of scattered across email.", icon: (<><circle cx="9" cy="7" r="3" /><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" /><circle cx="19" cy="8" r="2.5" /></>) },
];

function BenefitsSection() {
  return (
    <section id="benefits" className="max-w-[1100px] mx-auto px-6 py-24">
      <Reveal>
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Helixon helps you decide. It doesn&rsquo;t decide for you.
          </h2>
          <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
            Every score comes with the reasoning behind it — the matched skills, the
            gaps and the flags — so you can check the call rather than take it on faith.
          </p>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {BENEFIT_PILLARS.map((b, i) => (
          <Reveal key={b.title} delay={i * 60}>
            <div className="rounded-[14px] p-6 h-full lift-on-hover" style={{ background: "white", border: "1px solid var(--border)" }}>
              <span className="w-10 h-10 rounded-[10px] flex items-center justify-center mb-4" style={{ background: "var(--mint)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{b.icon}</svg>
              </span>
              <h3 className="text-base font-semibold mb-2" style={{ color: "var(--ink)" }}>{b.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{b.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="rounded-[16px] p-8 text-center" style={{ background: "var(--mist)", border: "1px solid var(--border)" }}>
          <p className="text-base sm:text-lg font-medium leading-relaxed max-w-2xl mx-auto" style={{ color: "var(--ink)" }}>
            Less time screening, more candidates reviewed, faster shortlists
            <br className="hidden sm:block" /> — and more hours left for calls, sourcing and placements.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/* ── Bulk screening - the volume story, told without invented numbers ────── */

/* ── Bulk preview card - a miniature of the real bulk-upload queue (queued/
   analysing/done rows, live progress bar), same visual language as
   RecruiterWorkspaceDemo above. Sample data only, not a live embed of the
   authenticated app - see BulkAnalysisFlow in app/analyse/page.js for the
   real thing this mirrors. ── */

const BULK_PREVIEW_ROLE = "Senior Software Engineer";
const BULK_PREVIEW_ROWS = [
  { name: "Priya Anand", status: "done", score: 91 },
  { name: "Marcus Webb", status: "done", score: 76 },
  { name: "Chloe Ferreira", status: "processing", score: null },
  { name: "Daniel Osei", status: "queued", score: null },
  { name: "Leah Kaminski", status: "queued", score: null },
];

function BulkPreviewCard() {
  const containerRef = useRef(null);
  const pageVisible = usePageVisible();
  const revealed = useRevealedValue(containerRef);
  const animate = pageVisible && revealed;

  const total = BULK_PREVIEW_ROWS.length;
  // Starts at the settled state so the server render (and any no-JS
  // visitor) sees a populated queue rather than five "Queued" rows.
  const [doneCount, setDoneCount] = useState(2);

  useEffect(() => {
    if (!animate) return undefined;
    const t = setTimeout(() => setDoneCount(3), 1400);
    return () => clearTimeout(t);
  }, [animate]);

  const statusFor = (row, i) => (i < doneCount ? "done" : i === doneCount ? "processing" : "queued");

  return (
    <div
      ref={containerRef}
      className="rounded-[18px] p-6 w-full max-w-sm mx-auto"
      style={{ background: "white", border: "1px solid var(--border)", boxShadow: "var(--shadow-raise, 0 20px 40px -20px rgba(19,32,27,0.18))" }}
      aria-label="Example bulk-upload run showing several candidates queued for one role"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold truncate" style={{ color: "var(--ink)" }}>{BULK_PREVIEW_ROLE}</span>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--mint)", color: "var(--forest)" }}>Bulk upload</span>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--ink-faint)" }}>{total} CVs · one role</p>

      <div className="rounded-[12px] overflow-hidden mb-4" style={{ border: "1px solid var(--border)" }}>
        {BULK_PREVIEW_ROWS.map((row, i) => {
          const status = statusFor(row, i);
          return (
            <div
              key={row.name}
              className="flex items-center justify-between px-3 py-2.5 transition-all duration-300"
              style={{
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
                background: status === "processing" ? "var(--mint)" : i % 2 === 0 ? "white" : "var(--mist)",
              }}
            >
              <span className="text-[11px] font-medium truncate" style={{ color: "var(--ink)" }}>{row.name}</span>
              {status === "done" && (
                <span className="text-xs font-semibold" style={{ fontFamily: "var(--font-mono)", color: scoreColor(row.score) }}>{row.score}</span>
              )}
              {status === "processing" && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "var(--forest)" }}>
                  <span className="pulse-dot" aria-hidden="true" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--forest)", display: "inline-block" }} />
                  Analysing…
                </span>
              )}
              {status === "queued" && <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>Queued</span>}
            </div>
          );
        })}
      </div>

      <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: "var(--border-soft)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${(doneCount / total) * 100}%`,
            background: "var(--forest)",
            transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        />
      </div>
      <p className="text-[10px]" style={{ color: "var(--ink-faint)" }}>{doneCount} of {total} analysed</p>
    </div>
  );
}

function BulkScreeningSection() {
  const stages = [
    { label: "Upload the batch", detail: "Up to 50 CVs at once, against a single role" },
    { label: "Helixon scores each one", detail: "Every CV compared against the same job spec" },
    { label: "Review a ranked list", detail: "Sorted by fit, with the reasoning attached" },
  ];

  const nodes = stages.flatMap((s, i) => {
    const items = [
      <Reveal key={`stage-${i}`} delay={i * 80}>
        <div className="rounded-[14px] p-6 text-center h-full lift-on-hover" style={{ background: "white", border: "1px solid var(--border)" }}>
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold mb-3" style={{ background: "var(--mint)", color: "var(--forest)" }}>{i + 1}</span>
          <p className="text-[15px] font-semibold mb-1.5" style={{ color: "var(--ink)" }}>{s.label}</p>
          <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{s.detail}</p>
        </div>
      </Reveal>,
    ];
    if (i < stages.length - 1) {
      items.push(
        <svg key={`arrow-${i}`} className="hidden sm:block" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    }
    return items;
  });

  return (
    <section className="max-w-[1100px] mx-auto px-6 py-24">
      <Reveal>
        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Bulk screening</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            One role. Dozens of CVs. One ranked shortlist.
          </h2>
          <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
            Every candidate for a role is scored against the same spec, so the comparison
            holds up — and a weak CV never blocks the rest of the batch.
          </p>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 max-w-3xl mx-auto items-center mb-12">
        {nodes}
      </div>
      <Reveal delay={stages.length * 80}>
        <BulkPreviewCard />
      </Reveal>
    </section>
  );
}

/* ── Dashboard section - the "after the screening" half of the product.
   Every other section on this page is about scoring a CV; this is the one
   that shows what the recruiter manages afterwards. ── */

const DASHBOARD_POINTS = [
  "Every open role, every candidate and every score in one view",
  "Stalled candidates and unreviewed strong matches surfaced automatically",
  "Shared across your team, with a full audit trail of who screened what",
];

function DashboardSection() {
  return (
    <section id="dashboard" className="py-24" style={{ background: "white", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}>
      <div className="max-w-[1100px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-center">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>The dashboard</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              Screening is the start. This is where the desk gets run.
            </h2>
            <p className="text-[15px] leading-relaxed mb-6" style={{ color: "var(--ink-soft)" }}>
              Scores are only useful if they turn into placements. Helixon keeps every
              role, candidate and stage in one place, so nothing sits waiting in
              someone&rsquo;s inbox.
            </p>
            <ul className="space-y-3">
              {DASHBOARD_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  <svg className="shrink-0 mt-1" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={90}>
            <DashboardPreview />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Agency workflow - collaboration is visible, not a footnote ──────────── */

const AGENCY_FLOW = [
  { role: "Recruiter", action: "Screens candidates against the role" },
  { role: "Recruiter", action: "Adds notes and tags" },
  { role: "Team", action: "Shares the shortlist" },
  { role: "Hiring manager", action: "Reviews and moves candidates forward" },
];

function AgencyWorkflowSection() {
  return (
    <section id="agency" className="max-w-[1100px] mx-auto px-6 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <Reveal>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>For agencies</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Built for the way agency teams already work
          </h2>
          <p className="text-[15px] leading-relaxed mb-6 max-w-md" style={{ color: "var(--ink-soft)" }}>
            One recruiter screens and the whole team sees the result. Notes, tags and
            shortlists stay together, with a clear record of who screened what and when.
          </p>
          <div className="flex flex-wrap gap-2 mb-7">
            {["Shared shortlists", "Notes & tags", "Audit trail", "Multi-seat access"].map((chip) => (
              <span key={chip} className="text-[13px] font-medium px-3 py-1.5 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>{chip}</span>
            ))}
          </div>
          <Button as="a" href="/demo" variant="outline" className="min-h-[44px]">Book a demo</Button>
        </Reveal>

        <Reveal delay={80}>
          <div className="rounded-[16px] p-7" style={{ background: "white", border: "1px solid var(--border)" }}>
            <ol className="relative pl-6">
              <div className="absolute left-[9px] top-1.5 bottom-1.5 w-px" style={{ background: "var(--border)" }} aria-hidden="true" />
              {AGENCY_FLOW.map((step, i) => (
                <li key={`${step.role}-${i}`} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "var(--forest)" }} aria-hidden="true">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "white" }} />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--forest)" }}>{step.role}</p>
                  <p className="text-sm" style={{ color: "var(--ink)" }}>{step.action}</p>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Features - grouped by recruiter outcome, not by feature name ────────── */

const FEATURE_GROUPS = [
  {
    title: "Screen faster",
    body: "Get through a full pile of CVs in the time it used to take to read three.",
    items: ["Bulk CV upload, up to 50 at once", "PDF, Word, scanned and photographed CVs", "Fast, consistent parsing"],
  },
  {
    title: "Make better screening decisions",
    body: "See more than a score \u2014 see the reasoning behind it.",
    items: ["Match scoring against the role", "Standout factors", "Possible red flags", "Bias-aware scoring"],
  },
  {
    title: "Work as a team",
    body: "Keep every recruiter on the same shortlist.",
    items: ["Shared shortlists", "Tags & notes", "Full candidate history"],
  },
  {
    title: "Stay compliant",
    body: "Built for candidate data from the ground up.",
    items: ["EU-hosted infrastructure", "Encryption at rest & in transit", "Full audit trail", "GDPR-ready workflow"],
  },
];

function FeatureGroups() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      {FEATURE_GROUPS.map((g) => (
        <div key={g.title} className="rounded-[14px] p-7 lift-on-hover" style={{ background: "white", border: "1px solid var(--border)" }}>
          <h3 className="text-base font-semibold mb-2" style={{ color: "var(--ink)" }}>{g.title}</h3>
          <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--ink-soft)" }}>{g.body}</p>
          <ul className="space-y-2.5">
            {g.items.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--ink-soft)" }}>
                <svg className="shrink-0 mt-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* ── Testimonials - structured so real quotes can drop straight in ───────── */
/* TODO before launch: replace with verified customer quotes. Kept generic  */
/* by role/company-type (no fabricated names, logos or stats) until then.  */
const TESTIMONIALS = [
  {
    quote: "We used to spend a full afternoon triaging CVs for one role. Now it's the first ten minutes of the morning, and the shortlist is more consistent than when we did it by eye.",
    name: "Founder, 6-person recruitment agency",
  },
  {
    quote: "The red-flag summary caught an employment gap our team had missed twice. It doesn't replace judgement, but it stops things slipping through.",
    name: "Talent Acquisition Lead, mid-size agency",
  },
  {
    quote: "Bulk upload alone changed how we work. We screen against three or four roles a day and it just keeps up.",
    name: "Operations Manager, contract staffing firm",
  },
];

function Testimonials() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      {TESTIMONIALS.map((t, i) => (
        <Reveal key={t.name} delay={i * 70}>
          <figure className="rounded-[14px] p-7 flex flex-col h-full lift-on-hover" style={{ background: "white", border: "1px solid var(--border)" }}>
            <svg width="22" height="18" viewBox="0 0 20 16" fill="var(--mint)" className="mb-4" aria-hidden="true">
              <path d="M0 16V9.6C0 3.2 3.6 0 8.4 0v3.2c-2.4 0-4 1.6-4 4h4V16H0zm10.4 0V9.6c0-6.4 3.6-9.6 8.4-9.6v3.2c-2.4 0-4 1.6-4 4h4V16h-8.4z" />
            </svg>
            <blockquote className="text-sm leading-relaxed flex-1" style={{ color: "var(--ink-soft)" }}>
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="text-[13px] font-medium mt-5" style={{ color: "var(--ink-faint)" }}>{t.name}</figcaption>
          </figure>
        </Reveal>
      ))}
    </div>
  );
}

/* ── Trust / GDPR - a dedicated, weightier section since candidates' data is involved ── */

const TRUST_PILLARS = [
  { title: "EU-hosted infrastructure", body: "Candidate data stays on servers within the EU." },
  { title: "Encrypted throughout", body: "Encrypted at rest and in transit, end to end." },
  { title: "Never used to train models", body: "Candidate data is never used to train Helixon or anyone else's models." },
  { title: "Full audit trail", body: "Every score, note and status change is timestamped and attributed." },
];

function TrustSection() {
  return (
    <section className="py-20" style={{ background: "var(--forest)" }}>
      <div className="max-w-[1100px] mx-auto px-6">
        <Reveal>
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.65)" }}>Trust & compliance</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
              Candidate data, handled properly
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {TRUST_PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={i * 60}>
              <div className="rounded-[14px] p-6 h-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <h3 className="text-[15px] font-semibold mb-2 text-white">{p.title}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.72)" }}>{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="text-center">
          <a href="/dpa" className="text-sm font-medium hover:underline" style={{ color: "rgba(255,255,255,0.8)" }}>Read our Data Processing Agreement →</a>
        </div>
      </div>
    </section>
  );
}

/* ── Pricing plans - Trial tile replaced with a "get a quote" tile; paid
   plans/prices unchanged ── */

const PLANS = [
  {
    name: "Not sure yet?", price: "", period: "",
    features: ["Full platform walkthrough", "No obligation"],
    cta: "Get a demo", highlight: false, action: "demo",
  },
  {
    name: "Individual", price: "£249", period: "/ month",
    features: ["Unlimited analyses", "Bulk upload", "Shortlists & history", "Priority support"],
    cta: "Buy Individual", highlight: false, plan: "individual",
  },
  {
    name: "Agency", price: "£349", period: "/ month",
    features: ["Everything in Individual", "Multi-seat access", "Shared templates", "Dedicated onboarding"],
    cta: "Buy Agency", highlight: true, plan: "agency",
  },
];

/* ── FAQ - reordered around actual buying objections ──────────────────────── */

const FAQS = [
  { q: "How does Helixon score candidates?", a: "Each CV is compared against the job description you provide \u2014 skills, experience, seniority and role fit \u2014 to produce a single match score, alongside the standout factors and possible red flags behind it." },
  { q: "Does Helixon replace recruiter judgement?", a: "No. Helixon surfaces the score, standout factors and possible red flags so you can review candidates faster. The final call on who to interview or hire is always yours." },
  { q: "Can I upload multiple CVs for one role?", a: "Yes. Drop in up to 50 CVs against a single role at once and come back to a ranked, sortable shortlist instead of dozens of separate files." },
  { q: "What happens to candidate data?", a: "It's hosted on EU infrastructure, encrypted at rest and in transit, and never used to train any model. See our Data Processing Agreement for full detail." },
  { q: "Can my recruiting team collaborate?", a: "Yes, on the Agency plan. Shortlists, notes and tags are shared across your team, with a full audit trail of who screened what." },
  { q: "How do I get pricing for my team?", a: "Book a demo and we'll walk through pricing tailored to your team size and hiring volume." },
  { q: "Can I cancel anytime?", a: "Yes. Individual and Agency plans are billed monthly with no long-term contract. Cancel from your account settings and you'll keep access until the end of the billing period." },
];

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 py-4 text-left min-h-[44px]"
      >
        <span className="text-[15px] font-medium" style={{ color: "var(--ink)" }}>{q}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round"
          className="shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "260px" : "0px", opacity: open ? 1 : 0 }}
      >
        <p className="text-sm leading-relaxed pb-5 pr-8" style={{ color: "var(--ink-soft)" }}>{a}</p>
      </div>
    </div>
  );
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="max-w-2xl mx-auto">
      {FAQS.map((f, i) => (
        <FaqItem
          key={f.q}
          q={f.q}
          a={f.a}
          open={openIndex === i}
          onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
        />
      ))}
    </div>
  );
}

/* ── Above-the-fold trust strip metrics ───────────────────────────────────── */
/* NOTE: only claims we can currently stand behind - real usage/satisfaction  */
/* figures should replace or extend this array once available. No invented   */
/* percentages, ratings or volume stats.                                     */
/* "< 1 min to screen a full CV batch" was here and isn't defensible: a
   single analysis runs up to five sequential model calls, and a bulk run
   processes a limited number concurrently. Per-CV is the honest unit. */
const TRUST_METRICS = [
  { val: 50, suffix: "", label: "CVs per bulk upload, against one role" },
  { val: null, display: "Under a minute", label: "To score a CV against a full job spec" },
  { val: null, display: "EU-hosted", label: "Encrypted, GDPR-ready, never used for training" },
];

function TrustStrip() {
  const ref = useRef(null);
  const played = useRevealedValue(ref, { threshold: 0.4 });

  return (
    <section className="border-y" style={{ borderColor: "var(--border-soft, var(--border))", background: "white" }}>
      <div ref={ref} className="max-w-[1100px] mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
        {TRUST_METRICS.map((m) => (
          <div key={m.label}>
            <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--forest)" }}>
              {typeof m.val === "number" ? <CountUp value={played ? m.val : 0} duration={1000} /> : m.display}
            </p>
            <p className="text-[13px] mt-1.5 leading-relaxed max-w-[15rem] mx-auto" style={{ color: "var(--ink-faint)" }}>{m.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const signedIn = isLoaded && isSignedIn;
  const firstName = user?.firstName;

  return (
    <>
      <main className="min-h-screen" style={{ background: "var(--mist)" }}>

        <MarketingNav active="home" />

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <span
                className="fade-up-in inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full mb-6"
                style={{ background: "var(--mint)", color: "var(--forest)", "--stagger-delay": "0ms" }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                {signedIn ? `Welcome back${firstName ? `, ${firstName}` : ""}` : "AI screening built for agency recruiters"}
              </span>

              <h1
                className="fade-up-in text-4xl sm:text-[3.25rem] font-semibold tracking-tight leading-[1.06] mb-5"
                style={{ color: "var(--ink)", fontFamily: "var(--font-display)", "--stagger-delay": "70ms" }}
              >
                Screen every CV for a role in the time it takes to read one.
              </h1>

              <p
                className="fade-up-in text-[17px] leading-relaxed mb-8 max-w-lg"
                style={{ color: "var(--ink-soft)", "--stagger-delay": "140ms" }}
              >
                {signedIn
                  ? "Your dashboard is ready when you are — pick up where you left off and keep screening against your open roles."
                  : "Helixon scores every CV against your job spec, flags what deserves a second look, and hands back a ranked shortlist. Your team spends its hours on candidates instead of triage."}
              </p>

              <div className="fade-up-in" style={{ "--stagger-delay": "210ms" }}>
                <CtaButtons secondaryLabel="See how it works" secondaryHref="#how" signedIn={signedIn} />
              </div>

              {!signedIn && (
                <p className="fade-up-in text-[13px] mt-4" style={{ color: "var(--ink-faint)", "--stagger-delay": "280ms" }}>
                  No card required for a demo. Cancel a paid plan anytime.
                </p>
              )}
            </div>

            <div className="fade-up-in" style={{ "--stagger-delay": "160ms" }}>
              <RecruiterWorkspaceDemo />
            </div>
          </div>
        </section>

        {/* ── Trust strip ─────────────────────────────────────────────────── */}
        <TrustStrip />

        {/* ── Pain → before/after ─────────────────────────────────────────── */}
        <BeforeAfterSection />

        {/* ── Product workflow (interactive) ──────────────────────────────── */}
        <ProductWorkflowSection />

        {/* ── Built for recruiters + ROI ───────────────────────────────────── */}
        <BenefitsSection />

        {/* ── Bulk screening ───────────────────────────────────────────────── */}
        <BulkScreeningSection />

        {/* ── Dashboard (the manage-the-desk half of the product) ──────────── */}
        <DashboardSection />

        {/* ── Agency workflow ──────────────────────────────────────────────── */}
        <AgencyWorkflowSection />

        {/* ── Features, grouped by outcome ─────────────────────────────────── */}
        <section id="features" className="py-24" style={{ background: "white", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}>
          <div className="max-w-[1100px] mx-auto px-6">
            <Reveal>
              <div className="text-center mb-12">
                <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Capabilities</p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                  Built for the volume agency recruiters actually handle
                </h2>
                <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
                  The parts that matter when you&rsquo;re screening dozens of CVs a week, not
                  a demo that only holds up on one perfect candidate.
                </p>
              </div>
            </Reveal>
            <Reveal><FeatureGroups /></Reveal>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────────────────────────────── */}
        <section className="max-w-[1100px] mx-auto px-6 py-24">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Fewer hours screening. More time interviewing.
              </h2>
            </div>
          </Reveal>
          <Testimonials />
        </section>

        {/* ── Trust / GDPR ─────────────────────────────────────────────────── */}
        <TrustSection />

        {/* ── Pricing / buy ───────────────────────────────────────────────── */}
        <section id="pricing" className="max-w-[1100px] mx-auto px-6 py-24">
          <Reveal>
            <div className="text-center mb-14">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Pricing</p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Plans built around how agencies actually screen
              </h2>
              <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
                Book a demo to see it run on your own CVs, or start on a plan today.
                Monthly billing, no long-term contract.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto items-stretch">
            {PLANS.map((plan) => (
              <Reveal key={plan.name}>
                <div
                  className="rounded-[16px] p-6 flex flex-col relative h-full"
                  style={{
                    background: plan.highlight ? "var(--forest)" : "white",
                    border: plan.highlight ? "1px solid var(--forest)" : "1px solid var(--border)",
                    boxShadow: plan.highlight ? "0 12px 28px -12px rgba(11,110,79,0.5)" : "none",
                  }}
                >
                  {plan.highlight && (
                    <span
                      className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ background: "var(--signal, #f5a623)", color: "var(--forest)" }}
                    >
                      Recommended for agencies
                    </span>
                  )}
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: plan.highlight ? "rgba(255,255,255,0.8)" : "var(--ink-faint)" }}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1.5 mb-6">
                    <span className="text-[2.25rem] font-semibold leading-none" style={{ fontFamily: "var(--font-mono)", color: plan.highlight ? "white" : "var(--ink)" }}>{plan.price}</span>
                    <span className="text-[13px]" style={{ color: plan.highlight ? "rgba(255,255,255,0.7)" : "var(--ink-faint)" }}>{plan.period}</span>
                  </div>
                  <ul className="space-y-3 mb-7 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: plan.highlight ? "rgba(255,255,255,0.92)" : "var(--ink-soft)" }}>
                        <svg className="shrink-0 mt-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={plan.highlight ? "rgba(255,255,255,0.9)" : "var(--forest)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.action === "demo" ? (
                    <Button
                      as="a"
                      href="/demo"
                      variant="primary"
                      size="block"
                      className="min-h-[44px]"
                    >
                      {plan.cta}
                    </Button>
                  ) : (
                    <BuyPlanButton plan={plan.plan} label={plan.cta} highlight={plan.highlight} />
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section id="faq" className="py-24" style={{ background: "white", borderTop: "1px solid var(--border-soft)" }}>
          <div className="max-w-[1100px] mx-auto px-6">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>FAQ</p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Questions recruiters usually ask
              </h2>
            </div>
          </Reveal>
          <Reveal><FAQSection /></Reveal>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <Reveal>
          <CtaBand
            heading="Your next great hire is already in that pile of CVs."
            body="Find them in minutes, not hours. Get a demo and we'll show you how."
          />
        </Reveal>

        <MarketingFooter />
      </main>
      <ChatWidget />
    </>
  );
}