"use client";
import { useState } from "react";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import CtaBand from "@/components/marketing/CtaBand";
import { FAQ_GROUPS } from "@/lib/faq-content";

// ═══════════════════════════════════════════════════════════════════════════
// FAQ - accordion list grouped by topic, same nav/footer/tokens as landing.
// ═══════════════════════════════════════════════════════════════════════════

function FaqItem({ id, q, a, isOpen, onToggle }) {
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
      <button
        type="button"
        id={`${id}-q`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`${id}-a`}
        className="w-full flex items-center justify-between gap-4 py-4 text-left min-h-[44px]"
      >
        <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>{q}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round"
          aria-hidden="true"
          className="shrink-0 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <div
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        inert={!isOpen}
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: isOpen ? "400px" : "0px", opacity: isOpen ? 1 : 0 }}
      >
        <p className="text-sm leading-relaxed pb-4 pr-8" style={{ color: "var(--ink-soft)" }}>{a}</p>
      </div>
    </div>
  );
}

export default function FaqPage() {
  const [openKey, setOpenKey] = useState("Getting started-0");

  return (
    <div className="min-h-screen" style={{ background: "var(--mist)" }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MarketingNav active="faq" />
      <main id="main-content">

      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-12 text-center">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "var(--mint)", color: "var(--forest)" }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" /><path d="M6 4v2.5M6 8h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
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
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>{group.group}</p>
              <div className="rounded-[14px] px-6" style={{ background: "white", border: "1px solid var(--border)" }}>
                {group.items.map((item, i) => {
                  const key = `${group.group}-${i}`;
                  return (
                    <FaqItem
                      key={key}
                      id={`faq-${key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
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

      </main>
      <MarketingFooter />
    </div>
  );
}