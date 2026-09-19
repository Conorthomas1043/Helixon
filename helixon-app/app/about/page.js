"use client";

import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import CtaBand from "@/components/marketing/CtaBand";
import Button from "@/components/landing/Button";

// ═══════════════════════════════════════════════════════════════════════════
// Helixon - About page
// Honest product-focused copy. Avoids unsupported customer, team, usage,
// security, storage, training, or historical claims.
// ═══════════════════════════════════════════════════════════════════════════

const VALUES = [
  {
    title: "Built for recruitment workflows",
    body: "Helixon is designed to make reviewing and comparing candidate applications easier, particularly when you're working through multiple CVs for the same role.",
  },
  {
    title: "The recruiter stays in control",
    body: "Helixon is a decision-support tool. It can help analyse and compare candidates, but the recruiter remains responsible for the hiring decision.",
  },
  {
    title: "Clearer candidate information",
    body: "Helixon is designed to bring relevant information from candidate applications into a clearer format so recruiters can spend less time searching through documents.",
  },
];

const TIMELINE = [
  {
    label: "The problem",
    body: "Reviewing CVs manually can be repetitive and time-consuming, especially when many candidates apply for the same role.",
  },
  {
    label: "The approach",
    body: "Helixon analyses candidate information against a job specification and presents the results in a format designed to make comparison easier.",
  },
  {
    label: "Helixon today",
    body: "Helixon is being developed as a recruitment screening tool focused on making candidate review faster, clearer and easier to manage.",
  },
];

function CtaButtons({ align = "left" }) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${align === "center" ? "justify-center items-center" : ""}`}>
      <Button as="a" href="/demo" variant="primary" className="min-h-[48px]">
        See Helixon
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

// ── Signature element: CV pile → screening result ─────────────────────────
//
// This is intentionally presented as an illustrative product concept rather
// than a claim about a real candidate or guaranteed score.

function PileToScore() {
  return (
    <div
      className="rounded-[16px] p-6 w-full max-w-sm mx-auto lg:mx-0"
      style={{
        background: "white",
        border: "1px solid var(--border)",
        boxShadow: "0 20px 40px -20px rgba(19,32,27,0.18)",
      }}
    >
      <p
        className="text-[11px] font-semibold uppercase tracking-widest mb-5"
        style={{ color: "var(--ink-faint)" }}
      >
        The screening workflow
      </p>

      <div className="flex items-center gap-4 mb-6">
        {/* Before: stack of CV cards */}
        <div className="relative w-20 h-20 shrink-0">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="absolute rounded-[6px]"
              style={{
                width: 56,
                height: 68,
                left: i * 4,
                top: i * 3,
                background: "white",
                border: "1px solid var(--border)",
                transform: `rotate(${(i - 1.5) * 4}deg)`,
                boxShadow: "0 2px 6px -2px rgba(19,32,27,0.15)",
              }}
            >
              <div
                className="w-full h-1.5 mt-3 mx-auto"
                style={{
                  width: "70%",
                  background: "var(--border)",
                }}
              />

              <div
                className="mt-1.5 mx-auto"
                style={{
                  width: "50%",
                  height: 4,
                  background: "var(--border-soft, var(--border))",
                }}
              />
            </div>
          ))}
        </div>

        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-mute)"
          strokeWidth="2"
          strokeLinecap="round"
          className="shrink-0"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>

        {/* After: illustrative screening result */}
        <div
          className="rounded-[10px] px-4 py-3 flex-1"
          style={{ background: "var(--mist)" }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-wide mb-1"
            style={{ color: "var(--ink-faint)" }}
          >
            Candidate review
          </p>

          <div className="flex items-baseline gap-1.5">
            <span
              className="text-2xl font-semibold"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--forest)",
              }}
            >
              ✓
            </span>

            <span
              className="text-[11px] font-medium"
              style={{ color: "var(--forest)" }}
            >
              Relevant evidence
            </span>
          </div>
        </div>
      </div>

      <p
        className="text-xs leading-relaxed"
        style={{ color: "var(--ink-soft)" }}
      >
        Helixon is designed to turn candidate documents into structured,
        comparable information that can support the recruiter&apos;s review.
      </p>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main
      className="min-h-screen"
      style={{ background: "var(--mist)" }}
    >
      <MarketingNav active="about" showTagline={false} />

      {/* ── Hero ────────────────────────────────────────────────────────── */}

      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-20 lg:pt-24 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <div>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-full mb-6"
              style={{
                background: "var(--mint)",
                color: "var(--forest)",
              }}
            >
              About Helixon
            </span>

            <h1
              className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5"
              style={{
                color: "var(--ink)",
                fontFamily: "var(--font-display)",
              }}
            >
              Make candidate screening
              <br />
              easier to manage.
            </h1>

            <p
              className="text-sm leading-relaxed mb-8 max-w-md"
              style={{ color: "var(--ink-soft)" }}
            >
              Helixon is designed to help recruiters review candidate
              applications against job requirements, compare relevant
              information and spend less time searching through CVs.
            </p>

            <CtaButtons />
          </div>

          <PileToScore />
        </div>
      </section>

      {/* ── Story / approach ────────────────────────────────────────────── */}

      <section
        className="border-y"
        style={{
          borderColor: "var(--border)",
          background: "white",
        }}
      >
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <p
              className="text-[11px] font-semibold uppercase tracking-widest mb-2"
              style={{ color: "var(--ink-faint)" }}
            >
              The idea
            </p>

            <h2
              className="text-2xl sm:text-3xl font-semibold tracking-tight"
              style={{
                color: "var(--ink)",
                fontFamily: "var(--font-display)",
              }}
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
                    className="text-xs font-semibold"
                    style={{
                      fontFamily: "var(--font-mono)",
                      color: "var(--forest)",
                    }}
                  >
                    0{i + 1}
                  </span>

                  <span
                    className="h-px flex-1"
                    style={{ background: "var(--border)" }}
                  />
                </div>

                <h3
                  className="text-sm font-semibold mb-1.5"
                  style={{ color: "var(--ink)" }}
                >
                  {t.label}
                </h3>

                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--ink-soft)" }}
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
            className="text-[11px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: "var(--ink-faint)" }}
          >
            What we believe
          </p>

          <h2
            className="text-2xl sm:text-3xl font-semibold tracking-tight"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-display)",
            }}
          >
            Three principles behind Helixon
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {VALUES.map((v) => (
            <div
              key={v.title}
              className="rounded-[14px] p-6"
              style={{
                background: "white",
                border: "1px solid var(--border)",
              }}
            >
              <div
                className="w-8 h-8 rounded-[9px] flex items-center justify-center mb-4"
                style={{ background: "var(--mint)" }}
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
                className="text-sm font-semibold mb-1.5"
                style={{ color: "var(--ink)" }}
              >
                {v.title}
              </h3>

              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--ink-soft)" }}
              >
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── About / team ────────────────────────────────────────────────── */}

      <section
        className="border-y"
        style={{
          borderColor: "var(--border)",
          background: "white",
        }}
      >
        <div className="max-w-[1100px] mx-auto px-6 py-16 text-center">
          <p
            className="text-[11px] font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--ink-faint)" }}
          >
            Who&apos;s behind it
          </p>

          <h2
            className="text-xl sm:text-2xl font-semibold tracking-tight mb-4"
            style={{
              color: "var(--ink)",
              fontFamily: "var(--font-display)",
            }}
          >
            Building Helixon around a practical problem
          </h2>

          <p
            className="text-sm leading-relaxed max-w-lg mx-auto"
            style={{ color: "var(--ink-soft)" }}
          >
            Helixon is being developed around a straightforward goal:
            reduce repetitive work in candidate screening while keeping
            recruiters in control of the decisions that matter.
          </p>
        </div>
      </section>

      <CtaBand
        heading="See how Helixon works."
        body="Explore the screening workflow and see how candidate information can be organised against a job specification."
        ctaLabel="Explore Helixon"
      />

      <MarketingFooter />
    </main>
  );
}