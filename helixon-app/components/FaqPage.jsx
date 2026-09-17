"use client";
import { useState } from "react";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import CtaBand from "@/components/marketing/CtaBand";

// ═══════════════════════════════════════════════════════════════════════════
// FAQ - accordion list grouped by topic, same nav/footer/tokens as landing.
// ═══════════════════════════════════════════════════════════════════════════

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
        <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>{q}</span>
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
        <p className="text-xs leading-relaxed pb-4 pr-8" style={{ color: "var(--ink-soft)" }}>{a}</p>
      </div>
    </div>
  );
}

export default function FaqPage() {
  const [openKey, setOpenKey] = useState("Getting started-0");

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <MarketingNav active="faq" />

      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-12 text-center">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "var(--mint)", color: "var(--forest)" }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M6 4v2.5M6 8h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
          Frequently asked
        </span>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5 max-w-xl mx-auto" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          Questions, answered.
        </h1>
        <p className="text-sm leading-relaxed max-w-md mx-auto" style={{ color: "var(--ink-soft)" }}>
          Can&apos;t find what you&apos;re looking for?{" "}
          <Link href="/contact" style={{ color: "var(--forest)", fontWeight: 600 }}>Get in touch</Link>
          {" "}and we&apos;ll help directly.
        </p>
      </section>

      <section className="max-w-[720px] mx-auto px-6 pb-24">
        <div className="space-y-8">
          {FAQ_GROUPS.map((group) => (
            <div key={group.group}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>{group.group}</p>
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

      <CtaBand
        heading="Still have questions?"
        body="We're happy to walk you through it - reach out and we'll get back to you quickly."
        ctaLabel="Contact us"
        ctaHref="/contact"
      />

      <MarketingFooter />
    </main>
  );
}