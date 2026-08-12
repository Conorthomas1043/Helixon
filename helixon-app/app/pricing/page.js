"use client";
import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Helixon pricing page. Reuses the landing page's nav, footer, and design
// tokens (--forest, --mint, --mist, --border, --signal, --font-display,
// --font-mono) so this reads as the same product, not a separate page.
// Prices match the landing page exactly: Free / Solo £149 / Team £349.
// ═══════════════════════════════════════════════════════════════════════════

const PLANS = [
  {
    name: "Free",
    blurb: "Try Helixon on a real role before you commit.",
    monthly: 0,
    annual: 0,
    cta: "Try it free",
    href: "/",
    highlight: false,
    features: [
      "3 free analyses",
      "Match score & summary",
      "Red flag detection",
      "Email drafting",
    ],
  },
  {
    name: "Solo",
    blurb: "For a single recruiter screening every day.",
    monthly: 149,
    annual: 119,
    cta: "Buy Solo",
    href: "YOUR-SOLO-STRIPE-LINK",
    highlight: true,
    features: [
      "Unlimited analyses",
      "Bulk upload",
      "Shortlists & history",
      "Custom job presets",
      "Priority support",
    ],
  },
  {
    name: "Team",
    blurb: "For agencies hiring across multiple desks.",
    monthly: 349,
    annual: 279,
    cta: "Buy Team",
    href: "YOUR-TEAM-STRIPE-LINK",
    highlight: false,
    features: [
      "Everything in Solo",
      "Multi-seat access (5 seats)",
      "Shared templates",
      "Team analytics dashboard",
      "Dedicated onboarding",
    ],
  },
];

const FAQS = [
  {
    q: "How does the free plan work?",
    a: "You get 3 analyses at no cost and no card required. Once you need a 4th, upgrade to Solo or Team — your history carries over.",
  },
  {
    q: "What counts as an analysis?",
    a: "One analysis is one CV scored against one job description. Re-scoring the same CV against a different role counts as a second analysis.",
  },
  {
    q: "Can I switch between Solo and Team?",
    a: "Yes, anytime. Upgrades apply immediately and you're billed the prorated difference. Downgrades take effect at your next billing date.",
  },
  {
    q: "Is my data used to train Helixon's models?",
    a: "No. All data is hosted in the EU and is never used for model training, in line with our GDPR commitments.",
  },
];

function CheckIcon({ light }) {
  return (
    <span className="shrink-0 mt-0.5" style={{ color: light ? "rgba(255,255,255,0.9)" : "var(--forest)" }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 12.75l6 6 9-13.5" />
      </svg>
    </span>
  );
}

function PlanCard({ plan, annual }) {
  const price = annual ? plan.annual : plan.monthly;

  return (
    <div
      className="rounded-[16px] p-7 flex flex-col relative"
      style={{
        background: plan.highlight ? "var(--forest)" : "white",
        border: plan.highlight ? "1px solid var(--forest)" : "1px solid var(--border)",
        boxShadow: plan.highlight ? "0 16px 32px -14px rgba(11,110,79,0.5)" : "none",
      }}
    >
      {plan.highlight && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-bold px-2.5 py-1 rounded-full tracking-wide"
          style={{ background: "var(--signal, #f59e0b)", color: "#13201b" }}
        >
          MOST POPULAR
        </span>
      )}

      <h3
        className="text-xs font-semibold uppercase tracking-wide mb-1"
        style={{ color: plan.highlight ? "rgba(255,255,255,0.8)" : "#8aaa9a" }}
      >
        {plan.name}
      </h3>
      <p
        className="text-xs leading-relaxed mb-5"
        style={{ color: plan.highlight ? "rgba(255,255,255,0.7)" : "#5a7a6a" }}
      >
        {plan.blurb}
      </p>

      <div className="flex items-baseline gap-1 mb-1">
        <span
          className="text-3xl font-semibold"
          style={{ fontFamily: "var(--font-mono)", color: plan.highlight ? "white" : "#13201b" }}
        >
          £{price}
        </span>
        <span className="text-[11px]" style={{ color: plan.highlight ? "rgba(255,255,255,0.7)" : "#8aaa9a" }}>
          {plan.name === "Free" ? "forever" : "/ month"}
        </span>
      </div>
      <p className="text-[10px] mb-5" style={{ color: plan.highlight ? "rgba(255,255,255,0.55)" : "#8aaa9a" }}>
        {plan.name !== "Free" && annual ? `Billed annually · £${plan.monthly}/mo billed monthly` : "\u00A0"}
      </p>

      <a
        href={plan.href}
        className="text-center text-xs font-semibold py-3 rounded-[10px] transition-transform hover:scale-[1.01]"
        style={{
          background: plan.highlight ? "white" : "var(--forest)",
          color: plan.highlight ? "var(--forest)" : "white",
        }}
      >
        {plan.cta}
      </a>

      <ul className="space-y-2.5 mt-7">
        {plan.features.map((f) => (
          <li
            key={f}
            className="flex items-start gap-2 text-xs"
            style={{ color: plan.highlight ? "rgba(255,255,255,0.92)" : "#5a7a6a" }}
          >
            <CheckIcon light={plan.highlight} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="border-b py-5" style={{ borderColor: "var(--border)" }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 text-left focus:outline-none"
      >
        <span className="text-xs font-semibold" style={{ color: "#13201b" }}>{item.q}</span>
        <svg
          className="shrink-0 transition-transform"
          style={{ transform: open ? "rotate(45deg)" : "none", color: "#8aaa9a" }}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
        >
          <path d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </button>
      {open && (
        <p className="text-xs leading-relaxed mt-3 pr-8" style={{ color: "#5a7a6a" }}>{item.a}</p>
      )}
    </div>
  );
}

export default function PricingPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>

      {/* ── Nav — identical to landing page ────────────────────────────── */}
      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
              <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "#8aaa9a" }}>Screen candidates in seconds</span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-1 text-xs font-medium" style={{ color: "#5a7a6a" }}>
            <a href="/#how" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>How it works</a>
            <a href="/pricing" className="px-3 py-1.5 rounded-[8px] transition-colors" style={{ color: "#13201b", background: "var(--mint)" }}>Pricing</a>
            <a href="/login" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>Login</a>
          </div>

          <div className="flex items-center gap-2">
            <a href="/" className="text-xs font-semibold px-4 py-1.5 rounded-[10px] transition-colors text-white hidden sm:block" style={{ background: "var(--forest)" }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--forest-deep)"} onMouseLeave={e => e.currentTarget.style.background = "var(--forest)"}>
              Try now
            </a>
            <button type="button" onClick={() => setMobileNavOpen(v => !v)} aria-expanded={mobileNavOpen} aria-label="Open menu"
              className="sm:hidden w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ color: "#13201b" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileNavOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
              </svg>
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="sm:hidden border-t px-4 py-3 flex flex-col gap-0.5 bg-white" style={{ borderColor: "var(--border)" }}>
            {[["How it works", "/#how"], ["Pricing", "/pricing"], ["Login", "/login"]].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-2.5 rounded-[8px]" style={{ color: "#5a7a6a" }}>{label}</a>
            ))}
            <a href="/" onClick={() => setMobileNavOpen(false)} className="text-xs font-semibold px-2.5 py-2.5 rounded-[10px] mt-1 text-white text-center" style={{ background: "var(--forest)" }}>Try now</a>
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-10 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#8aaa9a" }}>Pricing</p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-4" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Plans that pay for themselves<br className="hidden sm:block" /> in one placement
        </h1>
        <p className="text-sm max-w-md mx-auto" style={{ color: "#5a7a6a" }}>
          Start free with 3 analyses. Upgrade the moment you need more — cancel anytime, no lock-in.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-1 rounded-full p-1 mt-8" style={{ background: "white", border: "1px solid var(--border)" }}>
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className="px-4 py-1.5 rounded-full text-xs font-semibold transition"
            style={{ background: !annual ? "var(--mint)" : "transparent", color: !annual ? "var(--forest)" : "#8aaa9a" }}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className="px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5"
            style={{ background: annual ? "var(--mint)" : "transparent", color: annual ? "var(--forest)" : "#8aaa9a" }}
          >
            Annual
            <span className="text-[10px] font-bold" style={{ color: "var(--forest)" }}>Save 20%</span>
          </button>
        </div>
      </section>

      {/* ── Plans ───────────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} annual={annual} />
          ))}
        </div>
        <p className="text-center text-[11px] mt-6" style={{ color: "#8aaa9a" }}>
          All prices in GBP, exclusive of VAT. Need more than 5 seats? <a href="/contact" style={{ color: "var(--forest)", fontWeight: 600 }}>Talk to us</a> about Enterprise.
        </p>
      </section>

      {/* ── Trust strip — reused from landing page ─────────────────────── */}
      <section className="border-y" style={{ borderColor: "var(--border)", background: "white" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { val: "30 sec", label: "Avg. time to score" },
            { val: "50+", label: "CVs screened per agency/wk" },
            { val: "GDPR", label: "EU-hosted, never used to train" },
            { val: "4.8/5", label: "Recruiter satisfaction" },
          ].map((m) => (
            <div key={m.label}>
              <p className="text-xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--forest)" }}>{m.val}</p>
              <p className="text-[10px] mt-1" style={{ color: "#8aaa9a" }}>{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section className="max-w-xl mx-auto px-6 py-20">
        <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Questions, answered
        </h2>
        <p className="text-xs mb-6" style={{ color: "#5a7a6a" }}>
          Can't find what you're looking for? <a href="/contact" style={{ color: "var(--forest)", fontWeight: 600 }}>Contact us</a>.
        </p>
        <div>
          {FAQS.map((item, i) => (
            <FaqItem
              key={item.q}
              item={item}
              open={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
            />
          ))}
        </div>
      </section>

      {/* ── Final CTA — matches landing page ──────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-24">
        <div className="rounded-[20px] px-8 py-14 text-center" style={{ background: "var(--forest)" }}>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3 text-white" style={{ fontFamily: "var(--font-display)" }}>
            Your next great hire is in that pile of CVs.
          </h2>
          <p className="text-xs mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.75)" }}>
            Find them in seconds, not hours. Try Helixon free — no card needed.
          </p>
          <div className="flex justify-center">
            <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-[10px] transition-transform hover:scale-[1.02]" style={{ background: "white", color: "var(--forest)" }}>
              Try it now — it&apos;s free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer — identical to landing page ─────────────────────────── */}
      <footer className="border-t" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px]" style={{ color: "#8aaa9a" }}>© {new Date().getFullYear()} Helixon. Screen candidates in seconds.</span>
          <div className="flex gap-4 text-[11px]" style={{ color: "#8aaa9a" }}>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/login">Login</a>
          </div>
        </div>
      </footer>
    </main>
  );
}