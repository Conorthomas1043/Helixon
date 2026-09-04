"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CookieConsentBanner from "../components/CookieConsentBanner";
import Button from "@/components/landing/Button";
import ChatWidget from "@/components/landing/ChatWidget";

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
  const animate = pageVisible && inView && !reducedMotion;

  const [revealedCount, setRevealedCount] = useState(reducedMotion ? WORKSPACE_CANDIDATES.length : 0);
  const [breakdownVisible, setBreakdownVisible] = useState(reducedMotion);

  useEffect(() => {
    if (!animate) return;
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
        <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "var(--mint)", color: "var(--forest)" }}>Example role</span>
      </div>
      <p className="text-[10px] mb-4" style={{ color: "var(--ink-faint)" }}>{WORKSPACE_CANDIDATES.length} candidates analysed</p>

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
                opacity: shown ? 1 : 0,
                transform: shown ? "translateY(0)" : "translateY(4px)",
              }}
            >
              <span className="text-[11px] font-medium truncate" style={{ color: "var(--ink)" }}>{c.name}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] font-semibold" style={{ color: scoreColor(c.score) }}>{scoreLabel(c.score)}</span>
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
          opacity: breakdownVisible ? 1 : 0,
          transform: breakdownVisible ? "translateY(0)" : "translateY(4px)",
        }}
      >
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Strongest match</span>
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

/* ── Reusable CTA pair - label/target vary by context, never more than two ── */
function CtaButtons({ secondaryLabel = "See how it works", secondaryHref = "#how", align = "left" }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 w-full sm:w-auto ${align === "center" ? "justify-center items-center" : ""}`}>
      <Button as="a" href="/demo" variant="primary" className="w-full sm:w-auto min-h-[48px]">
        Get a demo
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Button>
      <Button as="a" href={secondaryHref} variant="outline" className="w-full sm:w-auto min-h-[48px]">
        {secondaryLabel}
      </Button>
    </div>
  );
}

/* ── Pain / before-after: two workflows, side by side ────────────────────── */

const MANUAL_STEPS = ["Open the CV", "Read it top to bottom", "Open the job description", "Compare by eye", "Note it down somewhere", "Decide", "Repeat, 50 times"];
const HELIXON_STEPS = ["Upload the CVs", "Helixon analyses each one", "Candidates are ranked", "Review the strongest matches", "Shortlist and move on"];

function TimelineColumn({ label, steps, tone }) {
  const accent = tone === "forest" ? "var(--forest)" : "var(--ink-mute)";
  return (
    <div className="rounded-[16px] p-6 h-full" style={{ background: "white", border: "1px solid var(--border)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-5" style={{ color: tone === "forest" ? "var(--forest)" : "var(--ink-faint)" }}>{label}</p>
      <ol className="relative pl-5">
        <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px" style={{ background: "var(--border)" }} aria-hidden="true" />
        {steps.map((step) => (
          <li key={step} className="relative pb-5 last:pb-0">
            <span className="absolute -left-5 top-0.5 w-3.5 h-3.5 rounded-full" style={{ background: tone === "forest" ? accent : "white", border: `2px solid ${accent}` }} aria-hidden="true" />
            <span className="text-xs" style={{ color: "var(--ink)" }}>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BeforeAfterSection() {
  return (
    <section className="max-w-[1100px] mx-auto px-6 py-20">
      <Reveal>
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Your candidates shouldn&apos;t be waiting on a spreadsheet.
          </h2>
          <p className="text-xs max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
            Most agencies still screen the same way they did ten years ago - one CV, one tab, one spreadsheet at a time.
          </p>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Reveal><TimelineColumn label="The manual way" steps={MANUAL_STEPS} tone="muted" /></Reveal>
        <Reveal delay={80}><TimelineColumn label="With Helixon" steps={HELIXON_STEPS} tone="forest" /></Reveal>
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
        <p className="text-[10px] mt-0.5" style={{ color: "var(--ink-faint)" }}>PDF or Word, scanned or typed</p>
      </div>
      <div className="space-y-1.5">
        {files.map((f) => (
          <div key={f} className="flex items-center gap-2 text-[11px] px-3 py-2 rounded-[8px]" style={{ background: "var(--mist)", color: "var(--ink-soft)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
            {f}
          </div>
        ))}
        <p className="text-[10px] text-right" style={{ color: "var(--ink-faint)" }}>+ 9 more</p>
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
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>Strong</p>
      <ul className="space-y-1 mb-4">
        {["5 years' React experience", "TypeScript", "SaaS product experience"].map((s) => (
          <li key={s} className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ink-soft)" }}><span style={{ color: "var(--forest)" }}>✓</span>{s}</li>
        ))}
      </ul>
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--ink-faint)" }}>Worth a second look</p>
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
            <span className="text-[9px] font-semibold" style={{ color: scoreColor(c.score) }}>{scoreLabel(c.score)}</span>
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
    <section id="how" className="max-w-[1100px] mx-auto px-6 py-20">
      <Reveal>
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            From CV to shortlist, without the spreadsheet
          </h2>
          <p className="text-xs max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
            One workflow, from the first CV to the candidate you call.
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
          <div className="p-6" style={{ background: "var(--mist)", minHeight: "260px" }}>
            <TabContent />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ── Built for recruiters - outcome pillars + the commercial "why" ───────── */

const BENEFIT_PILLARS = [
  { title: "Screen faster", body: "Stop reading every CV top to bottom - see the fit before you open the file.", icon: (<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />) },
  { title: "Prioritise instantly", body: "The strongest candidates rise to the top of every role automatically.", icon: (<path d="M12 2l3 6 6 .9-4.5 4.3 1 6-5.5-3-5.5 3 1-6L3 8.9 9 8z" />) },
  { title: "Decide consistently", body: "Every candidate is compared against the same role criteria, every time.", icon: (<><rect x="3" y="10" width="4" height="10" /><rect x="10" y="6" width="4" height="14" /><rect x="17" y="3" width="4" height="17" /></>) },
  { title: "Work as a team", body: "Notes, tags and shortlists stay in one place instead of scattered across email.", icon: (<><circle cx="9" cy="7" r="3" /><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" /><circle cx="19" cy="8" r="2.5" /></>) },
];

function BenefitsSection() {
  return (
    <section id="benefits" className="max-w-[1100px] mx-auto px-6 py-20">
      <Reveal>
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Helixon helps you decide. It doesn&apos;t decide for you.
          </h2>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {BENEFIT_PILLARS.map((b, i) => (
          <Reveal key={b.title} delay={i * 60}>
            <div className="rounded-[14px] p-6 h-full" style={{ background: "white", border: "1px solid var(--border)" }}>
              <span className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-4" style={{ background: "var(--mint)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{b.icon}</svg>
              </span>
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: "var(--ink)" }}>{b.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "var(--ink-soft)" }}>{b.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="rounded-[16px] p-8 text-center" style={{ background: "var(--mist)", border: "1px solid var(--border)" }}>
          <p className="text-sm sm:text-base font-medium leading-relaxed max-w-xl mx-auto" style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>
            Less time screening + more candidates reviewed + faster shortlists
            <br className="hidden sm:block" /> = more time for calls, sourcing and placements.
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/* ── Bulk screening - the volume story, told without invented numbers ────── */

function BulkScreeningSection() {
  const stages = [
    { label: "CVs in", detail: "Upload up to 50 at once, for one role" },
    { label: "Helixon analyses", detail: "Every CV compared against your job spec" },
    { label: "Ranked shortlist", detail: "Ready to review, no manual sorting" },
  ];

  const nodes = stages.flatMap((s, i) => {
    const items = [
      <Reveal key={`stage-${i}`} delay={i * 80}>
        <div className="rounded-[14px] p-6 text-center h-full" style={{ background: "white", border: "1px solid var(--border)" }}>
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold mb-3" style={{ background: "var(--mint)", color: "var(--forest)" }}>{i + 1}</span>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>{s.label}</p>
          <p className="text-[11px]" style={{ color: "var(--ink-soft)" }}>{s.detail}</p>
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
    <section className="max-w-[1100px] mx-auto px-6 py-20">
      <Reveal>
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            One role. Dozens of CVs. One ranked shortlist.
          </h2>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 max-w-3xl mx-auto items-center">
        {nodes}
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
    <section id="agency" className="max-w-[1100px] mx-auto px-6 py-20">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <Reveal>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-faint)" }}>For agencies</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Built for the way agency teams already work
          </h2>
          <p className="text-xs leading-relaxed mb-6 max-w-md" style={{ color: "var(--ink-soft)" }}>
            One recruiter screens, the whole team sees the result. Notes, tags and shortlists stay together - with a clear record of who screened what, and when.
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {["Shared shortlists", "Notes & tags", "Audit trail", "Multi-seat access"].map((chip) => (
              <span key={chip} className="text-[11px] font-medium px-3 py-1.5 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>{chip}</span>
            ))}
          </div>
          <Button as="a" href="/demo" variant="outline" className="min-h-[44px]">Book a demo</Button>
        </Reveal>

        <Reveal delay={80}>
          <div className="rounded-[16px] p-6" style={{ background: "white", border: "1px solid var(--border)" }}>
            <ol className="relative pl-6">
              <div className="absolute left-[9px] top-1.5 bottom-1.5 w-px" style={{ background: "var(--border)" }} aria-hidden="true" />
              {AGENCY_FLOW.map((step, i) => (
                <li key={`${step.role}-${i}`} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-6 top-0.5 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "var(--forest)" }} aria-hidden="true">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "white" }} />
                  </span>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "var(--forest)" }}>{step.role}</p>
                  <p className="text-xs" style={{ color: "var(--ink)" }}>{step.action}</p>
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
    body: "See more than a score - see why.",
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
        <div key={g.title} className="rounded-[14px] p-6" style={{ background: "white", border: "1px solid var(--border)" }}>
          <h3 className="text-sm font-semibold mb-1.5" style={{ color: "var(--ink)" }}>{g.title}</h3>
          <p className="text-xs mb-4" style={{ color: "var(--ink-soft)" }}>{g.body}</p>
          <ul className="space-y-2">
            {g.items.map((item) => (
              <li key={item} className="flex items-start gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
                <span className="shrink-0 mt-0.5" style={{ color: "var(--forest)" }}>✓</span>{item}
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
      {TESTIMONIALS.map((t) => (
        <figure key={t.name} className="rounded-[14px] p-6 flex flex-col" style={{ background: "white", border: "1px solid var(--border)" }}>
          <svg width="20" height="16" viewBox="0 0 20 16" fill="var(--mint)" className="mb-3" aria-hidden="true">
            <path d="M0 16V9.6C0 3.2 3.6 0 8.4 0v3.2c-2.4 0-4 1.6-4 4h4V16H0zm10.4 0V9.6c0-6.4 3.6-9.6 8.4-9.6v3.2c-2.4 0-4 1.6-4 4h4V16h-8.4z" />
          </svg>
          <blockquote className="text-xs leading-relaxed flex-1" style={{ color: "var(--ink-soft)" }}>
            &ldquo;{t.quote}&rdquo;
          </blockquote>
          <figcaption className="text-[11px] font-medium mt-4" style={{ color: "var(--ink-faint)" }}>{t.name}</figcaption>
        </figure>
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
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.65)" }}>Trust & compliance</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
              Candidate data, handled properly
            </h2>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {TRUST_PILLARS.map((p) => (
            <div key={p.title} className="rounded-[14px] p-5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
              <h3 className="text-xs font-semibold mb-1.5 text-white">{p.title}</h3>
              <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{p.body}</p>
            </div>
          ))}
        </div>
        <div className="text-center">
          <a href="/dpa" className="text-[11px] font-medium hover:underline" style={{ color: "rgba(255,255,255,0.75)" }}>Read our Data Processing Agreement →</a>
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
  { q: "How does Helixon score candidates?", a: "Each CV is compared against the job description you provide - skills, experience, seniority and role fit - to produce a single match score, plus the standout factors and possible red flags behind it." },
  { q: "Does Helixon replace recruiter judgement?", a: "No. Helixon surfaces the score, standout factors and possible red flags so you can review candidates faster - the final call on who to interview or hire is always yours." },
  { q: "Can I upload multiple CVs for one role?", a: "Yes. Drop in up to 50 CVs against a single role at once and come back to a ranked, sortable shortlist instead of dozens of separate files." },
  { q: "What happens to candidate data?", a: "It's hosted on EU infrastructure, encrypted at rest and in transit, and never used to train any model. See our Data Processing Agreement for full detail." },
  { q: "Can my recruiting team collaborate?", a: "Yes, on the Agency plan. Shortlists, notes and tags are shared across your team, with a full audit trail of who screened what." },
  { q: "How do I get pricing for my team?", a: "Book a demo and we'll walk through pricing tailored to your team size and hiring volume." },
  { q: "Can I cancel anytime?", a: "Yes - Individual and Agency plans are billed monthly with no long-term contract. Cancel from your account settings and you'll keep access until the end of the billing period." },
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
        <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>{q}</span>
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
        style={{ maxHeight: open ? "240px" : "0px", opacity: open ? 1 : 0 }}
      >
        <p className="text-xs leading-relaxed pb-4 pr-8" style={{ color: "var(--ink-soft)" }}>{a}</p>
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
const TRUST_METRICS = [
  { val: "< 1 min", label: "To screen a full CV batch" },
  { val: "50", label: "CVs per bulk upload" },
  { val: "EU", label: "GDPR-ready, EU-hosted infrastructure" },
];

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  const navLinks = [
    ["How it works", "#how"],
    ["For agencies", "#agency"],
    ["Features", "#features"],
    ["Pricing", "#pricing"],
    ["FAQ", "#faq"],
  ];

  return (
    <>
      <CookieConsentBanner />
      <main className="min-h-screen" style={{ background: "var(--mist)" }}>

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
                <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "var(--ink-faint)" }}>Built for recruitment agencies</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
              {navLinks.map(([label, href]) => (
                <a key={label} href={href} className="nav-link">{label}</a>
              ))}
              <Link href="/login" className="nav-link">Login</Link>
              <Link href="/signup" className="nav-link">Sign up</Link>
            </div>

            <div className="flex items-center gap-2">
              <Button
                as="a"
                href="/demo"
                variant="primary"
                size="sm"
                className="hidden md:inline-flex min-h-[36px]"
              >
                Get a demo
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
              {[...navLinks, ["Login", "/login"], ["Sign up", "/signup"]].map(([label, href]) => (
                href.startsWith("/") ? (
                  <Link key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-3 rounded-[8px] min-h-[44px] flex items-center" style={{ color: "var(--ink-soft)" }}>{label}</Link>
                ) : (
                  <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-3 rounded-[8px] min-h-[44px] flex items-center" style={{ color: "var(--ink-soft)" }}>{label}</a>
                )
              ))}
              <Button
                as="a"
                href="/demo"
                variant="primary"
                size="sm"
                onClick={() => setMobileNavOpen(false)}
                className="mt-1 min-h-[44px]"
              >
                Get a demo
              </Button>
            </div>
          )}
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "var(--mint)", color: "var(--forest)" }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
                AI screening built for recruiters
              </span>

              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Turn a pile of CVs into a ranked shortlist in minutes.
              </h1>

              <p className="text-sm leading-relaxed mb-8 max-w-md" style={{ color: "var(--ink-soft)" }}>
                Helixon reads each CV against your job spec, scores the fit, flags what&apos;s worth a second look, and hands you a ranked shortlist - not another folder of PDFs. Built for agency recruiters screening dozens of CVs a day.
              </p>

              <CtaButtons secondaryLabel="See how it works" secondaryHref="#how" />
            </div>

            <RecruiterWorkspaceDemo />
          </div>
        </section>

        {/* ── Trust strip ─────────────────────────────────────────────────── */}
        <section className="border-y" style={{ borderColor: "var(--border-soft, var(--border))", background: "white" }}>
          <div className="max-w-[1100px] mx-auto px-6 py-8 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {TRUST_METRICS.map((m) => (
              <div key={m.label}>
                <p className="text-xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--forest)" }}>{m.val}</p>
                <p className="text-[10px] mt-1" style={{ color: "var(--ink-faint)" }}>{m.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pain → before/after ─────────────────────────────────────────── */}
        <BeforeAfterSection />

        {/* ── Product workflow (interactive) ──────────────────────────────── */}
        <ProductWorkflowSection />

        {/* ── Built for recruiters + ROI ───────────────────────────────────── */}
        <BenefitsSection />

        {/* ── Bulk screening ───────────────────────────────────────────────── */}
        <BulkScreeningSection />

        {/* ── Agency workflow ──────────────────────────────────────────────── */}
        <AgencyWorkflowSection />

        {/* ── Features, grouped by outcome ─────────────────────────────────── */}
        <section id="features" className="max-w-[1100px] mx-auto px-6 py-20">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Built for the volume agency recruiters actually deal with
              </h2>
              <p className="text-xs max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
                Not a toy demo - the parts that matter when you&apos;re screening dozens of CVs a week.
              </p>
            </div>
          </Reveal>
          <Reveal><FeatureGroups /></Reveal>
        </section>

        {/* ── Testimonials ─────────────────────────────────────────────────── */}
        <section className="max-w-[1100px] mx-auto px-6 py-20">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Fewer hours screening. More time interviewing.
              </h2>
            </div>
          </Reveal>
          <Reveal><Testimonials /></Reveal>
        </section>

        {/* ── Trust / GDPR ─────────────────────────────────────────────────── */}
        <TrustSection />

        {/* ── Pricing / buy ───────────────────────────────────────────────── */}
        <section id="pricing" className="max-w-[1100px] mx-auto px-6 py-20">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-faint)" }}>Pricing</p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Plans built around how agencies actually screen
              </h2>
              <p className="text-xs max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>Book a demo to see it on your own CVs, or choose a plan below.</p>
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
                      className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{ background: "var(--signal, #f5a623)", color: "var(--forest)" }}
                    >
                      Recommended for agencies
                    </span>
                  )}
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
        <section id="faq" className="max-w-[1100px] mx-auto px-6 py-20">
          <Reveal>
            <div className="text-center mb-10">
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-faint)" }}>FAQ</p>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Questions recruiters usually ask
              </h2>
            </div>
          </Reveal>
          <Reveal><FAQSection /></Reveal>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────────── */}
        <section className="max-w-[1100px] mx-auto px-6 pb-24">
          <Reveal>
            <div className="rounded-[20px] px-8 py-14 text-center" style={{ background: "var(--forest)" }}>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3 text-white" style={{ fontFamily: "var(--font-display)" }}>
                Your next great hire is already in that pile of CVs.
              </h2>
              <p className="text-xs mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.75)" }}>
                Find them in minutes, not hours. Get a demo and we&apos;ll show you how.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                <Button
                  as="a"
                  href="/demo"
                  variant="onForest"
                  className="motion-safe-scale hover:scale-[1.02] min-h-[48px] w-full sm:w-auto"
                >
                  Get a demo
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </Button>
              </div>
            </div>
          </Reveal>
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
                Candidate screening built for recruitment agencies. GDPR-ready, EU-hosted.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>Product</p>
              <ul className="space-y-2 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                <li><a href="#how" className="hover:underline">How it works</a></li>
                <li><a href="#agency" className="hover:underline">For agencies</a></li>
                <li><a href="#features" className="hover:underline">Features</a></li>
                <li><a href="#pricing" className="hover:underline">Pricing</a></li>
                <li><a href="#faq" className="hover:underline">FAQ</a></li>
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
                <li><a href="/cookie-policy" className="hover:underline">Cookie Policy</a></li>
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