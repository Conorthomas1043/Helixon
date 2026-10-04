"use client";

// Part of the candidate profile page (../page.jsx).

import Report from "@/app/analyse/_components/Report";
import { AMBER, CARD, INK, INK_FAINT, INK_MUTED, formatDateOnly } from "@/lib/candidate-format";
import { printSection } from "@/lib/print";
import { useRef, useState } from "react";
import { FieldLabel, SectionHeading } from "./primitives";

export function MatchOverview({ candidate }) {
  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Match overview" title="Why they match" />
      {candidate.status !== "completed" ? (
        <p className="text-sm" style={{ color: INK_MUTED }}>
          {candidate.status === "processing"
            ? "Analysis is still running. Strengths and concerns will appear here once it completes."
            : "This analysis failed, so no match breakdown is available. Retry the analysis from the new-analysis flow."}
        </p>
      ) : (
        <>
          {candidate.matchSummary && (
            <p className="text-sm mb-5" style={{ color: INK_MUTED }}>
              {candidate.matchSummary}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel>Strengths</FieldLabel>
              {candidate.strengths.length === 0 ? (
                <p className="text-[14px]" style={{ color: INK_FAINT }}>None recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {candidate.strengths.map((s) => (
                    <li key={s} className="text-[14px] flex items-start gap-2" style={{ color: INK }}>
                      <span style={{ color: "var(--forest)" }}>✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <FieldLabel>Potential concerns</FieldLabel>
              {candidate.concerns.length === 0 ? (
                <p className="text-[14px]" style={{ color: INK_FAINT }}>No concerns flagged.</p>
              ) : (
                <ul className="space-y-1.5">
                  {candidate.concerns.map((c) => (
                    <li key={c} className="text-[14px] flex items-start gap-2" style={{ color: INK }}>
                      <span style={{ color: AMBER }}>△</span>
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Experience
 * ---------------------------------------------------------------------- */

export function ExperienceSection({ candidate }) {
  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Background" title="Experience" />

      {candidate.skills.length > 0 && (
        <div className="mb-5">
          <FieldLabel>Skills</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {candidate.skills.map((s) => (
              <span key={s} className="text-[12px] px-2 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_MUTED }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {candidate.workHistory.length > 0 && (
        <div className="mb-5">
          <FieldLabel>Work history</FieldLabel>
          <ul className="space-y-3">
            {candidate.workHistory.map((w, i) => (
              <li key={i}>
                <p className="text-sm font-semibold" style={{ color: INK }}>
                  {w.title} <span style={{ color: INK_MUTED, fontWeight: 500 }}>· {w.company}</span>
                </p>
                <p className="text-[12px]" style={{ color: INK_FAINT }}>
                  {w.start}{w.end ? ` – ${w.end}` : ""}
                </p>
                {w.description && (
                  <p className="text-[14px] mt-1" style={{ color: INK_MUTED }}>
                    {w.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidate.education.length > 0 && (
        <div>
          <FieldLabel>Education</FieldLabel>
          <ul className="space-y-1.5">
            {candidate.education.map((e, i) => (
              <li key={i} className="text-[14px]" style={{ color: INK }}>
                {e.degree}
                {e.school && <span style={{ color: INK_MUTED }}> · {e.school}</span>}
                {e.years && <span style={{ color: INK_FAINT }}> ({e.years})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidate.skills.length === 0 && candidate.workHistory.length === 0 && candidate.education.length === 0 && (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>
          No background details on file yet.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Documents
 * ---------------------------------------------------------------------- */

export function FullAnalysis({ analysis, candidateName }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  if (!analysis?.report) return null;
  const role = [analysis.jobTitle, analysis.jobClient].filter(Boolean).join(" @ ");

  // Opens the report first if it's collapsed, then prints just this box -
  // "Save as PDF" in the dialog gives a copy to send a client.
  function print() {
    setOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => printSection(boxRef.current)));
  }

  return (
    <div ref={boxRef} className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading
        eyebrow={candidateName ? `Full analysis · ${candidateName}` : "Full analysis"}
        title="Screening report"
        action={
          <span className="flex items-center gap-3 print-hide">
            <button
              type="button"
              onClick={print}
              className="text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
              style={{ color: INK_MUTED }}
              title="Print, or choose Save as PDF to send it"
            >
              Print / PDF
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
              style={{ color: "var(--forest)" }}
            >
              {open ? "Hide report" : "Show full report"}
            </button>
          </span>
        }
      />
      <p className="text-[13.5px]" style={{ color: INK_MUTED }}>
        Score breakdown, requirements met, skills, red flags, interview questions and salary estimate
        {role ? ` for ${role}` : ""}
        {analysis.analysedAt ? `, analysed ${formatDateOnly(analysis.analysedAt)}` : ""}.
      </p>
      {open && (
        <div className="mt-5">
          <Report result={analysis.report} roleLabel={analysis.jobTitle || "this role"} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Email - draft, edit and send an AI-written email about this candidate,
 * any time (it used to be offered only on the Analyse screen after a run).
 * ---------------------------------------------------------------------- */
