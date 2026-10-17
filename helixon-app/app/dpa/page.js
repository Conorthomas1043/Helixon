"use client";
import MarketingNav from "@/components/marketing/MarketingNav";
import LegalHeader, { LEGAL_WIDTH } from "@/components/marketing/LegalHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
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
  { name: "Vercel Inc.", purpose: "Application hosting", location: "United States (SCC-covered)" },
  { name: "Supabase Inc.", purpose: "Database hosting & file storage", location: "Switzerland (Zurich) - adequacy decision" },
  { name: "Anthropic PBC", purpose: "CV & job description analysis (AI scoring)", location: "United States (SCC-covered)" },
  { name: "Voyage AI, Inc.", purpose: "Skill-matching embeddings (CV analysis)", location: "United States (SCC-covered)" },
  { name: "Google LLC (Gemini API)", purpose: "Website chat assistant", location: "United States (SCC-covered)" },
  { name: "Clerk Inc.", purpose: "Account authentication", location: "United States (SCC-covered)" },
  { name: "Stripe Inc.", purpose: "Billing & payment processing", location: "European Union / United States (SCC-covered)" },
  { name: "Resend", purpose: "Transactional email delivery", location: "European Union / United States (SCC-covered)" },
  { name: "Sentry (Functional Software, Inc.)", purpose: "Error monitoring (session replay only with consent)", location: "European Union (Germany)" },
  { name: "Upstash, Inc. (via Vercel)", purpose: "Rate limiting - IP addresses and account ids, kept up to 1 hour", location: "United States (SCC-covered)" },
  { name: "PostHog Inc.", purpose: "Product analytics (only where cookie consent is given)", location: "European Union" },
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
      <h2 className="text-lg font-semibold tracking-tight mb-4 text-[var(--ink)] font-display">
        {title}
      </h2>
      <div className="space-y-3 text-13 leading-relaxed text-[var(--ink-soft)]">
        {children}
      </div>
    </section>
  );
}

export default function DpaPage() {
  const active = useActiveSection(SECTIONS.map((s) => s.id));
  const [tocOpenMobile, setTocOpenMobile] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--mist)]">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MarketingNav active="dpa" />
      <main id="main-content">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LegalHeader
        width="wide"
        title="Data Processing Agreement"
        intro="This DPA forms part of the agreement between Helixon and any organisation using Helixon to process personal data on their behalf, and reflects our obligations as a processor under UK GDPR and EU GDPR."
        meta={
          <>
            <span><strong className="text-[var(--ink)]">Effective:</strong> 1 August 2026 · last updated 29 September 2026</span>
            <span><strong className="text-[var(--ink)]">Version:</strong> 3.1</span>
            {/* There is no PDF file to link to (this was href="#"). Printing the
                page and choosing "Save as PDF" produces the same document. */}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 font-semibold min-h-[32px] text-[var(--forest)]"
            >
              Print or save as PDF
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v13m0 0-4-4m4 4 4-4M5 21h14" /></svg>
            </button>
          </>
        }
      />

      {/* ── Mobile TOC toggle ───────────────────────────────────────────── */}
      <div className="lg:hidden sticky top-[56px] z-30 bg-[var(--bg)] border-b border-[var(--border)]">
        <button
          type="button"
          onClick={() => setTocOpenMobile((v) => !v)}
          className="w-full max-w-[1100px] mx-auto px-6 py-3 flex items-center justify-between text-xs font-semibold text-[var(--ink)]"
        >
          On this page
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: tocOpenMobile ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {tocOpenMobile && (
          <div className="px-6 pb-3 flex flex-col gap-0.5 max-h-64 overflow-y-auto">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} onClick={() => setTocOpenMobile(false)} className={`text-xs py-1.5 ${active === s.id ? "text-[var(--forest)]" : "text-[var(--ink-soft)]"} ${active === s.id ? "font-semibold" : "font-normal"}`}>
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
            <p className="text-11 font-semibold uppercase tracking-widest mb-3 text-[var(--ink-faint)]">On this page</p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block text-12 py-1.5 pl-3 border-l-2 transition-colors leading-snug"
                style={{
                  borderColor: active === s.id ? "var(--forest)" : "transparent",
                  color: active === s.id ? "var(--forest)" : "var(--ink-soft)",
                  fontWeight: active === s.id ? 600 : 400,
                }}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <article className="max-w-[640px] bg-[var(--bg)] rounded-2xl border p-8 sm:p-10 border-[var(--border)]">

          <Section id="parties" title="1. Parties & scope">
            <p>This Data Processing Agreement (“DPA”) is entered into between the organisation using the Helixon
              platform to screen candidates (“Customer”, “Controller”) and the operator of Helixon (“Helixon”,
              “Processor”), and applies whenever Helixon processes personal data on Customer’s behalf in the course
              of providing the Helixon service under the Terms of Service. Helixon is not yet operated through an
              incorporated company; this section will be updated with the registered company name once
              incorporation is complete.</p>
            <p>In the event of a conflict between this DPA and the Terms of Service, this DPA governs with respect
              to the processing of personal data.</p>
          </Section>

          <Section id="definitions" title="2. Definitions">
            <p><strong className="text-[var(--ink)]">“Data Protection Laws”</strong> means UK GDPR, EU GDPR (Regulation
              (EU) 2016/679), the UK Data Protection Act 2018, and any other applicable law relating to the
              processing of personal data.</p>
            <p><strong className="text-[var(--ink)]">“Personal Data”, “Processing”, “Controller”, “Processor”, “Data
              Subject”</strong> and <strong className="text-[var(--ink)]">“Personal Data Breach”</strong> take the
              meanings given in the applicable Data Protection Laws.</p>
            <p><strong className="text-[var(--ink)]">“Sub-processor”</strong> means any third party appointed by
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
            <p><strong className="text-[var(--ink)]">Data subjects:</strong> job candidates whose CVs are uploaded by
              Customer, and Customer’s own personnel (users of the platform).</p>
            <p><strong className="text-[var(--ink)]">Categories of data:</strong> name, contact details, employment
              and education history, skills, and any other information a candidate has chosen to include on their
              CV. Helixon does not knowingly process special category data and asks Customer not to upload CVs
              containing it beyond what a candidate has voluntarily disclosed within their own document. Where a
              CV contains it, it is processed only because it is in the document: the AI is instructed never to
              base any score or judgement on a protected characteristic, and Customer can screen blind.</p>
            <p><strong className="text-[var(--ink)]">Customer personnel:</strong> account details, activity history
              within the workspace, and - only while Customer has team presence switched on - when each person has
              Helixon open and last used it, plus any status they set. Individuals can hide their presence and
              Customer can switch the feature off, which deletes what was recorded.</p>
          </Section>

          <Section id="processor-obligations" title="6. Processor obligations">
            <p>Helixon shall:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>process personal data only on Customer’s documented instructions, including with regard to
                international transfers, unless required to do otherwise by law;</li>
              <li>ensure persons authorised to process the data are bound by confidentiality;</li>
              <li>implement the technical and organisational measures set out in Annex C;</li>
              <li>assist Customer in responding to data subject requests and regulatory inquiries, including by
                providing in-product tools to export, correct and erase all data held about a candidate;</li>
              <li>record, with each analysis, Customer’s confirmation that it has a lawful basis to screen the CV;</li>
              <li>delete candidate data automatically once it has been inactive for the retention period Customer
                sets (6, 12, 24 or 36 months; 12 by default), unless Customer chooses to keep it;</li>
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
            <p>Customer can fulfil most requests itself in Helixon: <em>Export data</em> on a candidate’s profile
              produces a machine-readable file of everything held about them across every job they were screened
              for (access and portability); <em>Delete candidate</em> can erase every one of those records, their
              files included (erasure); and their details can be edited (rectification).</p>
            <p><strong className="text-[var(--ink)]">Automated processing.</strong> Helixon’s match scores and
              summaries are decision support. Helixon does not make decisions producing legal or similarly
              significant effects on candidates; Customer agrees that a person will review an assessment before any
              such decision, and will meet any request from a candidate for human review or an explanation.</p>
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
            <p>Personal data is hosted in Switzerland (Zurich), which has UK and EU adequacy decisions. Where processing by a sub-processor involves a
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
            <div className="rounded-btn overflow-hidden border border-[var(--border)]">
              {[
                ["Subject matter", "Provision of the Helixon CV screening service"],
                ["Duration", "Term of the underlying agreement"],
                ["Nature of processing", "Parsing, comparison, scoring, and correspondence drafting"],
                ["Purpose", "Candidate screening on Customer’s behalf"],
                ["Data subjects", "Job candidates; Customer personnel"],
                ["Categories of data", "CV contents, contact details, employment history"],
              ].map(([k, v], i) => (
                <div key={k} className={`grid grid-cols-[130px_1fr] text-12 ${i % 2 === 0 ? "bg-[var(--mist)]" : "bg-[var(--bg)]"}`}>
                  <div className="px-4 py-3 font-semibold text-[var(--ink)]">{k}</div>
                  <div className="px-4 py-3 border-l text-[var(--ink-soft)] border-[var(--border)]">{v}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="annex-b" title="Annex B - Sub-processors">
            <div className="rounded-btn overflow-hidden border border-[var(--border)]">
              <div className="grid grid-cols-[1fr_1fr_120px] text-11 font-semibold uppercase tracking-wide px-4 py-2.5 bg-[var(--mint)] text-[var(--forest)]">
                <span>Sub-processor</span><span>Purpose</span><span>Location</span>
              </div>
              {SUBPROCESSORS.map((sp, i) => (
                <div key={sp.name} className={`grid grid-cols-[1fr_1fr_120px] text-12 px-4 py-3 text-[var(--ink-soft)] ${i % 2 === 0 ? "bg-[var(--bg)]" : "bg-[var(--mist)]"}`}>
                  <span className="text-[var(--ink)] font-medium">{sp.name}</span>
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
              <li>Database and file storage in Zurich, Switzerland, with every agency’s data kept separate and only reachable through checks on the person asking</li>
              <li>Original CV files held privately and opened only through links that expire after one minute</li>
              <li>Automatic deletion of candidate data after Customer’s chosen period of inactivity, and of all candidate and CV data 90 days after an agency’s subscription is cancelled</li>
              <li>Talent pool entries that lapse after the retention period unless renewed</li>
              <li>A recorded lawful-basis confirmation with every analysis</li>
              <li>Anonymisation of a user’s name, presence and authored history when they delete their account</li>
              <li>Logged, limited access by Helixon staff</li>
              <li>Continuous dependency vulnerability scanning</li>
              <li>Documented incident response process with defined notification timelines</li>
            </ul>
          </Section>

          <div className="pt-4 mt-2 border-t text-12 border-[var(--border)] text-[var(--ink-faint)]">
            Questions about this DPA? Contact <a href="mailto:hello@helixon.co.uk" className="font-semibold text-[var(--forest)]">hello@helixon.co.uk</a>.
          </div>
        </article>
      </div>

      </main>
      <MarketingFooter />
    </div>
  );
}