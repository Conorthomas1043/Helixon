"use client";
import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Complaints Policy — legal/policy content page. Same nav/footer/tokens as
// the rest of the marketing site, formatted as readable prose sections
// rather than cards, since this is a document people need to actually read.
// ═══════════════════════════════════════════════════════════════════════════

function MarketingNav() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const links = [["How it works", "/how-it-works"], ["FAQ", "/faq"], ["Blog", "/blog"], ["Pricing", "/#pricing"], ["Contact", "/contact"], ["Login", "/login"]];
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
          {links.map(([label, href]) => (
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
          {links.map(([label, href]) => (
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
          <a href="/how-it-works">How it works</a>
          <a href="/faq">FAQ</a>
          <a href="/careers">Careers</a>
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </div>
      </div>
    </footer>
  );
}

const SECTIONS = [
  {
    n: "1",
    title: "Our commitment",
    body: "We want Helixon to work well for every agency that uses it. If something falls short — a bug, a billing issue, a scoring result that seems off, or how you've been treated by our team — we want to know, and we'll take it seriously.",
  },
  {
    n: "2",
    title: "How to raise a complaint",
    body: "Email complaints@helixon.app with a description of the issue, your agency name, and any relevant account or analysis details. You can also use the Contact page and select \"Support\" as the topic. There's no formal template required — just tell us what happened.",
  },
  {
    n: "3",
    title: "What happens next",
    body: "We acknowledge every complaint within 2 working days. A member of our team will investigate and aim to give you a full response within 10 working days. If a complaint is complex and needs longer, we'll tell you why and give you a revised timeframe.",
  },
  {
    n: "4",
    title: "If you're not satisfied with our response",
    body: "If you feel your complaint hasn't been resolved fairly, ask for it to be escalated to a senior member of the team by replying to your case email with \"Please escalate\" in the subject line. A director will review the case directly.",
  },
  {
    n: "5",
    title: "Data and scoring disputes",
    body: "If your complaint relates to a specific match score or analysis, include the analysis ID and candidate name so we can review the exact inputs and output. We treat scoring disputes as valuable feedback and use them to improve the model — not just to resolve individual cases.",
  },
  {
    n: "6",
    title: "Record keeping",
    body: "We keep a record of all complaints and their outcomes for as long as your account remains active, in line with our data retention practices described in our Privacy policy.",
  },
];

export default function ComplaintsPolicyPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <MarketingNav />

      <section className="max-w-[720px] mx-auto px-6 pt-16 pb-10">
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Policy</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1] mb-4" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Complaints policy
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: "#5a7a6a" }}>
          Last updated August 2026. This policy explains how to raise a complaint about Helixon and what you can expect from us in response.
        </p>
      </section>

      <section className="max-w-[720px] mx-auto px-6 pb-20">
        <div className="rounded-[16px] p-2 sm:p-4" style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 12px 24px -18px rgba(19,32,27,0.25)" }}>
          {SECTIONS.map((s, i) => (
            <div
              key={s.n}
              className="p-5 sm:p-6"
              style={{ borderBottom: i < SECTIONS.length - 1 ? "1px solid var(--border)" : "none" }}
            >
              <div className="flex items-start gap-4">
                <span className="w-7 h-7 rounded-[8px] flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "var(--mint)", color: "var(--forest)" }}>
                  {s.n}
                </span>
                <div>
                  <h2 className="text-sm font-semibold mb-1.5" style={{ color: "#13201b" }}>{s.title}</h2>
                  <p className="text-xs leading-relaxed" style={{ color: "#5a7a6a" }}>{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[14px] p-5 mt-5 flex items-start gap-3.5" style={{ background: "var(--mint)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.8" strokeLinecap="round" className="mt-0.5 shrink-0">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-xs leading-relaxed" style={{ color: "#13201b" }}>
            Ready to raise something? Email <a href="mailto:complaints@helixon.app" className="font-semibold" style={{ color: "var(--forest)" }}>complaints@helixon.app</a> or use our <a href="/contact" className="font-semibold" style={{ color: "var(--forest)" }}>Contact page</a>.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}