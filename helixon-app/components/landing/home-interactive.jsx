"use client";
// The smaller interactive parts of the homepage: scroll reveals, the
// dashboard preview, the FAQ accordion, the buy buttons and the hero copy
// that greets a signed-in visitor. The hero demo and the scroll story have
// their own files (HeroDemo, ScrollStory). app/page.js renders everything
// else on the server, so the static sections ship no JS.
import { useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import Button from "@/components/landing/Button";
import CountUp from "@/components/dashboard/CountUp";
import useScrollEntrance from "@/lib/hooks/useScrollEntrance";
import { startCheckout } from "@/lib/billing/start-checkout";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/* ── Scroll reveal ────────────────────────────────────────────────────────
   Content is visible by default; see lib/hooks/useScrollEntrance for when
   (and why only then) it is switched to its hidden starting frame. */

export function Reveal({ children, className = "", delay = 0 }) {
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
  warn: { bg: "var(--ui-warn-soft)", fg: "var(--ui-warn)" },
  neutral: { bg: "var(--mist)", fg: "var(--ink-soft)" },
};

export function DashboardPreview() {
  const containerRef = useRef(null);
  // Latched: once played it stays at its final state, so the counters never
  // rewind when the card scrolls back out of view.
  const live = useScrollEntrance(containerRef, { offset: "20%" }) !== "armed";

  const maxStage = Math.max(...DASH_STAGES.map((s) => s.count));

  return (
    <div
      ref={containerRef}
      className="rounded-2xl overflow-hidden w-full"
      style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 24px 48px -24px rgba(19,32,27,0.22)" }}
      aria-label="Example Helixon dashboard showing pipeline metrics for one agency"
    >
      {/* Window chrome, so it reads as a product screenshot rather than a widget */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-b-[var(--border-soft)] bg-[var(--mist)]" aria-hidden="true">
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--border)]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--border)]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[var(--border)]" />
        <span className="ml-2 text-11 text-[var(--ink-faint)]">Dashboard</span>
      </div>

      <div className="p-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
          {DASH_KPIS.map((k, i) => (
            <div
              key={k.label}
              className="rounded-btn p-3 border border-[var(--border)] bg-[var(--bg)]"
            >
              <p className="text-11 font-semibold uppercase tracking-widest mb-1.5 text-[var(--ink-faint)]">{k.label}</p>
              <p
                className={`text-xl font-semibold tabular-nums leading-none font-mono ${k.accent ? "text-[var(--forest)]" : "text-[var(--ink)]"}`}
              >
                <CountUp value={live ? k.value : 0} duration={900 + i * 120} />
              </p>
              {typeof k.meter === "number" && (
                <div className="h-[3px] rounded-full mt-2 overflow-hidden bg-[var(--border-soft)]">
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
              <p className="text-11 mt-1.5 text-[var(--ink-faint)]">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Stacked at every width: beside the attention list, the five stage
            columns were ~44px wide and their labels ran together. */}
        <div className="grid grid-cols-1 gap-5">
          {/* Pipeline snapshot */}
          <div>
            <p className="text-11 font-semibold uppercase tracking-widest mb-3 text-[var(--ink-faint)]">Where candidates stand</p>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
              {DASH_STAGES.map((s, i) => (
                <div key={s.label} className="flex flex-col items-center min-w-0">
                  <span className="text-13 font-semibold tabular-nums leading-none font-mono text-[var(--ink)]">
                    <CountUp value={live ? s.count : 0} duration={900} />
                  </span>
                  <div className="w-full flex items-end rounded-sm overflow-hidden mt-2 mb-1.5 h-[44px] bg-[var(--border-soft)]">
                    <div
                      className="w-full rounded-b-sm"
                      style={{
                        height: live ? `${Math.max(10, (s.count / maxStage) * 100)}%` : 0,
                        background: i === DASH_STAGES.length - 1 ? "var(--forest)" : "var(--chart-muted)",
                        transition: `height 0.8s ${EASE} ${i * 90}ms`,
                      }}
                    />
                  </div>
                  {/* Sentence case, not uppercase: at this size uppercase is
                      both wider (these five labels collided at 1440px) and
                      harder to read. */}
                  <span className="text-11 font-medium text-center leading-tight tracking-tight text-[var(--ink-faint)]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Needs attention */}
          <div>
            <p className="text-11 font-semibold uppercase tracking-widest mb-3 text-[var(--ink-faint)]">Needs your attention</p>
            <ul className="space-y-1.5">
              {DASH_ATTENTION.map((a, i) => (
                <li
                  key={a.name}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                  style={{
                    background: "var(--mist)",
                    opacity: live ? 1 : 0,
                    transform: live ? "translateY(0)" : "translateY(6px)",
                    transition: `opacity 0.5s ${EASE} ${400 + i * 110}ms, transform 0.5s ${EASE} ${400 + i * 110}ms`,
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-11 font-semibold truncate text-[var(--ink)]">{a.name}</span>
                    <span className="block text-11 truncate text-[var(--ink-faint)]">{a.role}</span>
                  </span>
                  <span
                    className="text-11 font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
                    style={{ background: DASH_TONES[a.tone].bg, color: DASH_TONES[a.tone].fg }}
                  >
                    {a.reason}
                  </span>
                  <span className="text-11 font-semibold tabular-nums shrink-0 w-5 text-right" style={{ fontFamily: "var(--font-mono)", color: scoreColor(a.score) }}>
                    {a.score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Open roles - the jobs list the real dashboard leads with */}
        <div className="mt-5">
          <p className="text-11 font-semibold uppercase tracking-widest mb-2 text-[var(--ink-faint)]">Open roles</p>
          <div className="rounded-btn overflow-hidden border border-[var(--border)]">
            <div className="grid grid-cols-[1fr_auto_auto] sm:grid-cols-[1fr_80px_64px_92px] gap-3 px-3 py-2 text-11 font-semibold uppercase tracking-wide bg-[var(--mist)] text-[var(--ink-faint)]">
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
                  <span className="block text-11 font-semibold truncate text-[var(--ink)]">{r.title}</span>
                  <span className="block text-11 truncate text-[var(--ink-faint)]">{r.client}</span>
                </span>
                <span className="text-11 tabular-nums text-right font-mono text-[var(--ink-soft)]">{r.candidates}</span>
                <span className="text-11 font-semibold tabular-nums text-right" style={{ fontFamily: "var(--font-mono)", color: scoreColor(r.top) }}>{r.top}</span>
                <span className="hidden sm:block text-right">
                  <span
                    className="text-11 font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                    style={r.status === "Open" ? { background: "var(--mint)", color: "var(--forest)" } : { background: "var(--ui-warn-soft)", color: "var(--ui-warn)" }}
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

/* ── Pricing plan buy button: starts a Stripe checkout, then redirects ── */
export function BuyPlanButton({ plan, label, highlight }) {
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
        className="text-center text-sm font-semibold py-3 rounded-btn transition-all w-full min-h-[44px]"
        style={{
          background: highlight ? "white" : "var(--forest)",
          color: highlight ? "var(--brand-surface)" : "var(--on-accent)",
          opacity: loading ? 0.75 : 1,
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Redirecting…" : label}
      </button>
      {error && (
        <p role="alert" aria-live="polite" className={`text-11 text-center ${highlight ? "text-[var(--ui-danger-soft)]" : "text-[var(--score-low)]"}`}>
          {error}
        </p>
      )}
    </div>
  );
}

/* ── Reusable CTA pair - label/target vary by context, never more than two ──
   When signed in, the primary CTA takes the visitor straight to their
   dashboard instead of pitching a demo they've already bought. */
export function CtaButtons({ secondaryLabel, secondaryHref, align = "left", signedIn = false }) {
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

function FaqItem({ id, q, a, open, onToggle }) {
  return (
    <div className="border-b border-[var(--border)]">
      <button
        type="button"
        id={`${id}-q`}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-a`}
        className="w-full flex items-center justify-between gap-4 py-4 text-left min-h-[44px]"
      >
        <span className="text-15 font-medium text-[var(--ink)]">{q}</span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round"
          aria-hidden="true"
          className="shrink-0 transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {/* Opens by animating the row from 0fr to 1fr, so the answer gets its
          full height however large the text is set. */}
      <div
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <p className="text-sm leading-relaxed pb-5 pr-8 text-[var(--ink-soft)]">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function FAQSection({ faqs }) {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <div className="max-w-2xl mx-auto">
      {faqs.map((f, i) => (
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

export function TrustStrip() {
  const ref = useRef(null);
  const played = useScrollEntrance(ref, { offset: "20%" }) !== "armed";

  return (
    <section className="border-y" style={{ borderColor: "var(--border-soft, var(--border))", background: "var(--bg)" }}>
      <div ref={ref} className="max-w-[1100px] mx-auto px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
        {TRUST_METRICS.map((m) => (
          <div key={m.label}>
            {/* One face for all three, so the figure and the worded metrics
                read as a set. Ink, not brand green: green marks what can be
                clicked. */}
            <p className="text-2xl font-semibold tabular-nums font-display text-[var(--ink)]">
              {typeof m.val === "number" ? <CountUp value={played ? m.val : 0} duration={1000} /> : m.display}
            </p>
            <p className="text-13 mt-1.5 leading-relaxed max-w-[15rem] mx-auto text-[var(--ink-faint)]">{m.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}


/* ── Hero copy that changes for a signed-in visitor. Everything else in
   the hero (the headline, the layout) is rendered on the server. ── */

function useSignedIn() {
  const { isLoaded, isSignedIn, user } = useUser();
  return { signedIn: isLoaded && isSignedIn, firstName: user?.firstName };
}

export function HeroBadge() {
  const { signedIn, firstName } = useSignedIn();
  return signedIn ? `Welcome back${firstName ? `, ${firstName}` : ""}` : "AI screening built for agency recruiters";
}

export function HeroSubtitle() {
  const { signedIn } = useSignedIn();
  return signedIn
    ? "Your dashboard is ready when you are — pick up where you left off and keep screening against your open roles."
    : "Helixon scores every CV against your job spec, flags what deserves a second look, and hands back a ranked shortlist. Your team spends its hours on candidates instead of triage.";
}

export function HeroActions() {
  const { signedIn } = useSignedIn();
  return (
    <>
      <div className="fade-up-in" style={{ "--stagger-delay": "210ms" }}>
        <CtaButtons secondaryLabel="See an example analysis" secondaryHref="#example" signedIn={signedIn} />
      </div>
      {!signedIn && (
        <p className="fade-up-in text-13 mt-4" style={{ color: "var(--ink-faint)", "--stagger-delay": "280ms" }}>
          See it on your own CVs, no obligation. Plans from &pound;249 a month.
        </p>
      )}
    </>
  );
}
