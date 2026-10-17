"use client";

import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import CtaBand from "@/components/marketing/CtaBand";
import Button from "@/components/landing/Button";

// ═══════════════════════════════════════════════════════════════════════════
// Helixon - About page
// Honest product-focused copy: only what the rest of the site already says
// (scoring with evidence, bulk screening, blind screening, the CRM around
// it, Swiss hosting, no model training). No customer, team or usage claims.
// ═══════════════════════════════════════════════════════════════════════════

const VALUES = [
  {
    title: "Evidence over a number",
    body: "Every score comes with the reasons behind it: which requirements are met, the line in the CV that shows it, what still needs checking and what to ask at interview.",
  },
  {
    title: "The recruiter decides",
    body: "Helixon is a decision-support tool. It ranks and explains; the hiring decision always stays with the recruiter. Blind screening leaves names and other personal details out of the report.",
  },
  {
    title: "Candidate data handled properly",
    body: "CVs are stored in Switzerland, which the UK and EU recognise as adequate, encrypted at rest and in transit, and never used to train Helixon's or anyone else's models.",
  },
];

const TIMELINE = [
  {
    label: "The problem",
    body: "One role can bring in dozens of CVs. Reading each against the spec by eye is slow, and the comparison drifts as the pile goes down.",
  },
  {
    label: "The approach",
    body: "Helixon reads every CV against the same job specification, scores each the same way, and shows the evidence for every requirement: met, missing or still to confirm.",
  },
  {
    label: "Helixon today",
    body: "Bulk screening of up to 50 CVs per role, blind screening, and a recruitment CRM around it: pipeline, client shortlists, interviews, placements and invoices.",
  },
];

function CtaButtons({ align = "left" }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${align === "center" ? "justify-center items-center" : ""}`}>
      <Button as="a" href="/demo" variant="primary" className="min-h-[48px]">
        Get a demo
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Button>
      <Button as="a" href="/pricing" variant="outline" className="min-h-[48px]">
        See plans
      </Button>
    </div>
  );
}

// ── An example report ──────────────────────────────────────────────────────
//
// The same kind of evidence the home page's sample analysis shows, labelled
// as an example - not a real candidate or a promised score.

const EXAMPLE_REQUIREMENTS = [
  { label: "Order picking", status: "Met", tone: "met" },
  { label: "RF scanner", status: "Met", tone: "met" },
  { label: "Counterbalance forklift", status: "Missing", tone: "missing" },
  { label: "Right to work in the UK", status: "To confirm", tone: "confirm" },
];

const TONES = {
  met: { color: "var(--forest)", background: "var(--mint)" },
  missing: { color: "var(--score-low)", background: "var(--ui-danger-soft)" },
  confirm: { color: "var(--ink-soft)", background: "var(--mist)" },
};

function ExampleReport() {
  return (
    <div
      className="rounded-2xl p-6 w-full max-w-sm mx-auto lg:mx-0 bg-[var(--bg)]"
      style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-raise)" }}
    >
      <div className="flex items-center justify-between gap-3 mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
          Warehouse Operative
        </p>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--mist)] text-[var(--ink-soft)]">
          Example
        </span>
      </div>
      <div className="flex items-center gap-4 mb-5">
        <span className="text-36 font-semibold leading-none tabular-nums font-mono text-[var(--forest)]">
          88
        </span>
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">Strong match</p>
          <p className="text-xs text-[var(--ink-soft)]">4 years in a busy distribution centre</p>
        </div>
      </div>
      <ul className="divide-y list-none m-0 p-0">
        {EXAMPLE_REQUIREMENTS.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 py-2.5">
            <span className="text-sm text-[var(--ink)]">{r.label}</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" style={TONES[r.tone]}>{r.status}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed mt-4 pt-4 border-t text-[var(--ink-soft)]">
        From the CV: &ldquo;Ran weekly stock counts across three aisles.&rdquo;
      </p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <div
      className="min-h-screen bg-[var(--mist)]"
    >
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MarketingNav active="about" showTagline={false} />
      <main id="main-content">

      {/* ── Hero ────────────────────────────────────────────────────────── */}

      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 bg-[var(--mint)] text-[var(--forest)]"
            >
              About Helixon
            </span>

            <h1
              className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5 text-[var(--ink)] font-display"
            >
              Screening that
              <br />
              shows its working.
            </h1>

            <p
              className="text-sm leading-relaxed mb-8 max-w-md text-[var(--ink-soft)]"
            >
              Helixon scores every CV against the job you&apos;re hiring for,
              quotes the line in the CV behind each judgement, and keeps the
              rest of the desk in one place. The score helps you decide; the
              decision stays yours.
            </p>

            <CtaButtons />
          </div>

          <ExampleReport />
        </div>
      </section>

      {/* ── Story / approach ────────────────────────────────────────────── */}

      <section
        className="border-y border-[var(--border)] bg-[var(--bg)]"
      >
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2 text-[var(--ink-faint)]"
            >
              The idea
            </p>

            <h2
              className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--ink)] font-display"
            >
              From repetitive screening to a clearer workflow
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
            {TIMELINE.map((t, i) => (
              <div
                key={t.label}
                className="relative pl-5 sm:pl-0"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-xs font-semibold font-mono text-[var(--forest)]"
                  >
                    0{i + 1}
                  </span>

                  <span
                    className="h-px flex-1 bg-[var(--border)]"
                  />
                </div>

                <h3
                  className="text-sm font-semibold mb-1.5 text-[var(--ink)]"
                >
                  {t.label}
                </h3>

                <p
                  className="text-xs leading-relaxed text-[var(--ink-soft)]"
                >
                  {t.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ──────────────────────────────────────────────────────── */}

      <section className="max-w-[1100px] mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-2 text-[var(--ink-faint)]"
          >
            What we believe
          </p>

          <h2
            className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--ink)] font-display"
          >
            Three principles behind Helixon
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {VALUES.map((v) => (
            <div
              key={v.title}
              className="rounded-card p-6 bg-[var(--bg)] border border-[var(--border)]"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-4 bg-[var(--mint)]"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <circle
                    cx="6"
                    cy="6"
                    r="5"
                    stroke="var(--forest)"
                    strokeWidth="1.2"
                  />

                  <path
                    d="M4 6l1.5 1.5L8 4"
                    stroke="var(--forest)"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <h3
                className="text-sm font-semibold mb-1.5 text-[var(--ink)]"
              >
                {v.title}
              </h3>

              <p
                className="text-xs leading-relaxed text-[var(--ink-soft)]"
              >
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── About / team ────────────────────────────────────────────────── */}

      <section
        className="border-y border-[var(--border)] bg-[var(--bg)]"
      >
        <div className="max-w-[1100px] mx-auto px-6 py-16 text-center">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3 text-[var(--ink-faint)]"
          >
            Who&apos;s behind it
          </p>

          <h2
            className="text-xl sm:text-2xl font-semibold tracking-tight mb-4 text-[var(--ink)] font-display"
          >
            Built for agency desks
          </h2>

          <p
            className="text-sm leading-relaxed max-w-lg mx-auto text-[var(--ink-soft)]"
          >
            One recruiter screens and the whole team sees the result. Notes,
            tags and shortlists stay with the candidate, and every score,
            note and stage change is recorded with who made it and when.
          </p>
        </div>
      </section>

      <CtaBand
        heading="See it on your own CVs."
        body="Bring a live role and a few CVs, and we'll walk you through the ranked shortlist and the reasoning behind each score."
      />

      </main>
      <MarketingFooter />
    </div>
  );
}