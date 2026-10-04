"use client";
import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import Button from "@/components/landing/Button";
import ChatWidget from "@/components/landing/ChatWidget";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import CtaBand from "@/components/marketing/CtaBand";
import CountUp from "@/components/dashboard/CountUp";
import AnalysisExample from "@/components/landing/AnalysisExample";
import useScrollEntrance from "@/lib/hooks/useScrollEntrance";
import useRovingTabs from "@/lib/hooks/useRovingTabs";
import { PLAN_FEATURES } from "@/lib/plan-features";
import { startCheckout } from "@/lib/start-checkout";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/* ── Scroll reveal ────────────────────────────────────────────────────────
   Content is visible by default; see lib/hooks/useScrollEntrance for when
   (and why only then) it is switched to its hidden starting frame. */

function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const phase = useScrollEntrance(ref, { offset: "32px" });

  return (
    <div
      ref={ref}
      className={`reveal ${phase === "armed" ? "reveal--armed" : ""} ${className}`}
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
  // "static" (server render, no JS, reduced motion, or already on screen at
  // load) shows the finished card. Only a card that starts off screen - the
  // hero on a phone - is blanked, and it fills in once, when scrolled to.
  // Previously it blanked and replayed in front of desktop visitors on load
  // and again every time it came back into view.
  const phase = useScrollEntrance(containerRef);
  const [stepCount, setStepCount] = useState(0);
  const [breakdownShown, setBreakdownShown] = useState(false);

  useEffect(() => {
    if (phase !== "entered") return undefined;
    const timeouts = WORKSPACE_CANDIDATES.map((_, i) => setTimeout(() => setStepCount(i + 1), 260 * (i + 1)));
    timeouts.push(setTimeout(() => setBreakdownShown(true), 260 * WORKSPACE_CANDIDATES.length + 350));
    return () => timeouts.forEach(clearTimeout);
  }, [phase]);

  const revealedCount = phase === "static" ? WORKSPACE_CANDIDATES.length : stepCount;
  const breakdownVisible = phase === "static" || breakdownShown;
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
            <li key={w} className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}>
              <span style={{ color: "var(--score-mid)" }} aria-hidden="true">△</span>{w}
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
  { label: "Strong matches", value: 61, sub: "25% of completed" },
  { label: "Time to fill", value: 11, sub: "Days, median · 6 roles", accent: true },
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
  { name: "Chloe Ferreira", role: "Care Assistant", reason: "Awaiting stage", tone: "neutral", score: 68 },
];

const DASH_ROLES = [
  { title: "Warehouse Operative", client: "Northgate Logistics", candidates: 38, top: 88, status: "Open" },
  { title: "Senior Software Engineer", client: "Brightline", candidates: 24, top: 94, status: "Interviewing" },
  { title: "Care Assistant", client: "Meadowview Care", candidates: 17, top: 91, status: "Open" },
  { title: "Sales Executive", client: "Corwin Group", candidates: 12, top: 82, status: "Open" },
];

const DASH_TONES = {
  good: { bg: "var(--mint)", fg: "var(--forest)" },
  warn: { bg: "#fff8e6", fg: "#92620f" },
  neutral: { bg: "var(--mist)", fg: "var(--ink-soft)" },
};

function DashboardPreview() {
  const containerRef = useRef(null);
  // Latched: once played it stays at its final state, so the counters never
  // rewind when the card scrolls back out of view.
  const live = useScrollEntrance(containerRef, { offset: "20%" }) !== "armed";

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
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--ink-faint)" }}>{k.label}</p>
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
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Where candidates stand</p>
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
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Needs your attention</p>
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
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
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

        {/* Open roles - the jobs list the real dashboard leads with */}
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-faint)" }}>Open roles</p>
          <div className="rounded-[10px] overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_80px_64px_92px] gap-3 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "var(--mist)", color: "var(--ink-faint)" }}>
              <span>Role</span>
              <span className="text-right">Candidates</span>
              <span className="text-right">Top</span>
              <span className="hidden sm:block text-right">Status</span>
            </div>
            {DASH_ROLES.map((r, i) => (
              <div
                key={r.title}
                className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_80px_64px_92px] gap-3 items-center px-3 py-2"
                style={{
                  borderTop: "1px solid var(--border-soft)",
                  opacity: live ? 1 : 0,
                  transition: `opacity 0.5s ${EASE} ${600 + i * 90}ms`,
                }}
              >
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold truncate" style={{ color: "var(--ink)" }}>{r.title}</span>
                  <span className="block text-[10px] truncate" style={{ color: "var(--ink-faint)" }}>{r.client}</span>
                </span>
                <span className="text-[11px] tabular-nums text-right" style={{ fontFamily: "var(--font-mono)", color: "var(--ink-soft)" }}>{r.candidates}</span>
                <span className="text-[11px] font-semibold tabular-nums text-right" style={{ fontFamily: "var(--font-mono)", color: scoreColor(r.top) }}>{r.top}</span>
                <span className="hidden sm:block text-right">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                    style={r.status === "Open" ? { background: "var(--mint)", color: "var(--forest)" } : { background: "#fff8e6", color: "#92620f" }}
                  >
                    {r.status}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Example analysis - a full report on three very different roles ───── */

function AnalysisExampleSection() {
  return (
    <section id="example" className="max-w-[1100px] mx-auto px-6 py-24">
      <Reveal>
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>See a real analysis</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Not just a score — the reasons behind it
          </h2>
          <p className="text-[15px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink-soft)" }}>
            Every candidate gets a report like this: how they meet each requirement, the line in their CV that proves it,
            what still needs checking, and what to ask at interview. Warehouse floor or boardroom.
            Helixon helps you decide &mdash; the final call is always yours.
          </p>
        </div>
      </Reveal>
      <Reveal>
        <AnalysisExample />
      </Reveal>
    </section>
  );
}

/* ── Pricing plan buy button: starts a Stripe checkout, then redirects ── */
function BuyPlanButton({ plan, label, highlight }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setLoading(true);
    const result = await startCheckout(plan);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    window.location.assign(result.redirectTo);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-busy={loading}
        className="text-center text-sm font-semibold py-3 rounded-[10px] transition-all w-full min-h-[44px]"
        style={{
          background: highlight ? "white" : "var(--forest)",
          color: highlight ? "var(--forest)" : "white",
          opacity: loading ? 0.75 : 1,
          cursor: loading ? "wait" : "pointer",
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
function CtaButtons({ secondaryLabel, secondaryHref, align = "left", signedIn = false }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 w-full sm:w-auto ${align === "center" ? "justify-center items-center" : ""}`}>
      <Button as="a" href={signedIn ? "/dashboard" : "/demo"} variant="primary" className="w-full sm:w-auto min-h-[48px]">
        {signedIn ? "Go to dashboard" : "Get a demo"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
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
    <div className="rounded-[16px] p-7 h-full" style={{ background: "white", border: "1px solid var(--border)" }}>
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
        <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-faint)" }}>PDF or Word (.docx)</p>
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
        <li className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}><span style={{ color: "var(--score-mid)" }} aria-hidden="true">△</span>2-month notice period</li>
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
  const { tabProps, panelProps } = useRovingTabs({
    idPrefix: "workflow",
    count: WORKFLOW_TABS.length,
    active: activeTab,
    onChange: setActiveTab,
  });

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
                {...tabProps(i)}
                className="text-xs font-semibold px-3.5 py-2 rounded-t-[8px] whitespace-nowrap transition-colors min-h-[40px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                style={{
                  color: activeTab === i ? "var(--forest)" : "var(--ink-soft)",
                  background: activeTab === i ? "var(--mist)" : "transparent",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div key={activeTab} {...panelProps} className="p-6 fade-up-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px]" style={{ background: "var(--mist)", minHeight: "260px" }}>
            <TabContent />
          </div>
        </div>
      </Reveal>
      </div>
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
  const phase = useScrollEntrance(containerRef);

  const total = BULK_PREVIEW_ROWS.length;
  // Starts at the settled state so the server render (and any no-JS
  // visitor) sees a populated queue rather than five "Queued" rows; one
  // more row completes once the card is scrolled to.
  const [doneCount, setDoneCount] = useState(2);

  useEffect(() => {
    if (phase !== "entered") return undefined;
    const t = setTimeout(() => setDoneCount(3), 1400);
    return () => clearTimeout(t);
  }, [phase]);

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
        <div className="rounded-[14px] p-6 text-center h-full" style={{ background: "white", border: "1px solid var(--border)" }}>
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
  "Time to fill, offer acceptance, source of hire and fee income — real agency analytics, not just a candidate list",
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
          <Button as="a" href="/demo" variant="outline" className="min-h-[44px]">Get a demo</Button>
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
    items: ["Bulk CV upload against one role", "PDF and Word CVs, tables and columns included", "Fast, consistent parsing"],
  },
  {
    title: "Make better screening decisions",
    body: "See more than a score \u2014 see the reasoning behind it.",
    items: ["Match scoring against the role", "Standout factors", "Possible red flags", "Bias-aware scoring"],
  },
  {
    title: "Stay compliant",
    body: "Built for candidate data from the ground up.",
    items: ["Data stored in Switzerland", "Encryption at rest & in transit", "Full audit trail", "GDPR-ready workflow"],
  },
];

function FeatureGroups() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {FEATURE_GROUPS.map((g) => (
        <div key={g.title} className="rounded-[14px] p-7" style={{ background: "white", border: "1px solid var(--border)" }}>
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

/* ── Trust / GDPR - a dedicated, weightier section since candidates' data is involved ── */

const TRUST_PILLARS = [
  { title: "European data storage", body: "Candidate data is stored in Switzerland, which the UK and EU recognise as adequate. AI analysis uses providers bound by UK and EU transfer safeguards." },
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
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.8)" }}>Trust & compliance</p>
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
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <div className="text-center">
          <a href="/dpa" className="inline-flex items-center min-h-[44px] text-sm font-medium hover:underline" style={{ color: "rgba(255,255,255,0.9)" }}>Read our Data Processing Agreement →</a>
        </div>
      </div>
    </section>
  );
}

/* ── Pricing plans - a "get a demo" tile plus the two paid plans. What each
   plan includes comes from lib/plan-features, shared with /pricing. ── */

const PLANS = [
  {
    name: "Not sure yet?", price: "Demo", period: "on your own CVs",
    features: ["Full platform walkthrough", "Run it on your own CVs and roles", "No obligation"],
    cta: "Get a demo", highlight: false, action: "demo",
  },
  {
    name: "Individual", price: "£249", period: "/ month",
    features: PLAN_FEATURES.individual,
    cta: "Buy Individual", highlight: false, plan: "individual",
  },
  {
    name: "Agency", price: "£349", period: "/ month",
    features: PLAN_FEATURES.agency,
    cta: "Buy Agency", highlight: true, plan: "agency",
  },
];

/* ── FAQ - reordered around actual buying objections ──────────────────────── */

const FAQS = [
  { q: "How does Helixon score candidates?", a: "Each CV is compared against the job description you provide \u2014 skills, experience, seniority and role fit \u2014 to produce a single match score, alongside the standout factors and possible red flags behind it." },
  { q: "Does Helixon replace recruiter judgement?", a: "No. Helixon surfaces the score, standout factors and possible red flags so you can review candidates faster. The final call on who to interview or hire is always yours." },
  { q: "Can I upload multiple CVs for one role?", a: "Yes. Drop in up to 50 CVs against a single role at once and come back to a ranked, sortable shortlist instead of dozens of separate files." },
  { q: "What happens to candidate data?", a: "It's stored in Switzerland, which the UK and EU recognise as adequate, encrypted at rest and in transit, and never used to train any model. See our Data Processing Agreement for full detail." },
  { q: "Can my recruiting team collaborate?", a: "Yes, on the Agency plan, for up to 5 people. Shortlists, notes and tags are shared across your team, with a full audit trail of who screened what." },
  { q: "How much does Helixon cost?", a: "Individual is \u00a3249 a month and Agency is \u00a3349 a month, both with unlimited screening. If you're not sure which fits your team, book a demo and we'll walk you through it." },
  { q: "Can I cancel anytime?", a: "Yes. Individual and Agency plans are billed monthly with no long-term contract. Cancel from your account settings and you'll keep access until the end of the billing period." },
];

function FaqItem({ id, q, a, open, onToggle }) {
  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      <button
        type="button"
        id={`${id}-q`}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-a`}
        className="w-full flex items-center justify-between gap-4 py-4 text-left min-h-[44px]"
      >
        <span className="text-[15px] font-medium" style={{ color: "var(--ink)" }}>{q}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round"
          aria-hidden="true"
          className="shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        inert={!open}
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: open ? "400px" : "0px", opacity: open ? 1 : 0 }}
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
          id={`faq-${i}`}
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
  { val: null, display: "Swiss-hosted", label: "Encrypted, GDPR-ready, never used for training" },
];

function TrustStrip() {
  const ref = useRef(null);
  const played = useScrollEntrance(ref, { offset: "20%" }) !== "armed";

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
    <div className="min-h-screen" style={{ background: "var(--mist)" }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MarketingNav active="home" />

      <main id="main-content">

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <span
                className="fade-up-in inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full mb-6"
                style={{ background: "var(--mint)", color: "var(--forest)", "--stagger-delay": "0ms" }}
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
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
                <CtaButtons secondaryLabel="See an example analysis" secondaryHref="#example" signedIn={signedIn} />
              </div>

              {!signedIn && (
                <p className="fade-up-in text-[13px] mt-4" style={{ color: "var(--ink-faint)", "--stagger-delay": "280ms" }}>
                  See it on your own CVs, no obligation. Plans from &pound;249 a month.
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

        {/* ── Example analysis report ─────────────────────────────────────── */}
        <AnalysisExampleSection />

        {/* ── Bulk screening ───────────────────────────────────────────────── */}
        <BulkScreeningSection />

        {/* ── Dashboard (the manage-the-desk half of the product) ──────────── */}
        <DashboardSection />

        {/* ── Agency workflow ──────────────────────────────────────────────── */}
        <AgencyWorkflowSection />

        {/* ── Trust / GDPR ─────────────────────────────────────────────────── */}
        <TrustSection />

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[900px] mx-auto items-stretch">
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
                      style={{ background: "var(--mint)", color: "var(--forest)", border: "1px solid var(--forest)" }}
                    >
                      Recommended for agencies
                    </span>
                  )}
                  <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }}>
                    {plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1.5 mb-6">
                    <span className="text-[2.25rem] font-semibold leading-none" style={{ fontFamily: "var(--font-mono)", color: plan.highlight ? "white" : "var(--ink)" }}>{plan.price}</span>
                    <span className="text-[13px]" style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }}>{plan.period}</span>
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

      </main>

      <MarketingFooter />
      <ChatWidget />
    </div>
  );
}