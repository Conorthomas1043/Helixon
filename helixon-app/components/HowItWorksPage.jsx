"use client";
import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// How It Works — expands the landing page's 3-step teaser into a full
// walkthrough. Same nav/footer/tokens as the landing page so the click
// from "How it works" in the marketing nav feels seamless.
// ═══════════════════════════════════════════════════════════════════════════

function MarketingNav() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
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
          {[["How it works", "/how-it-works"], ["FAQ", "/faq"], ["Pricing", "/#pricing"], ["Contact", "/contact"], ["Login", "/login"]].map(([label, href]) => (
            <a key={label} href={href} className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>{label}</a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <a href="/" className="text-xs font-semibold px-4 py-1.5 rounded-[10px] transition-colors text-white hidden sm:block" style={{ background: "var(--forest)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--forest-deep)"} onMouseLeave={e => e.currentTarget.style.background = "var(--forest)"}>
            Try now
          </a>
          <button type="button" onClick={() => setMobileNavOpen(v => !v)} aria-expanded={mobileNavOpen} aria-label="Open menu"
            className="md:hidden w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ color: "#13201b" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileNavOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
            </svg>
          </button>
        </div>
      </div>
      {mobileNavOpen && (
        <div className="md:hidden border-t px-4 py-3 flex flex-col gap-0.5 bg-white" style={{ borderColor: "var(--border)" }}>
          {[["How it works", "/how-it-works"], ["FAQ", "/faq"], ["Pricing", "/#pricing"], ["Contact", "/contact"], ["Login", "/login"]].map(([label, href]) => (
            <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-2.5 rounded-[8px]" style={{ color: "#5a7a6a" }}>{label}</a>
          ))}
          <a href="/" onClick={() => setMobileNavOpen(false)} className="text-xs font-semibold px-2.5 py-2.5 rounded-[10px] mt-1 text-white text-center" style={{ background: "var(--forest)" }}>Try now</a>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-[11px]" style={{ color: "#8aaa9a" }}>© {new Date().getFullYear()} Helixon. Screen candidates in seconds.</span>
        <div className="flex gap-4 text-[11px]" style={{ color: "#8aaa9a" }}>
          <a href="/faq">FAQ</a>
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/login">Login</a>
        </div>
      </div>
    </footer>
  );
}

const STEPS = [
  {
    n: "1",
    title: "Name your analysis & pick the job",
    body: "Give the analysis a name you'll recognise later — the client, the req number, whatever fits your workflow. Then pick a preset role or paste in your own job description. Helixon reads it the same way a hiring manager would: required skills, nice-to-haves, seniority, and tone.",
    icon: <><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></>,
  },
  {
    n: "2",
    title: "Upload the CV",
    body: "Drag in a PDF or Word file. No reformatting, no copy-pasting into a template — Helixon parses the document as-is, including tables, multi-column layouts, and scanned exports, in a matter of seconds.",
    icon: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  },
  {
    n: "3",
    title: "Get your score",
    body: "You get a match score out of 100, a plain-English summary of why, standout factors, red flags worth asking about, and a ready-to-send follow-up email — all on one screen, ready to drop into your pipeline.",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9" /></>,
  },
];

const DETAILS = [
  {
    title: "What Helixon actually reads",
    body: "Work history, dates, titles, skills listed and skills implied by the roles held, education, and any certifications on the page. It also reads the job description the same way — pulling out what's required versus preferred, and the seniority level the role is written for.",
  },
  {
    title: "How the score is calculated",
    body: "The score weighs how closely a candidate's experience, skills, and seniority match what the job description asks for. It's not a keyword count — a candidate missing an exact job title but with equivalent responsibilities elsewhere still scores fairly.",
  },
  {
    title: "What counts as a red flag",
    body: "Unexplained employment gaps, a mismatch between stated seniority and years of experience, or a pattern of short tenures. These are surfaced as talking points for your screening call, not automatic disqualifiers.",
  },
  {
    title: "Your data stays yours",
    body: "CVs and job descriptions are processed to generate your analysis and are never used to train any model. Everything is stored on EU servers in line with GDPR.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-14 text-center">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "var(--mint)", color: "var(--forest)" }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          Under 30 seconds, start to finish
        </span>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5 max-w-2xl mx-auto" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          From CV to decision, in three steps.
        </h1>
        <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "#5a7a6a" }}>
          No spreadsheets, no manual comparison. Here's exactly what happens between dropping in a CV and having a scored, ready-to-act-on candidate.
        </p>
      </section>

      {/* ── Steps ────────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="space-y-5">
          {STEPS.map((s, i) => (
            <div key={s.n} className="rounded-[16px] p-7 flex flex-col sm:flex-row gap-6 items-start" style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 12px 24px -18px rgba(19,32,27,0.25)" }}>
              <div className="flex items-center gap-4 sm:flex-col sm:items-start shrink-0">
                <span className="w-10 h-10 rounded-[10px] flex items-center justify-center text-sm font-bold" style={{ background: "var(--mint)", color: "var(--forest)" }}>
                  {s.n}
                </span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="sm:hidden">{s.icon}</svg>
              </div>
              <div>
                <h2 className="text-base font-semibold mb-2" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>{s.title}</h2>
                <p className="text-sm leading-relaxed max-w-xl" style={{ color: "#5a7a6a" }}>{s.body}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="hidden sm:flex ml-auto self-center shrink-0" style={{ color: "#c5d8cd" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 4l8 8-8 8" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Under the hood ──────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Under the hood</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
            What's actually happening at each step
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {DETAILS.map((d) => (
            <div key={d.title} className="rounded-[14px] p-6" style={{ background: "white", border: "1px solid var(--border)" }}>
              <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#13201b" }}>{d.title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: "#5a7a6a" }}>{d.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-24">
        <div className="rounded-[20px] px-8 py-14 text-center" style={{ background: "var(--forest)" }}>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3 text-white" style={{ fontFamily: "var(--font-display)" }}>
            See it work on a real CV.
          </h2>
          <p className="text-xs mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.75)" }}>
            Try it free — no card needed, 3 analyses included.
          </p>
          <div className="flex justify-center">
            <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-[10px] transition-transform hover:scale-[1.02]" style={{ background: "white", color: "var(--forest)" }}>
              Try it now — it&apos;s free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}