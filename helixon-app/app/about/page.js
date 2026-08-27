"use client";
import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Helixon - About page. Same tokens/nav/footer as the landing page so the
// jump between them is seamless. Signature element: a "before/after" desk
// strip showing the pile-of-CVs problem collapsing into a single score -
// the same visual idea as the product itself, told as an origin story.
// ═══════════════════════════════════════════════════════════════════════════

const VALUES = [
  {
    title: "Built for the inbox, not the demo",
    body: "Every decision - the score, the tone, the speed - is made for someone with 40 CVs and one coffee break, not a boardroom pitch.",
  },
  {
    title: "The recruiter stays the decision-maker",
    body: "Helixon narrows the pile and shows its working. It never rejects a candidate on your behalf - you always see the evidence behind a score.",
  },
  {
    title: "Candidate data is not the product",
    body: "CVs are processed to answer your question and nothing else. Held in the EU, never used to train models, deletable in one click.",
  },
];

const TIMELINE = [
  { year: "2024", label: "The problem", body: "Three recruiters at a 12-person agency were losing entire afternoons to first-pass CV screening - the same judgment call, made hundreds of times a week." },
  { year: "2025", label: "First scan", body: "The first working prototype scored a single CV against a single job spec in under a minute. It felt obvious in hindsight - which is usually a good sign." },
  { year: "2026", label: "Helixon today", body: "Now used by agency recruiters to screen, compare, and shortlist candidates - with every score explained, not just asserted." },
];

function CtaButtons({ align = "left" }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${align === "center" ? "justify-center items-center" : ""}`}>
      <a
        href="/"
        className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-[10px] text-white transition-all"
        style={{ background: "var(--forest)", boxShadow: "0 8px 20px -8px rgba(11,110,79,0.5)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--forest-deep)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}
      >
        Try it free
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </a>
      <a
        href="/pricing"
        className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-6 py-3.5 rounded-[10px] transition-all"
        style={{ border: "1.5px solid var(--border)", color: "#13201b" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        See plans &amp; buy
      </a>
    </div>
  );
}

// ── Signature element: pile of CVs collapsing into one score ────────────
function PileToScore() {
  return (
    <div
      className="rounded-[16px] p-6 w-full max-w-sm mx-auto lg:mx-0"
      style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 20px 40px -20px rgba(19,32,27,0.18)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-5" style={{ color: "#8aaa9a" }}>
        Monday morning, before &amp; after
      </p>

      <div className="flex items-center gap-4 mb-6">
        {/* Before: stack of CV cards, staggered */}
        <div className="relative w-20 h-20 shrink-0">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute rounded-[6px]"
              style={{
                width: 56, height: 68,
                left: i * 4, top: i * 3,
                background: "white",
                border: "1px solid var(--border)",
                transform: `rotate(${(i - 1.5) * 4}deg)`,
                boxShadow: "0 2px 6px -2px rgba(19,32,27,0.15)",
              }}
            >
              <div className="w-full h-1.5 mt-3 mx-auto" style={{ width: "70%", background: "var(--border)" }} />
              <div className="mt-1.5 mx-auto" style={{ width: "50%", height: 4, background: "var(--border-soft, var(--border))" }} />
            </div>
          ))}
        </div>

        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8d8ce" strokeWidth="2" strokeLinecap="round" className="shrink-0">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>

        {/* After: single score */}
        <div className="rounded-[10px] px-4 py-3 flex-1" style={{ background: "var(--mist)" }}>
          <p className="text-[9px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#8aaa9a" }}>Best match</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--forest)" }}>96</span>
            <span className="text-[10px] font-medium" style={{ color: "var(--forest)" }}>Strong match</span>
          </div>
        </div>
      </div>

      <p className="text-xs leading-relaxed" style={{ color: "#5a7a6a" }}>
        That collapse - a pile of unread PDFs into one defensible number - is the whole reason Helixon exists.
      </p>
    </div>
  );
}

export default function AboutPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
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
            <a href="/#pricing" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>Pricing</a>
            <a href="/about" className="px-3 py-1.5 rounded-[8px] transition-colors font-semibold" style={{ color: "var(--forest)" }}>About</a>
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
            {[["How it works", "/#how"], ["Pricing", "/#pricing"], ["About", "/about"], ["Login", "/login"]].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-2.5 rounded-[8px]" style={{ color: "#5a7a6a" }}>{label}</a>
            ))}
            <a href="/" onClick={() => setMobileNavOpen(false)} className="text-xs font-semibold px-2.5 py-2.5 rounded-[10px] mt-1 text-white text-center" style={{ background: "var(--forest)" }}>Try now</a>
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "var(--mint)", color: "var(--forest)" }}>
              About Helixon
            </span>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              We build for the person<br />holding the CV pile.
            </h1>
            <p className="text-sm leading-relaxed mb-8 max-w-md" style={{ color: "#5a7a6a" }}>
              Helixon started as a way to save one recruiter a Monday morning. It's now the first pass for agencies
              who'd rather spend their day on conversations than skim-reading - without handing the decision to a black box.
            </p>
            <CtaButtons />
          </div>

          <PileToScore />
        </div>
      </section>

      {/* ── Story / timeline ────────────────────────────────────────────── */}
      <section className="border-y" style={{ borderColor: "var(--border)", background: "white" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Our story</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              From one agency's inbox to a daily habit
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {TIMELINE.map((t, i) => (
              <div key={t.year} className="relative pl-5 sm:pl-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--forest)" }}>{t.year}</span>
                  <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                </div>
                <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#13201b" }}>{t.label}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#5a7a6a" }}>{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ──────────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>What we believe</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
            Three rules we don't bend on
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-[14px] p-6" style={{ background: "white", border: "1px solid var(--border)" }}>
              <div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-4" style={{ background: "var(--mint)" }}>
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--forest)" strokeWidth="1.2" /><path d="M4 6l1.5 1.5L8 4" stroke="var(--forest)" strokeWidth="1.2" strokeLinecap="round" /></svg>
              </div>
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#13201b" }}>{v.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#5a7a6a" }}>{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Team strip (kept honest for a small team) ──────────────────── */}
      <section className="border-y" style={{ borderColor: "var(--border)", background: "white" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-16 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#8aaa9a" }}>Who's behind it</p>
          <p className="text-sm leading-relaxed max-w-lg mx-auto" style={{ color: "#5a7a6a" }}>
            Helixon is built by a small team that spent years on the agency side of recruitment before switching to
            the product side. We still take support tickets ourselves - if something's off, you'll hear back from
            someone who's done the job you're doing.
          </p>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 py-24">
        <div className="rounded-[20px] px-8 py-14 text-center" style={{ background: "var(--forest)" }}>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3 text-white" style={{ fontFamily: "var(--font-display)" }}>
            See it collapse your own pile.
          </h2>
          <p className="text-xs mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.75)" }}>
            Try Helixon on a real CV and a real job spec - takes less time than reading this page did.
          </p>
          <div className="flex justify-center">
            <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-[10px] transition-transform hover:scale-[1.02]" style={{ background: "white", color: "var(--forest)" }}>
              Try it now - it&apos;s free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
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