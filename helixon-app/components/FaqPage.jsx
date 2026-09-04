"use client";
import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// FAQ - accordion list grouped by topic, same nav/footer/tokens as landing.
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
          <a href="/how-it-works">How it works</a>
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/login">Login</a>
        </div>
      </div>
    </footer>
  );
}

const FAQ_GROUPS = [
  {
    group: "Getting started",
    items: [
      { q: "Do I need a card to try it?", a: "No. You get 3 free analyses with no card required. You'll only be asked for payment details if you decide to upgrade to Solo or Team." },
      { q: "What file types can I upload?", a: "PDF and Word (.docx) CVs. If you're working from something else, exporting to PDF first works fine." },
      { q: "How long does a scan actually take?", a: "Around 30 seconds on average - reading the CV, parsing the job description, analysing fit, and generating the score all happen in one pass." },
    ],
  },
  {
    group: "Scoring & accuracy",
    items: [
      { q: "How is the match score calculated?", a: "It weighs how closely a candidate's experience, skills, and seniority match what the job description asks for - not a keyword count. Equivalent experience under a different title still scores fairly." },
      { q: "Can I use my own job description instead of a preset?", a: "Yes - paste in your own job description at the analysis step and Helixon reads it the same way it reads the presets." },
      { q: "What if I disagree with a score?", a: "You can leave feedback on any analysis, which feeds into your agency's accuracy rate on the dashboard and helps you spot patterns in where the scoring runs hot or cold for your roles." },
    ],
  },
  {
    group: "Data & privacy",
    items: [
      { q: "Is my data used to train any model?", a: "No. CVs and job descriptions are processed only to generate your analysis and are never used for training." },
      { q: "Where is data stored?", a: "On EU servers, in line with GDPR." },
      { q: "Can I delete my data?", a: "Yes - deleting your account from Account settings removes all analyses, candidates, and billing history permanently." },
    ],
  },
  {
    group: "Billing",
    items: [
      { q: "Can I cancel anytime?", a: "Yes, there's no lock-in on Solo or Team. Cancel from Billing and you'll keep access until the end of your current billing period." },
      { q: "Do unused analyses roll over?", a: "Solo and Team plans include unlimited analyses, so this only applies to the free plan - free analyses don't roll over month to month." },
      { q: "Do you offer invoicing for agencies?", a: "Team plans can be invoiced directly - reach out via the Contact page and we'll set that up." },
    ],
  },
];

function FaqItem({ q, a, isOpen, onToggle }) {
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-4 py-4 text-left"
      >
        <span className="text-sm font-medium" style={{ color: "#13201b" }}>{q}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round"
          className="shrink-0 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: isOpen ? "200px" : "0px" }}
      >
        <p className="text-xs leading-relaxed pb-4 pr-8" style={{ color: "#5a7a6a" }}>{a}</p>
      </div>
    </div>
  );
}

export default function FaqPage() {
  const [openKey, setOpenKey] = useState("Getting started-0");

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <MarketingNav />

      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-12 text-center">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "var(--mint)", color: "var(--forest)" }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M6 4v2.5M6 8h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          Frequently asked
        </span>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5 max-w-xl mx-auto" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Questions, answered.
        </h1>
        <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "#5a7a6a" }}>
          Can't find what you're looking for? <a href="/contact" style={{ color: "var(--forest)", fontWeight: 600 }}>Get in touch</a> and we'll help directly.
        </p>
      </section>

      <section className="max-w-[720px] mx-auto px-6 pb-24">
        <div className="space-y-8">
          {FAQ_GROUPS.map((group) => (
            <div key={group.group}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#8aaa9a" }}>{group.group}</p>
              <div className="rounded-[14px] px-6" style={{ background: "white", border: "1px solid var(--border)" }}>
                {group.items.map((item, i) => {
                  const key = `${group.group}-${i}`;
                  return (
                    <FaqItem
                      key={key}
                      q={item.q}
                      a={item.a}
                      isOpen={openKey === key}
                      onToggle={() => setOpenKey(openKey === key ? null : key)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 pb-24">
        <div className="rounded-[20px] px-8 py-14 text-center" style={{ background: "var(--forest)" }}>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3 text-white" style={{ fontFamily: "var(--font-display)" }}>
            Still have questions?
          </h2>
          <p className="text-xs mb-8 max-w-md mx-auto" style={{ color: "rgba(255,255,255,0.75)" }}>
            We're happy to walk you through it - reach out and we'll get back to you quickly.
          </p>
          <div className="flex justify-center">
            <a href="/contact" className="inline-flex items-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-[10px] transition-transform hover:scale-[1.02]" style={{ background: "white", color: "var(--forest)" }}>
              Contact us
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}