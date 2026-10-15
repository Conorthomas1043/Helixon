"use client";

// Part of the candidate profile page (../page.jsx).

import Report from "@/app/analyse/_components/Report";
import { AMBER, CARD, INK, INK_FAINT, INK_MUTED, formatDateOnly } from "@/lib/candidates/format";
import { printSection } from "@/lib/ui/print";
import { useRef, useState } from "react";
import { FieldLabel, SectionHeading } from "./primitives";
import AiWritingNotice from "@/components/dashboard/AiWritingNotice";

export function MatchOverview({ candidate }) {
  return (
    <div className="rounded-card p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Match overview" title="Why they match" />
      {candidate.status !== "completed" ? (
        <p className="text-sm text-[var(--ink-soft)]">
          {candidate.status === "processing"
            ? "Analysis is still running. Strengths and concerns will appear here once it completes."
            : "This analysis failed, so no match breakdown is available. Retry the analysis from the new-analysis flow."}
        </p>
      ) : (
        <>
          {candidate.matchSummary && (
            <p className="text-sm mb-5 text-[var(--ink-soft)]">
              {candidate.matchSummary}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel>Strengths</FieldLabel>
              {candidate.strengths.length === 0 ? (
                <p className="text-14 text-[var(--ink-faint)]">None recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {candidate.strengths.map((s) => (
                    <li key={s} className="text-14 flex items-start gap-2 text-[var(--ink)]">
                      <span className="text-[var(--forest)]">✓</span>
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <FieldLabel>Potential concerns</FieldLabel>
              {candidate.concerns.length === 0 ? (
                <p className="text-14 text-[var(--ink-faint)]">No concerns flagged.</p>
              ) : (
                <ul className="space-y-1.5">
                  {candidate.concerns.map((c) => (
                    <li key={c} className="text-14 flex items-start gap-2 text-[var(--ink)]">
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
    <div className="rounded-card p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Background" title="Experience" />

      {candidate.skills.length > 0 && (
        <div className="mb-5">
          <FieldLabel>Skills</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {candidate.skills.map((s) => (
              <span key={s} className="text-12 px-2 py-0.5 rounded-full bg-[var(--mist)] text-[var(--ink-soft)]">
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
                <p className="text-sm font-semibold text-[var(--ink)]">
                  {w.title} <span className="text-[var(--ink-soft)] font-medium">· {w.company}</span>
                </p>
                <p className="text-12 text-[var(--ink-faint)]">
                  {w.start}{w.end ? ` – ${w.end}` : ""}
                </p>
                {w.description && (
                  <p className="text-14 mt-1 text-[var(--ink-soft)]">
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
              <li key={i} className="text-14 text-[var(--ink)]">
                {e.degree}
                {e.school && <span className="text-[var(--ink-soft)]"> · {e.school}</span>}
                {e.years && <span className="text-[var(--ink-faint)]"> ({e.years})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidate.skills.length === 0 && candidate.workHistory.length === 0 && candidate.education.length === 0 && (
        <p className="text-14 text-[var(--ink-soft)]">
          No background details on file yet.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Documents
 * ---------------------------------------------------------------------- */

export function FullAnalysis({ analysis, candidateName, candidateId = null }) {
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
    <div ref={boxRef} className="rounded-card p-5 sm:p-6" style={CARD}>
      <SectionHeading
        eyebrow={candidateName ? `Full analysis · ${candidateName}` : "Full analysis"}
        title="Screening report"
        action={
          <span className="flex items-center gap-3 print-hide">
            <button
              type="button"
              onClick={print}
              className="text-13 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded text-[var(--ink-soft)]"
              title="Print, or choose Save as PDF to send it"
            >
              Print / PDF
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-13 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded text-[var(--forest)]"
            >
              {open ? "Hide report" : "Show full report"}
            </button>
          </span>
        }
      />
      <p className="text-14 text-[var(--ink-soft)]">
        Score breakdown, requirements met, skills, red flags, interview questions and salary estimate
        {role ? ` for ${role}` : ""}
        {analysis.analysedAt ? `, analysed ${formatDateOnly(analysis.analysedAt)}` : ""}.
      </p>
      {/* Visible while the report is collapsed; the open report shows it too. */}
      {!open && <AiWritingNotice notice={analysis.report.ai_writing} candidateId={candidateId} where="profile" className="mt-4" />}
      {open && (
        <div className="mt-5">
          <Report result={analysis.report} roleLabel={analysis.jobTitle || "this role"} candidateId={candidateId} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Email - draft, edit and send an AI-written email about this candidate,
 * any time, not only on the Analyse screen after a run.
 * ---------------------------------------------------------------------- */
