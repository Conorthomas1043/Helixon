"use client";
import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Helixon — Privacy page. Same nav/footer/tokens as landing + about so the
// three pages feel like one site. Written for the actual data flow used in
// the app (CV upload → analysis → optional storage in localStorage/history)
// — update the specifics below if your real data handling differs.
// ═══════════════════════════════════════════════════════════════════════════

const PRINCIPLES = [
  {
    title: "EU-hosted, always",
    body: "CVs and job descriptions are processed on infrastructure held in the EU. Nothing is routed outside the EEA as part of a normal analysis.",
  },
  {
    title: "Never used to train models",
    body: "Candidate CVs are not used to train, fine-tune, or improve any AI model — ours or a third party's. They're read once, to answer your question, and nothing else.",
  },
  {
    title: "You can delete it in one click",
    body: "Every recruiter has a “Delete my data” control that clears analysis history, shortlists, and templates immediately — no ticket required.",
  },
];

const SECTIONS = [
  {
    id: "what-we-collect",
    title: "1. What we collect",
    body: [
      "When you use Helixon we process the following categories of data:",
    ],
    list: [
      "CV files you upload (PDF, .doc, .docx) and any text extracted from them, including candidate name, contact details, work history, and education where present.",
      "Job descriptions and must-have requirements you type or paste in.",
      "Analysis output — match scores, summaries, standout factors, and any email drafts generated from a scored candidate.",
      "Basic account and usage data — email address, plan, and how many analyses you've run.",
      "Feedback you submit on a score (thumbs up/down and any reason selected), used to improve scoring quality.",
    ],
  },
  {
    id: "why",
    title: "2. Why we process it",
    body: [
      "We process candidate CVs and job descriptions for one purpose: to generate the match analysis you asked for and let you act on it (via email drafts, shortlisting, or export). We do not use candidate data for advertising, and we do not sell candidate data to third parties.",
      "Aggregated, de-identified usage patterns may be used to improve scoring accuracy and product reliability.",
    ],
  },
  {
    id: "storage",
    title: "3. Where it lives",
    body: [
      "Analysis history, shortlists, and saved job templates are stored locally in your browser (localStorage) by default, plus a record on our EU-hosted servers tied to your agency account so scores can be recalled from any device you log in on.",
      "Uploaded CV files are processed for the analysis and are not retained longer than necessary to serve the result and any immediate follow-up (such as regenerating an email draft). Retention windows are kept as short as the product reasonably allows.",
    ],
  },
  {
    id: "lawful-basis",
    title: "4. Your lawful basis to screen a candidate",
    body: [
      "As the recruiter, you are the data controller for the CVs you upload — Helixon acts as a data processor. Before running an analysis, you confirm you have a lawful basis under GDPR (typically candidate consent or legitimate interest) to screen that CV with AI. It's your responsibility to ensure candidates have been informed their application may be screened using automated tools, in line with your own privacy notice and local employment law.",
    ],
  },
  {
    id: "sharing",
    title: "5. Who we share data with",
    body: [
      "We use a small number of infrastructure and AI-processing subprocessors, all bound by data processing agreements and EU data residency commitments, solely to run the analysis you request. We do not share candidate data with advertisers, data brokers, or any party outside of delivering the service.",
    ],
  },
  {
    id: "retention",
    title: "6. How long we keep it",
    body: [
      "Analysis history is kept until you delete it (via “Delete my data” in the app) or your account is closed. Uploaded CV files themselves are not retained beyond what's needed to generate and serve your result. You can export a full copy of your stored data at any time from the same panel.",
    ],
  },
  {
    id: "rights",
    title: "7. Your rights",
    body: [
      "If you're a recruiter using Helixon, you can access, export, or delete your account data at any time from the app. If you're a candidate and believe your CV was processed by a Helixon customer, requests about your personal data should go to the recruiting agency that submitted it, as they are the data controller — we're happy to assist them in fulfilling that request.",
    ],
  },
  {
    id: "contact",
    title: "8. Contact",
    body: [
      "Questions about this policy or a data request can be sent to privacy@helixon.example. We aim to respond within 5 working days.",
    ],
  },
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
        href="/landing#pricing"
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

export default function PrivacyPage() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <a href="/landing" className="flex items-center gap-3 group" aria-label="Helixon home">
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
            <a href="/landing#how" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>How it works</a>
            <a href="/landing#pricing" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>Pricing</a>
            <a href="/about" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={e => e.currentTarget.style.background = "var(--mint)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>About</a>
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
            {[["How it works", "/landing#how"], ["Pricing", "/landing#pricing"], ["About", "/about"], ["Login", "/login"]].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-2.5 rounded-[8px]" style={{ color: "#5a7a6a" }}>{label}</a>
            ))}
            <a href="/" onClick={() => setMobileNavOpen(false)} className="text-xs font-semibold px-2.5 py-2.5 rounded-[10px] mt-1 text-white text-center" style={{ background: "var(--forest)" }}>Try now</a>
          </div>
        )}
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="max-w-[900px] mx-auto px-6 pt-16 pb-14">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "var(--mint)", color: "var(--forest)" }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          GDPR-ready · Data held in the EU
        </span>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Privacy, in plain English.
        </h1>
        <p className="text-sm leading-relaxed max-w-xl" style={{ color: "#5a7a6a" }}>
          You're handling other people's personal data every time you use Helixon — so this page tells you exactly
          what we do with it, in the same language we'd use if you asked us over email.
        </p>
        <p className="text-[11px] mt-4" style={{ color: "#8aaa9a" }}>Last updated: August 2026</p>
      </section>

      {/* ── Principles ──────────────────────────────────────────────────── */}
      <section className="border-y" style={{ borderColor: "var(--border)", background: "white" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-[14px] p-6" style={{ background: "var(--mist)", border: "1px solid var(--border-soft, var(--border))" }}>
                <div className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-4" style={{ background: "white", border: "1px solid var(--border)" }}>
                  <svg width="14" height="14" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--forest)" strokeWidth="1.2" /><path d="M4 6l1.5 1.5L8 4" stroke="var(--forest)" strokeWidth="1.2" strokeLinecap="round" /></svg>
                </div>
                <h3 className="text-sm font-semibold mb-1.5" style={{ color: "#13201b" }}>{p.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "#5a7a6a" }}>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Full policy ─────────────────────────────────────────────────── */}
      <section className="max-w-[900px] mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-10">

          {/* On-page nav */}
          <nav className="hidden lg:block sticky top-20 self-start">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#8aaa9a" }}>On this page</p>
            <ul className="space-y-2">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-[11px] leading-relaxed block transition-colors" style={{ color: "#5a7a6a" }}
                    onMouseEnter={e => e.currentTarget.style.color = "var(--forest)"} onMouseLeave={e => e.currentTarget.style.color = "#5a7a6a"}>
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Sections */}
          <div className="space-y-12">
            {SECTIONS.map((s) => (
              <div key={s.id} id={s.id} className="scroll-mt-20">
                <h2 className="text-lg font-semibold tracking-tight mb-3" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
                  {s.title}
                </h2>
                {s.body.map((p, i) => (
                  <p key={i} className="text-xs leading-relaxed mb-3" style={{ color: "#5a7a6a" }}>{p}</p>
                ))}
                {s.list && (
                  <ul className="space-y-2 mt-3">
                    {s.list.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: "#5a7a6a" }}>
                        <span className="shrink-0 mt-0.5" style={{ color: "var(--forest)" }}>✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="max-w-[1100px] mx-auto px-6 pb-24">
        <div className="rounded-[20px] px-8 py-14 text-center" style={{ background: "var(--forest)" }}>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3 text-white" style={{ fontFamily: "var(--font-display)" }}>
            Questions about how we handle data?
          </h2>
          <p className="text-xs mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.75)" }}>
            Email privacy@helixon.example and a real person will get back to you — not a ticket queue.
          </p>
          <div className="flex justify-center">
            <a href="mailto:privacy@helixon.example" className="inline-flex items-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-[10px] transition-transform hover:scale-[1.02]" style={{ background: "white", color: "var(--forest)" }}>
              Email privacy@helixon.example
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