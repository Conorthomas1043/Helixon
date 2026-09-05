"use client";
import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Helixon - Data Processing Agreement.
// Reuses the marketing site's nav/footer shell and token system so the
// jump from product → legal reads as one site. Signature element: a
// sticky, scroll-spy table of contents - the one thing a DPA reader
// actually needs that a plain long-form doc doesn't give them.
// ═══════════════════════════════════════════════════════════════════════════

const SECTIONS = [
  { id: "parties", label: "1. Parties & scope" },
  { id: "definitions", label: "2. Definitions" },
  { id: "subject-matter", label: "3. Subject matter & duration" },
  { id: "nature-purpose", label: "4. Nature & purpose of processing" },
  { id: "data-types", label: "5. Categories of data" },
  { id: "processor-obligations", label: "6. Processor obligations" },
  { id: "subprocessors", label: "7. Sub-processors" },
  { id: "data-subject-rights", label: "8. Data subject rights" },
  { id: "security", label: "9. Security measures" },
  { id: "breach", label: "10. Breach notification" },
  { id: "transfers", label: "11. International transfers" },
  { id: "audit", label: "12. Audit rights" },
  { id: "liability", label: "13. Liability & term" },
  { id: "annex-a", label: "Annex A - Processing details" },
  { id: "annex-b", label: "Annex B - Sub-processors" },
  { id: "annex-c", label: "Annex C - Security measures" },
];

const SUBPROCESSORS = [
  { name: "Amazon Web Services (Frankfurt, eu-central-1)", purpose: "Hosting & storage", location: "European Union" },
  { name: "Anthropic PBC", purpose: "CV & job description analysis (AI scoring)", location: "United States (SCC-covered)" },
  { name: "Postmark", purpose: "Transactional email delivery", location: "European Union" },
  { name: "Stripe", purpose: "Billing & payment processing", location: "European Union / United States (SCC-covered)" },
];

// ── Scroll-spy hook ──────────────────────────────────────────────────────
function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 mb-12">
      <h2 className="text-lg font-semibold tracking-tight mb-4" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
        {title}
      </h2>
      <div className="space-y-3 text-[13px] leading-relaxed" style={{ color: "#4a6357" }}>
        {children}
      </div>
    </section>
  );
}

export default function DpaPage() {
  const active = useActiveSection(SECTIONS.map((s) => s.id));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [tocOpenMobile, setTocOpenMobile] = useState(false);

  return (
    <main
      className="min-h-screen"
      style={{
        background: "var(--mist)",
        "--forest": "#0b6e4f",
        "--forest-deep": "#085a41",
        "--mint": "#e3f0e9",
        "--mist": "#f6f8f6",
        "--border": "#dde6e1",
        "--signal": "#f59e0b",
        "--font-display": "'Fraunces', Georgia, serif",
        "--font-mono": "'IBM Plex Mono', monospace",
      }}
    >
      {/* ── Nav (shared shell) ──────────────────────────────────────────── */}
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
            <a href="/#how" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>How it works</a>
            <a href="/#pricing" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Pricing</a>
            <a href="/login" className="px-3 py-1.5 rounded-[8px] transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Login</a>
          </div>

          <div className="flex items-center gap-2">
            <a href="/demo" className="text-xs font-semibold px-4 py-1.5 rounded-[10px] transition-colors text-white hidden sm:block" style={{ background: "var(--forest)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--forest-deep)")} onMouseLeave={(e) => (e.currentTarget.style.background = "var(--forest)")}>
              Get a demo now
            </a>
            <button type="button" onClick={() => setMobileNavOpen((v) => !v)} aria-expanded={mobileNavOpen} aria-label="Open menu"
              className="sm:hidden w-8 h-8 rounded-[8px] flex items-center justify-center" style={{ color: "#13201b" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobileNavOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
              </svg>
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="sm:hidden border-t px-4 py-3 flex flex-col gap-0.5 bg-white" style={{ borderColor: "var(--border)" }}>
            {[["How it works", "/#how"], ["Pricing", "/#pricing"], ["Login", "/login"]].map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileNavOpen(false)} className="text-xs px-2.5 py-2.5 rounded-[8px]" style={{ color: "#5a7a6a" }}>{label}</a>
            ))}
          </div>
        )}
      </nav>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 pt-14 pb-10">
          <p className="text-[11px] font-medium mb-3" style={{ color: "#8aaa9a" }}>
            <a href="/" className="hover:underline">Helixon</a> <span className="mx-1">/</span> Legal
          </p>
          <h1 className="text-3xl sm:text-[38px] font-semibold tracking-tight leading-tight mb-4" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
            Data Processing Agreement
          </h1>
          <p className="text-sm leading-relaxed max-w-xl mb-6" style={{ color: "#5a7a6a" }}>
            This DPA forms part of the agreement between Helixon and any organisation using Helixon to process
            personal data on their behalf, and reflects our obligations as a processor under UK GDPR and EU GDPR.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]" style={{ color: "#5a7a6a" }}>
            <span><strong style={{ color: "#13201b" }}>Effective:</strong> 1 August 2026</span>
            <span><strong style={{ color: "#13201b" }}>Version:</strong> 3.1</span>
            <a href="#" className="inline-flex items-center gap-1.5 font-semibold" style={{ color: "var(--forest)" }}>
              Download PDF
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v13m0 0-4-4m4 4 4-4M5 21h14" /></svg>
            </a>
          </div>
        </div>
      </header>

      {/* ── Mobile TOC toggle ───────────────────────────────────────────── */}
      <div className="lg:hidden sticky top-[56px] z-30 bg-white border-b" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={() => setTocOpenMobile((v) => !v)}
          className="w-full max-w-[1100px] mx-auto px-6 py-3 flex items-center justify-between text-xs font-semibold"
          style={{ color: "#13201b" }}
        >
          On this page
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: tocOpenMobile ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {tocOpenMobile && (
          <div className="px-6 pb-3 flex flex-col gap-0.5 max-h-64 overflow-y-auto">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} onClick={() => setTocOpenMobile(false)} className="text-xs py-1.5" style={{ color: active === s.id ? "var(--forest)" : "#5a7a6a", fontWeight: active === s.id ? 600 : 400 }}>
                {s.label}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="max-w-[1100px] mx-auto px-6 py-14 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-12">
        {/* Sticky TOC */}
        <aside className="hidden lg:block">
          <nav className="sticky top-[80px] space-y-0.5 pr-4 max-h-[calc(100vh-100px)] overflow-y-auto">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#8aaa9a" }}>On this page</p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block text-[12px] py-1.5 pl-3 border-l-2 transition-colors leading-snug"
                style={{
                  borderColor: active === s.id ? "var(--forest)" : "transparent",
                  color: active === s.id ? "var(--forest)" : "#5a7a6a",
                  fontWeight: active === s.id ? 600 : 400,
                }}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <article className="max-w-[640px] bg-white rounded-[16px] border p-8 sm:p-10" style={{ borderColor: "var(--border)" }}>

          <Section id="parties" title="1. Parties & scope">
            <p>This Data Processing Agreement (“DPA”) is entered into between the organisation using the Helixon
              platform to screen candidates (“Customer”, “Controller”) and Helixon Ltd (“Helixon”, “Processor”),
              and applies whenever Helixon processes personal data on Customer’s behalf in the course of providing
              the Helixon service under the Terms of Service.</p>
            <p>In the event of a conflict between this DPA and the Terms of Service, this DPA governs with respect
              to the processing of personal data.</p>
          </Section>

          <Section id="definitions" title="2. Definitions">
            <p><strong style={{ color: "#13201b" }}>“Data Protection Laws”</strong> means UK GDPR, EU GDPR (Regulation
              (EU) 2016/679), the UK Data Protection Act 2018, and any other applicable law relating to the
              processing of personal data.</p>
            <p><strong style={{ color: "#13201b" }}>“Personal Data”, “Processing”, “Controller”, “Processor”, “Data
              Subject”</strong> and <strong style={{ color: "#13201b" }}>“Personal Data Breach”</strong> take the
              meanings given in the applicable Data Protection Laws.</p>
            <p><strong style={{ color: "#13201b" }}>“Sub-processor”</strong> means any third party appointed by
              Helixon to process personal data on Customer’s behalf, as listed in Annex B.</p>
          </Section>

          <Section id="subject-matter" title="3. Subject matter & duration">
            <p>Helixon processes personal data solely to provide the CV screening and candidate scoring service:
              parsing uploaded CVs, comparing them against job descriptions, generating match scores, and drafting
              candidate correspondence at Customer’s instruction.</p>
            <p>Processing continues for the duration of the underlying agreement between Helixon and Customer, and
              ceases (subject to Section 13) on termination.</p>
          </Section>

          <Section id="nature-purpose" title="4. Nature & purpose of processing">
            <p>The nature of processing is automated analysis of candidate documents against role requirements.
              The purpose is to help Customer’s recruiters identify and prioritise suitable candidates faster.
              Helixon does not use Customer’s data to train any underlying model, and does not sell or share
              personal data with third parties for their own purposes.</p>
          </Section>

          <Section id="data-types" title="5. Categories of data">
            <p><strong style={{ color: "#13201b" }}>Data subjects:</strong> job candidates whose CVs are uploaded by
              Customer, and Customer’s own personnel (users of the platform).</p>
            <p><strong style={{ color: "#13201b" }}>Categories of data:</strong> name, contact details, employment
              and education history, skills, and any other information a candidate has chosen to include on their
              CV. Helixon does not knowingly process special category data and asks Customer not to upload CVs
              containing it beyond what a candidate has voluntarily disclosed within their own document.</p>
          </Section>

          <Section id="processor-obligations" title="6. Processor obligations">
            <p>Helixon shall:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>process personal data only on Customer’s documented instructions, including with regard to
                international transfers, unless required to do otherwise by law;</li>
              <li>ensure persons authorised to process the data are bound by confidentiality;</li>
              <li>implement the technical and organisational measures set out in Annex C;</li>
              <li>assist Customer, at Customer’s cost, in responding to data subject requests and regulatory
                inquiries;</li>
              <li>delete or return all personal data at the end of the engagement, at Customer’s election, subject
                to any legal retention requirement.</li>
            </ul>
          </Section>

          <Section id="subprocessors" title="7. Sub-processors">
            <p>Customer provides general authorisation for Helixon to engage the sub-processors listed in Annex B.
              Helixon will notify Customer of any intended change to that list at least 14 days in advance, giving
              Customer the opportunity to object on reasonable data protection grounds. Helixon remains liable for
              the acts and omissions of its sub-processors as if they were its own.</p>
          </Section>

          <Section id="data-subject-rights" title="8. Data subject rights">
            <p>Where Helixon receives a request from a data subject relating to Customer’s data (access, erasure,
              rectification, or otherwise), Helixon will not respond directly and will instead forward the request
              to Customer without undue delay, providing reasonable assistance to help Customer fulfil it.</p>
          </Section>

          <Section id="security" title="9. Security measures">
            <p>Helixon maintains the technical and organisational measures described in Annex C, including
              encryption in transit and at rest, access controls, and regular review of its security practices.
              These measures are designed to ensure a level of security appropriate to the risk.</p>
          </Section>

          <Section id="breach" title="10. Breach notification">
            <p>Helixon will notify Customer without undue delay, and in any event within 48 hours of becoming
              aware, of any Personal Data Breach affecting Customer’s data, together with the information
              reasonably necessary for Customer to meet its own notification obligations.</p>
          </Section>

          <Section id="transfers" title="11. International transfers">
            <p>Personal data is hosted within the European Union. Where processing by a sub-processor involves a
              transfer outside the UK or EEA, Helixon relies on the UK International Data Transfer Addendum or EU
              Standard Contractual Clauses, as applicable, to ensure an adequate level of protection.</p>
          </Section>

          <Section id="audit" title="12. Audit rights">
            <p>On reasonable written notice, and no more than once per year unless required by a regulator or
              following a Personal Data Breach, Customer may request evidence of Helixon’s compliance with this
              DPA. Helixon will make available its most recent security documentation and, where that is
              insufficient, permit an audit conducted at Customer’s cost during business hours.</p>
          </Section>

          <Section id="liability" title="13. Liability & term">
            <p>Each party’s liability arising out of or in connection with this DPA is subject to the limitations
              and exclusions of liability set out in the Terms of Service. This DPA remains in effect for as long
              as Helixon processes personal data on Customer’s behalf.</p>
          </Section>

          <Section id="annex-a" title="Annex A - Processing details">
            <div className="rounded-[10px] overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              {[
                ["Subject matter", "Provision of the Helixon CV screening service"],
                ["Duration", "Term of the underlying agreement"],
                ["Nature of processing", "Parsing, comparison, scoring, and correspondence drafting"],
                ["Purpose", "Candidate screening on Customer’s behalf"],
                ["Data subjects", "Job candidates; Customer personnel"],
                ["Categories of data", "CV contents, contact details, employment history"],
              ].map(([k, v], i) => (
                <div key={k} className="grid grid-cols-[130px_1fr] text-[12px]" style={{ background: i % 2 === 0 ? "var(--mist)" : "white" }}>
                  <div className="px-4 py-3 font-semibold" style={{ color: "#13201b" }}>{k}</div>
                  <div className="px-4 py-3 border-l" style={{ color: "#5a7a6a", borderColor: "var(--border)" }}>{v}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="annex-b" title="Annex B - Sub-processors">
            <div className="rounded-[10px] overflow-hidden border" style={{ borderColor: "var(--border)" }}>
              <div className="grid grid-cols-[1fr_1fr_120px] text-[11px] font-semibold uppercase tracking-wide px-4 py-2.5" style={{ background: "var(--mint)", color: "var(--forest)" }}>
                <span>Sub-processor</span><span>Purpose</span><span>Location</span>
              </div>
              {SUBPROCESSORS.map((sp, i) => (
                <div key={sp.name} className="grid grid-cols-[1fr_1fr_120px] text-[12px] px-4 py-3" style={{ background: i % 2 === 0 ? "white" : "var(--mist)", color: "#5a7a6a" }}>
                  <span style={{ color: "#13201b", fontWeight: 500 }}>{sp.name}</span>
                  <span>{sp.purpose}</span>
                  <span>{sp.location}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section id="annex-c" title="Annex C - Technical & organisational measures">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Encryption of personal data in transit (TLS 1.2+) and at rest (AES-256)</li>
              <li>Role-based access control and single sign-on for internal systems</li>
              <li>Isolated, EU-region-only storage with no cross-region replication</li>
              <li>Automatic deletion of uploaded CVs 90 days after the associated analysis is archived</li>
              <li>Annual penetration testing and continuous dependency vulnerability scanning</li>
              <li>Documented incident response process with defined notification timelines</li>
            </ul>
          </Section>

          <div className="pt-4 mt-2 border-t text-[12px]" style={{ borderColor: "var(--border)", color: "#8aaa9a" }}>
            Questions about this DPA? Contact <a href="mailto:hello@helixon.co.uk" className="font-semibold" style={{ color: "var(--forest)" }}>hello@helixon.co.uk</a>.
          </div>
        </article>
      </div>

      {/* ── Footer (shared shell) ───────────────────────────────────────── */}
      <footer className="border-t bg-white" style={{ borderColor: "var(--border)" }}>
        <div className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[11px]" style={{ color: "#8aaa9a" }}>© {new Date().getFullYear()} Helixon. Screen candidates in seconds.</span>
          <div className="flex gap-4 text-[11px]" style={{ color: "#8aaa9a" }}>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/dpa" style={{ color: "var(--forest)", fontWeight: 600 }}>DPA</a>
            <a href="/login">Login</a>
          </div>
        </div>
      </footer>
    </main>
  );
}