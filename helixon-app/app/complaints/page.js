"use client";
import MarketingNav from "@/components/marketing/MarketingNav";
import LegalHeader, { LEGAL_WIDTH } from "@/components/marketing/LegalHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";

// ═══════════════════════════════════════════════════════════════════════════
// Complaints Policy - legal/policy content page. Same nav/footer/tokens as
// the rest of the marketing site, formatted as readable prose sections
// rather than cards, since this is a document people need to actually read.
// ═══════════════════════════════════════════════════════════════════════════

const SECTIONS = [
  {
    n: "1",
    title: "Our commitment",
    body: "We want Helixon to work well for every agency that uses it. If something falls short - a bug, a billing issue, a scoring result that seems off, or how you've been treated by our team - we want to know, and we'll take it seriously.",
  },
  {
    n: "2",
    title: "How to raise a complaint",
    body: "Email support@helixon.co.uk with a description of the issue, your agency name, and any relevant account or analysis details. You can also use the Contact page and select \"Support\" as the topic. There's no formal template required - just tell us what happened.",
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
    body: "If your complaint relates to a specific match score or analysis, include the analysis ID and candidate name so we can review the exact inputs and output. We treat scoring disputes as valuable feedback and use them to improve the model - not just to resolve individual cases.",
  },
  {
    n: "6",
    title: "Record keeping",
    body: "We keep a record of all complaints and their outcomes for as long as your account remains active, in line with our data retention practices described in our Privacy policy.",
  },
];

export default function ComplaintsPolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--mist)]">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MarketingNav active="complaints" />
      <main id="main-content">

      <LegalHeader
        title="Complaints policy"
        intro="How to raise a complaint about Helixon and what you can expect from us in response."
        meta={<span><strong className="text-[var(--ink)]">Last updated:</strong> August 2026</span>}
      />

      <section className={`${LEGAL_WIDTH.narrow} mx-auto px-6 py-14`}>
        <div className="rounded-2xl p-2 sm:p-4" style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 12px 24px -18px rgba(19,32,27,0.25)" }}>
          {SECTIONS.map((s, i) => (
            <div
              key={s.n}
              className="p-5 sm:p-6"
              style={{ borderBottom: i < SECTIONS.length - 1 ? "1px solid var(--border)" : "none" }}
            >
              <div className="flex items-start gap-4">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 bg-[var(--mint)] text-[var(--forest)]">
                  {s.n}
                </span>
                <div>
                  <h2 className="text-sm font-semibold mb-1.5 text-[var(--ink)]">{s.title}</h2>
                  <p className="text-xs leading-relaxed text-[var(--ink-soft)]">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-card p-5 mt-5 flex items-start gap-3.5 bg-[var(--mint)]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.8" strokeLinecap="round" className="mt-0.5 shrink-0">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-xs leading-relaxed text-[var(--ink)]">
            Ready to raise something? Email <a href="mailto:support@helixon.co.uk" className="font-semibold text-[var(--forest)]">support@helixon.co.uk</a> or use our <a href="/contact" className="font-semibold text-[var(--forest)]">Contact page</a>.
          </p>
        </div>
      </section>

      </main>
      <MarketingFooter />
    </div>
  );
}