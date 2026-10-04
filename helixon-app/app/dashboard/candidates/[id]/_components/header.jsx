"use client";

// Part of the candidate profile page (../page.jsx).

import AddToShortlist from "@/components/dashboard/AddToShortlist";
import Link from "next/link";
import PhoneActions from "@/components/dashboard/PhoneActions";
import { AMBER, AMBER_BG, CARD, GREEN_BG, INK, INK_FAINT, INK_MUTED, RED_BG, RED_STRONG, scoreColor, scoreLabel } from "@/lib/candidates/format";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { agoLabel, daysInStage, lastContact, linkedinUrl } from "@/lib/candidates/insights";
import { useNow } from "@/lib/hooks/useNow";
import { useState } from "react";
import { Avatar, CopyButton, ShortcutsHint } from "./primitives";
import { nextStageAfter } from "./utils";

// "Last contacted 12 days ago · In Interview for 7 days" from the timeline.
export function CandidateFacts({ candidate }) {
  const [now] = useState(() => Date.now());
  const contact = lastContact(candidate.activity || []);
  const inStage = daysInStage(candidate, now);
  const stale = !contact || now - contact.at > 14 * 86400000;
  if (!contact && inStage == null) return null;
  return (
    <p className="text-[12.5px] mt-2" style={{ color: INK_FAINT }}>
      <span style={{ color: stale && candidate.stage !== "Placed" && candidate.stage !== "Rejected" ? "var(--score-mid)" : INK_FAINT }}>
        {contact ? `Last contacted ${agoLabel(contact.at, now)}` : "No contact logged yet"}
      </span>
      {inStage != null && candidate.stage && ` · In ${candidate.stage} for ${inStage} day${inStage === 1 ? "" : "s"}`}
    </p>
  );
}

export function ProfileHeader({ candidate, prevId, nextId, onQuickShortlist, onMoveNext, onFocusNote, onDelete, onEdit, onActivityLogged }) {
  const score = candidate.score;
  const now = useNow();
  const overdue = candidate.nextAction && new Date(candidate.nextAction.dueAt).getTime() < now;
  const upcomingStage = candidate.status === "completed" ? nextStageAfter(candidate.stage) : null;

  return (
    <header className="rounded-[16px] p-6 sm:p-8" style={CARD}>
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard/candidates"
          className="text-[13px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
          style={{ color: "var(--forest)" }}
        >
          ← All candidates
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={prevId ? `/dashboard/candidates/${prevId}` : "#"}
            aria-disabled={!prevId}
            className="text-[13px] font-semibold px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: prevId ? INK : INK_FAINT, pointerEvents: prevId ? "auto" : "none" }}
          >
            ← Prev
          </Link>
          <Link
            href={nextId ? `/dashboard/candidates/${nextId}` : "#"}
            aria-disabled={!nextId}
            className="text-[13px] font-semibold px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: nextId ? INK : INK_FAINT, pointerEvents: nextId ? "auto" : "none" }}
          >
            Next →
          </Link>
          <ShortcutsHint />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
        <div className="flex items-start gap-4 min-w-0">
          <Avatar name={candidate.fullName} />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold leading-tight" style={{ fontFamily: "var(--font-display)", color: INK }}>
              {candidate.fullName}
            </h1>
            <p className="text-sm mt-1" style={{ color: INK_MUTED }}>
              {candidate.currentTitle}
              {candidate.currentCompany ? ` @ ${candidate.currentCompany}` : ""}
            </p>
            <p className="text-[13px] mt-1" style={{ color: INK_FAINT }}>
              Assessed for {candidate.jobTitle}
              {candidate.company ? ` @ ${candidate.company}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[13px]" style={{ color: INK_MUTED }}>
              {candidate.location && <span>{candidate.location}</span>}
              {candidate.email && (
                <span className="inline-flex items-center gap-1">
                  <a href={`mailto:${candidate.email}`} className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded">
                    {candidate.email}
                  </a>
                  <CopyButton text={candidate.email} label="Copy email" />
                </span>
              )}
              {candidate.phone && <PhoneActions candidateId={candidate.id} phone={candidate.phone} firstName={(candidate.fullName || "").split(" ")[0]} onLogged={onActivityLogged} />}
              {candidate.linkedin &&
                (linkedinUrl(candidate.linkedin) ? (
                  <a href={linkedinUrl(candidate.linkedin)} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    LinkedIn ↗
                  </a>
                ) : (
                  <span>{candidate.linkedin}</span>
                ))}
            </div>
            <CandidateFacts candidate={candidate} />
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {candidate.status === "completed" ? (
            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums leading-none" style={{ fontFamily: "var(--font-mono)", color: scoreColor(score) }}>
                {score}
              </p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: scoreColor(score) }}>
                {scoreLabel(score)}
              </p>
            </div>
          ) : (
            <div className="text-right">
              <p
                className="text-[12px] font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: candidate.status === "failed" ? RED_BG : AMBER_BG,
                  color: candidate.status === "failed" ? RED_STRONG : AMBER,
                }}
              >
                {candidate.status === "failed" ? "Analysis failed" : "Processing"}
              </p>
            </div>
          )}
          {candidate.stage && (
            <span
              className="text-[12px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{
                background: candidate.stage === "Placed" ? GREEN_BG : "var(--mist)",
                color: candidate.stage === "Placed" ? "var(--forest)" : INK_MUTED,
              }}
            >
              {STAGE_LABELS[candidate.stage]}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-6 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
        {candidate.status === "completed" && candidate.stage !== "Shortlisted" && (
          <button
            type="button"
            onClick={onQuickShortlist}
            className="inline-flex items-center text-[14px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--forest)", color: "white" }}
          >
            Shortlist
          </button>
        )}
        {upcomingStage && (
          <button
            type="button"
            onClick={() => onMoveNext(upcomingStage)}
            className="inline-flex items-center text-[14px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            Move to {STAGE_LABELS[upcomingStage]} →
          </button>
        )}
        <button
          type="button"
          onClick={onFocusNote}
          className="inline-flex items-center text-[14px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Add note
        </button>
        {candidate.status === "completed" && (
          <Link
            href={`/analyse/compare?ids=${candidate.id}`}
            className="inline-flex items-center text-[14px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            Compare with others
          </Link>
        )}
        {candidate.status === "completed" && (
          <AddToShortlist
            candidateIds={[candidate.id]}
            jobId={candidate.jobId}
            defaultName={candidate.jobId ? `${candidate.jobTitle}${candidate.company ? ` - ${candidate.company}` : ""}` : ""}
            className="inline-flex items-center text-[14px] font-semibold px-4 py-2 rounded-full transition-colors border border-[var(--border)] text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        )}
        {candidate.status === "completed" && (
          <Link
            href={`/dashboard/candidates/${candidate.id}/client-profile`}
            className="inline-flex items-center text-[14px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
            title="A client-ready profile you can print or save as PDF - optionally anonymised"
          >
            Client profile
          </Link>
        )}
        {candidate.email && (
          <a
            href={`mailto:${candidate.email}`}
            className="inline-flex items-center text-[14px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            Email candidate
          </a>
        )}
        {candidate.nextAction && (
          <span className="text-[13px]" style={{ color: overdue ? RED_STRONG : INK_MUTED }}>
            {overdue ? "Overdue: " : "Next: "}
            {candidate.nextAction.label}
          </span>
        )}
        {/* Deliberately understated and pushed to the far right - this is a
            permanent, irreversible erasure (see app/api/candidates/[id]'s
            DELETE handler), not a routine action, and shouldn't sit visually
            level with Shortlist/Add note/Email. */}
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center text-[13px] font-semibold px-3 py-1.5 rounded-full transition-colors ml-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Edit details
        </button>
        {/* A plain link download: the export route answers with a JSON file. */}
        <a
          href={`/api/candidates/${candidate.id}/export`}
          download
          className="inline-flex items-center text-[13px] font-medium px-3 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: INK_MUTED }}
          title="Download everything held about this person (every job they've been screened for) - for a subject access or data portability request"
        >
          Export data
        </a>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center text-[13px] font-medium px-3 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: INK_FAINT }}
          title="Permanently erase this candidate's data - e.g. to fulfil a right-to-erasure request"
        >
          Delete candidate
        </button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------------
 * Match overview
 * ---------------------------------------------------------------------- */
