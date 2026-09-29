"use client";

// "See a real analysis" on the marketing homepage: a full example of the
// report Helixon produces, built from sample data (not a live embed of the
// authenticated app). Three example roles - frontline, office, care - so
// it's visible at a glance that it isn't only for tech hiring. Everything
// shown mirrors what the real report contains: score and breakdown,
// requirement-by-requirement depth with the CV quote behind a match,
// must-haves (met / to confirm), pay guide, strengths, concerns and an
// interview question.

import { useState } from "react";
import useRovingTabs from "@/lib/hooks/useRovingTabs";

const EXAMPLES = [
  {
    id: "warehouse",
    tab: "Warehouse Operative",
    kind: "Hourly · nights",
    role: "Warehouse Operative",
    client: "Distribution centre, Leeds",
    candidate: "Amy Clarke",
    current: "Picker Packer · Shopfast",
    score: 88,
    verdict: "Strong match",
    breakdown: [
      { label: "Required skills", value: 41, max: 45 },
      { label: "Experience", value: 25, max: 25 },
      { label: "Nice to have", value: 10, max: 15 },
      { label: "Industry", value: 8, max: 10 },
      { label: "Career", value: 4, max: 5 },
    ],
    requirements: [
      { skill: "Order picking", importance: "Critical", status: "Expert" },
      { skill: "RF scanner", status: "Used" },
      { skill: "Stock control", status: "Shown in CV", quote: "Ran weekly stock counts across three aisles" },
      { skill: "Counterbalance forklift", status: "Missing" },
    ],
    mustHaves: [
      { text: "Right to work in the UK", status: "To confirm" },
      { text: "Available for night shifts", status: "Met", note: "Stated on the CV" },
    ],
    pay: "£12.60–£13.10 an hour",
    payNote: "Middle of the advertised range, for 4 years' relevant experience",
    strengths: ["4 years in a busy distribution centre", "Employee of the month, twice", "Trained new starters on the scanners"],
    concerns: ["No forklift licence mentioned"],
    question: "Your CV doesn't mention a forklift licence — have you driven a counterbalance before?",
  },
  {
    id: "sales",
    tab: "Sales Executive",
    kind: "Salaried · hybrid",
    role: "Sales Executive",
    client: "B2B software, Manchester",
    candidate: "Jordan Patel",
    current: "Account Executive · Brightline",
    score: 82,
    verdict: "Strong match",
    breakdown: [
      { label: "Required skills", value: 30, max: 35 },
      { label: "Experience", value: 18, max: 20 },
      { label: "Nice to have", value: 11, max: 15 },
      { label: "Industry", value: 8, max: 10 },
      { label: "Career", value: 8, max: 10 },
      { label: "Achievements", value: 7, max: 10 },
    ],
    requirements: [
      { skill: "B2B sales", importance: "Critical", status: "Expert" },
      { skill: "Negotiation", status: "Shown in CV", quote: "Negotiated three-year contracts worth £1.2m" },
      { skill: "CRM (Salesforce)", status: "Used" },
      { skill: "Cold calling", status: "Listed only" },
    ],
    mustHaves: [
      { text: "Full UK driving licence", status: "Met" },
      { text: "Right to work in the UK", status: "To confirm" },
    ],
    pay: "£32,000–£36,000 a year",
    payNote: "Upper half of the advertised range, for 5 years in B2B sales",
    strengths: ["Hit 118% of quota two years running", "Promoted from SDR to Account Executive", "Owns deals end to end"],
    concerns: ["Cold calling is listed, but no outbound work is described"],
    question: "Talk me through your outbound routine — how many calls a day, and what's your connect rate?",
  },
  {
    id: "care",
    tab: "Care Assistant",
    kind: "Shifts · weekends",
    role: "Care Assistant",
    client: "Residential care home, Bristol",
    candidate: "Grace Okafor",
    current: "Care Assistant · Meadowview",
    score: 91,
    verdict: "Strong match",
    breakdown: [
      { label: "Required skills", value: 42, max: 45 },
      { label: "Experience", value: 25, max: 25 },
      { label: "Nice to have", value: 11, max: 15 },
      { label: "Industry", value: 9, max: 10 },
      { label: "Career", value: 4, max: 5 },
    ],
    requirements: [
      { skill: "Personal care", importance: "Critical", status: "Shown in CV", quote: "Supported 12 residents with personal care and mobility each shift" },
      { skill: "Dementia care", status: "Expert" },
      { skill: "Medication administration", status: "Used" },
      { skill: "Care Certificate", status: "Used" },
    ],
    mustHaves: [
      { text: "Enhanced DBS check", status: "Met", note: "Stated on the CV" },
      { text: "Available weekends", status: "To confirm" },
    ],
    pay: "£12.00–£12.60 an hour",
    payNote: "Middle of the typical range for the role and area",
    strengths: ["3 years on a dementia unit", "Trusted with medication rounds", "Care Certificate and NVQ Level 2"],
    concerns: ["Weekend availability isn't stated"],
    question: "The role includes alternate weekends — does that work for you?",
  },
];

const STATUS_STYLE = {
  Expert: { bg: "var(--mint)", fg: "var(--forest)", border: "#cfe6da", icon: "✓" },
  Used: { bg: "var(--mint)", fg: "var(--forest)", border: "#cfe6da", icon: "✓" },
  "Shown in CV": { bg: "var(--mint)", fg: "var(--forest)", border: "#cfe6da", icon: "✓" },
  "Listed only": { bg: "#fdf6e9", fg: "#8a5a12", border: "#f1dfbc", icon: "✓" },
  Missing: { bg: "#fbefed", fg: "#a83226", border: "#f2d2cd", icon: "✕" },
  Met: { bg: "var(--mint)", fg: "var(--forest)", border: "#cfe6da", icon: "✓" },
  "To confirm": { bg: "white", fg: "var(--ink-soft)", border: "var(--border)", icon: "?" },
};

function Pill({ status }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
    >
      <span aria-hidden="true">{s.icon}</span>
      {status}
    </span>
  );
}

function Label({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-faint)" }}>
      {children}
    </p>
  );
}

function ScoreRing({ score }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-[88px] h-[88px] shrink-0">
      <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--border-soft)" strokeWidth="7" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="var(--forest)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          transform="rotate(-90 44 44)"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[24px] font-semibold leading-none tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--forest)" }}>
          {score}
        </span>
        <span className="text-[10px] mt-0.5" style={{ color: "var(--ink-faint)" }}>/ 100</span>
      </span>
    </div>
  );
}

function Report({ ex }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
      {/* Left: the verdict */}
      <div className="p-5 sm:p-6" style={{ borderRight: "1px solid var(--border-soft)" }}>
        <div className="flex items-center gap-4">
          <ScoreRing score={ex.score} />
          <div className="min-w-0">
            <p className="text-[15px] font-semibold truncate" style={{ color: "var(--ink)" }}>{ex.candidate}</p>
            <p className="text-[11.5px] truncate" style={{ color: "var(--ink-faint)" }}>{ex.current}</p>
            <span className="inline-block mt-2 text-[10.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }}>
              {ex.verdict}
            </span>
          </div>
        </div>

        <div className="mt-6">
          <Label>How the score adds up</Label>
          <ul className="space-y-2.5">
            {ex.breakdown.map((b) => (
              <li key={b.label}>
                <div className="flex items-baseline justify-between text-[11.5px]">
                  <span style={{ color: "var(--ink-soft)" }}>{b.label}</span>
                  <span className="tabular-nums" style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
                    {b.value}<span style={{ color: "var(--ink-faint)" }}>/{b.max}</span>
                  </span>
                </div>
                <div className="h-[5px] rounded-full mt-1 overflow-hidden" style={{ background: "var(--border-soft)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(b.value / b.max) * 100}%`, background: "var(--forest)", transition: "width 0.7s cubic-bezier(0.16, 1, 0.3, 1)" }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-[10px] p-3" style={{ background: "var(--mist)" }}>
          <Label>Pay guide</Label>
          <p className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{ex.pay}</p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--ink-faint)" }}>{ex.payNote}</p>
        </div>
      </div>

      {/* Right: the evidence */}
      <div className="p-5 sm:p-6 space-y-5">
        <div>
          <Label>Requirements</Label>
          <ul className="divide-y divide-[var(--border-soft)]">
            {ex.requirements.map((r) => (
              <li key={r.skill} className="py-2 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12.5px] min-w-0" style={{ color: "var(--ink)" }}>
                    {r.skill}
                    {r.importance && (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>{r.importance}</span>
                    )}
                  </span>
                  <Pill status={r.status} />
                </div>
                {r.quote && (
                  <p className="text-[11px] italic mt-1" style={{ color: "var(--ink-faint)" }}>
                    From the CV: &ldquo;{r.quote}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <Label>Must-haves</Label>
          <ul className="space-y-1.5">
            {ex.mustHaves.map((m) => (
              <li key={m.text} className="flex items-center justify-between gap-3">
                <span className="text-[12.5px]" style={{ color: "var(--ink)" }}>
                  {m.text}
                  {m.note && <span className="block text-[10.5px]" style={{ color: "var(--ink-faint)" }}>{m.note}</span>}
                </span>
                <Pill status={m.status} />
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Strengths</Label>
            <ul className="space-y-1">
              {ex.strengths.map((s) => (
                <li key={s} className="text-[11.5px] flex gap-1.5" style={{ color: "var(--ink-soft)" }}>
                  <span style={{ color: "var(--forest)" }}>✓</span>{s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Label>Worth a second look</Label>
            <ul className="space-y-1">
              {ex.concerns.map((s) => (
                <li key={s} className="text-[11.5px] flex gap-1.5" style={{ color: "var(--ink-soft)" }}>
                  <span style={{ color: "var(--score-mid)" }} aria-hidden="true">△</span>{s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-[10px] p-3" style={{ border: "1px dashed var(--border)" }}>
          <Label>Suggested interview question</Label>
          <p className="text-[12px] leading-relaxed" style={{ color: "var(--ink)" }}>{ex.question}</p>
        </div>
      </div>
    </div>
  );
}

export default function AnalysisExample() {
  const [active, setActive] = useState(0);
  const ex = EXAMPLES[active];
  const { tabProps, panelProps } = useRovingTabs({
    idPrefix: "example-role",
    count: EXAMPLES.length,
    active,
    onChange: setActive,
  });

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2 mb-6" role="tablist" aria-label="Example roles">
        {EXAMPLES.map((e, i) => (
          <button
            key={e.id}
            {...tabProps(i)}
            className="text-left px-4 py-2.5 rounded-[12px] transition-colors min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{
              background: active === i ? "var(--forest)" : "white",
              color: active === i ? "white" : "var(--ink)",
              border: `1px solid ${active === i ? "var(--forest)" : "var(--border)"}`,
            }}
          >
            <span className="block text-[13px] font-semibold leading-tight">{e.tab}</span>
            <span className="block text-[11px] leading-tight mt-0.5" style={{ color: active === i ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }}>
              {e.kind}
            </span>
          </button>
        ))}
      </div>

      <div
        {...panelProps}
        className="rounded-[18px] overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 24px 48px -24px rgba(19,32,27,0.22)" }}
      >
        <div className="flex items-center gap-1.5 px-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)", background: "var(--mist)" }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#e0e5e1" }} aria-hidden="true" />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#e0e5e1" }} aria-hidden="true" />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#e0e5e1" }} aria-hidden="true" />
          <span className="ml-2 text-[11px] truncate" style={{ color: "var(--ink-faint)" }}>
            Analyse · {ex.role} · {ex.client}
          </span>
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: "white", color: "var(--ink-faint)", border: "1px solid var(--border)" }}>
            Example · sample data
          </span>
        </div>
        <div key={ex.id} className="fade-up-in">
          <Report ex={ex} />
        </div>
      </div>
    </div>
  );
}
