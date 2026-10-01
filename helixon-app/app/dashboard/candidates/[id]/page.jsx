"use client";

// /dashboard/candidates/[id] - one candidate's workspace: why they match, the
// full screening report (rebuilt from their latest saved analysis), their
// CV, activity timeline, stage / owner / tags / next action, outcome
// reporting, feedback links, notes, and AI-drafted emails. Contact details
// read off the CV can be corrected here.
//
// Recently-viewed tracking uses localStorage and stores candidate ids only,
// never CV contents or contact details.

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import DashboardNav from "@/components/DashboardNav";
import AddToShortlist from "@/components/dashboard/AddToShortlist";
import {
  getCandidateById,
  getRecruiters,
  updateCandidateStage,
  assignCandidate,
  addCandidateNote,
  getJobs,
  saveToTalentPool,
  updateTalentPoolEntry,
  removeFromTalentPool,
  rescreenCandidate,
  getTags,
  createTag,
  editCandidateNote,
  deleteCandidateNote,
  addCandidateTag,
  removeCandidateTag,
  setCandidateNextAction,
  completeNextAction,
  deleteCandidate,
  updateCandidateDetails,
  logCandidateActivity,
  getFeedbackRequests,
  createFeedbackRequest,
  emailFeedbackRequest,
  updateCandidateContact,
} from "@/lib/dashboard-api";
import Report from "@/app/analyse/_components/Report";
import { EmailCard } from "@/app/analyse/_components/Rail";
import { Toasts, useToasts } from "@/app/analyse/_components/ui";
import { useEmailComposer } from "@/app/analyse/_lib/useEmailComposer";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { TAG_CATALOG } from "@/lib/tag-catalog";
import { printSection } from "@/lib/print";
import {
  INK,
  INK_MUTED,
  INK_FAINT,
  AMBER,
  AMBER_BG,
  RED,
  RED_STRONG,
  RED_BG,
  GREEN_BG,
  CARD,
  formatDateOnly,
  formatRelativeTime,
  dayBucketLabel,
  formatTime,
  scoreColor,
  scoreLabel,
  initials,
} from "@/lib/candidate-format";

const STAGE_ORDER = Object.keys(STAGE_LABELS);

const RECENTLY_VIEWED_KEY = "helixon:recently-viewed-candidates";

function pushRecentlyViewed(id) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = [id, ...list.filter((x) => x !== id)].slice(0, 8);
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private browsing etc.) - non-critical.
  }
}

function nextStageAfter(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1];
}

function activityDescription(entry) {
  switch (entry.type) {
    case "analysis_completed":
      return entry.meta?.score != null ? `Match score ${entry.meta.score}` : entry.meta?.note ?? "";
    case "stage_changed":
      return `${STAGE_LABELS[entry.meta?.from] ?? "Unassigned"} → ${STAGE_LABELS[entry.meta?.to] ?? "Unknown"}`;
    case "assigned":
      return entry.meta?.from ? `${entry.meta.from} → ${entry.meta.to}` : `Assigned to ${entry.meta?.to ?? "someone"}`;
    case "tag_added":
    case "tag_removed":
      return entry.meta?.tag ?? "";
    case "next_action_set":
    case "next_action_completed":
      return entry.meta?.label ?? "";
    case "call_logged":
    case "email_logged":
    case "meeting_logged":
    case "cv_sent_logged":
    case "details_updated":
    case "data_exported":
    case "retention_extended":
    case "talent_pool_added":
    case "shortlist_added":
    case "shortlist_removed":
    case "feedback_request_sent":
    case "client_profile_printed":
      return entry.meta?.note ?? "";
    case "rescreened":
      return entry.meta?.job_title ? `${entry.meta.job_title}${entry.meta.match_score != null ? ` · ${entry.meta.match_score}` : ""}` : "";
    default:
      return "";
  }
}

const EVENT_LABELS = {
  cv_uploaded: "CV uploaded",
  screened: "Screened",
  cv_viewed: "CV opened",
  cv_downloaded: "CV downloaded",
  analysis_completed: "Analysis completed",
  stage_changed: "Stage changed",
  assigned: "Assigned",
  tag_added: "Tag added",
  tag_removed: "Tag removed",
  note_added: "Note added",
  next_action_set: "Next action set",
  next_action_completed: "Next action completed",
  call_logged: "Call logged",
  email_logged: "Email logged",
  meeting_logged: "Meeting logged",
  cv_sent_logged: "CV sent",
  details_updated: "Details edited",
  talent_pool_added: "Saved to talent pool",
  talent_pool_removed: "Removed from talent pool",
  rescreened: "Screened for another job",
  data_exported: "Data exported",
  talent_pool_expired: "Left the talent pool (retention policy)",
  retention_extended: "Kept past the retention period",
  shortlist_added: "Added to shortlist",
  shortlist_removed: "Removed from shortlist",
  feedback_request_sent: "Feedback request emailed",
  client_profile_printed: "Client profile printed",
};

const OUTREACH_ACTIONS = [
  { type: "call_logged", label: "Log a call" },
  { type: "email_logged", label: "Log an email" },
  { type: "meeting_logged", label: "Log a meeting" },
  { type: "cv_sent_logged", label: "Log CV sent" },
];

/* ------------------------------------------------------------------------
 * Shared bits
 * ---------------------------------------------------------------------- */

// Creates one of the agency's own tags and puts it on this candidate.
function NewTagForm({ onCreate }) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="flex items-center gap-1 mt-1 pt-1.5"
      style={{ borderTop: "1px solid var(--border)" }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!label.trim() || saving) return;
        setSaving(true);
        const ok = await onCreate(label);
        setSaving(false);
        if (ok) setLabel("");
      }}
    >
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={30}
        placeholder="New tag…"
        aria-label="New tag name"
        className="min-w-0 flex-1 text-[12px] px-2 py-1 rounded-[6px] focus-visible:outline focus-visible:outline-2"
        style={{ border: "1px solid var(--border)", color: INK }}
      />
      <button type="submit" disabled={!label.trim() || saving} className="text-[11px] font-semibold px-2 py-1 rounded-[6px] disabled:opacity-40" style={{ color: "var(--forest)" }}>
        {saving ? "…" : "Add"}
      </button>
    </form>
  );
}

function SectionHeading({ eyebrow, title, action }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div>
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
            {eyebrow}
          </p>
        )}
        <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function Avatar({ name, size = 56 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold"
      style={{ width: size, height: size, background: "var(--mist)", color: "var(--forest)", fontSize: size / 3.2 }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>
      {children}
    </p>
  );
}

function SelectField({ value, onChange, options, ariaLabel, disabled }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-sm px-3 py-2 rounded-[10px] bg-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{ border: "1px solid var(--border)", color: INK }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ShortcutsHint() {
  return (
    <details className="relative">
      <summary
        className="list-none cursor-pointer text-[11px] font-semibold px-2.5 py-1.5 rounded-full select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ border: "1px solid var(--border)", color: INK_MUTED }}
      >
        Shortcuts
      </summary>
      <div
        className="absolute right-0 mt-2 w-60 rounded-[10px] p-3 z-20 text-[12px] space-y-2"
        style={{ ...CARD, boxShadow: "0 12px 32px rgba(19,32,27,0.14)" }}
      >
        <div className="flex justify-between gap-3">
          <span style={{ color: INK_MUTED }}>Next / previous candidate</span>
          <kbd className="font-mono text-[11px]" style={{ color: INK }}>J / K</kbd>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: INK_MUTED }}>Shortlist</span>
          <kbd className="font-mono text-[11px]" style={{ color: INK }}>S</kbd>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: INK_MUTED }}>Focus note field</span>
          <kbd className="font-mono text-[11px]" style={{ color: INK }}>N</kbd>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: INK_MUTED }}>Close menus</span>
          <kbd className="font-mono text-[11px]" style={{ color: INK }}>Esc</kbd>
        </div>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------------
 * Header
 * ---------------------------------------------------------------------- */

function ProfileHeader({ candidate, prevId, nextId, onQuickShortlist, onMoveNext, onFocusNote, onDelete, onEdit }) {
  const score = candidate.score;
  const overdue = candidate.nextAction && new Date(candidate.nextAction.dueAt).getTime() < Date.now();
  const upcomingStage = candidate.status === "completed" ? nextStageAfter(candidate.stage) : null;

  return (
    <header className="rounded-[16px] p-6 sm:p-8" style={CARD}>
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/dashboard/candidates"
          className="text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
          style={{ color: "var(--forest)" }}
        >
          ← All candidates
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={prevId ? `/dashboard/candidates/${prevId}` : "#"}
            aria-disabled={!prevId}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: prevId ? INK : INK_FAINT, pointerEvents: prevId ? "auto" : "none" }}
          >
            ← Prev
          </Link>
          <Link
            href={nextId ? `/dashboard/candidates/${nextId}` : "#"}
            aria-disabled={!nextId}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
            <p className="text-[12px] mt-1" style={{ color: INK_FAINT }}>
              Assessed for {candidate.jobTitle}
              {candidate.company ? ` @ ${candidate.company}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[12px]" style={{ color: INK_MUTED }}>
              {candidate.location && <span>{candidate.location}</span>}
              {candidate.email && (
                <a href={`mailto:${candidate.email}`} className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded">
                  {candidate.email}
                </a>
              )}
              {candidate.phone && <span>{candidate.phone}</span>}
              {candidate.linkedin && <span>{candidate.linkedin}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {candidate.status === "completed" ? (
            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums leading-none" style={{ fontFamily: "var(--font-mono)", color: scoreColor(score) }}>
                {score}
              </p>
              <p className="text-[11px] font-semibold mt-1" style={{ color: scoreColor(score) }}>
                {scoreLabel(score)}
              </p>
            </div>
          ) : (
            <div className="text-right">
              <p
                className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
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
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
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
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--forest)", color: "white" }}
          >
            Shortlist
          </button>
        )}
        {upcomingStage && (
          <button
            type="button"
            onClick={() => onMoveNext(upcomingStage)}
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            Move to {STAGE_LABELS[upcomingStage]} →
          </button>
        )}
        <button
          type="button"
          onClick={onFocusNote}
          className="inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Add note
        </button>
        {candidate.status === "completed" && (
          <Link
            href={`/analyse/compare?ids=${candidate.id}`}
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full transition-colors border border-[var(--border)] text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        )}
        {candidate.status === "completed" && (
          <Link
            href={`/dashboard/candidates/${candidate.id}/client-profile`}
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
            title="A client-ready profile you can print or save as PDF - optionally anonymised"
          >
            Client profile
          </Link>
        )}
        {candidate.email && (
          <a
            href={`mailto:${candidate.email}`}
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            Email candidate
          </a>
        )}
        {candidate.nextAction && (
          <span className="text-[12px]" style={{ color: overdue ? RED_STRONG : INK_MUTED }}>
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
          className="inline-flex items-center text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors ml-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Edit details
        </button>
        {/* A plain link download: the export route answers with a JSON file. */}
        <a
          href={`/api/candidates/${candidate.id}/export`}
          download
          className="inline-flex items-center text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ color: INK_MUTED }}
          title="Download everything held about this person (every job they've been screened for) - for a subject access or data portability request"
        >
          Export data
        </a>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center text-[12px] font-medium px-3 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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

function MatchOverview({ candidate }) {
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
                <p className="text-[13px]" style={{ color: INK_FAINT }}>None recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {candidate.strengths.map((s) => (
                    <li key={s} className="text-[13px] flex items-start gap-2" style={{ color: INK }}>
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
                <p className="text-[13px]" style={{ color: INK_FAINT }}>No concerns flagged.</p>
              ) : (
                <ul className="space-y-1.5">
                  {candidate.concerns.map((c) => (
                    <li key={c} className="text-[13px] flex items-start gap-2" style={{ color: INK }}>
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

function ExperienceSection({ candidate }) {
  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Background" title="Experience" />

      {candidate.skills.length > 0 && (
        <div className="mb-5">
          <FieldLabel>Skills</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {candidate.skills.map((s) => (
              <span key={s} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_MUTED }}>
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
                <p className="text-[11px]" style={{ color: INK_FAINT }}>
                  {w.start}{w.end ? ` – ${w.end}` : ""}
                </p>
                {w.description && (
                  <p className="text-[13px] mt-1" style={{ color: INK_MUTED }}>
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
              <li key={i} className="text-[13px]" style={{ color: INK }}>
                {e.degree}
                {e.school && <span style={{ color: INK_MUTED }}> · {e.school}</span>}
                {e.years && <span style={{ color: INK_FAINT }}> ({e.years})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidate.skills.length === 0 && candidate.workHistory.length === 0 && candidate.education.length === 0 && (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>
          No background details on file yet.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Documents
 * ---------------------------------------------------------------------- */

function DocumentsSection({ candidate }) {
  const [busy, setBusy] = useState(null); // "view" | "download" | "text"
  const [error, setError] = useState("");
  const [text, setText] = useState(null);
  const [showText, setShowText] = useState(false);
  const [copied, setCopied] = useState(false);
  const resume = candidate.resume;
  const isPdf = /\.pdf$/i.test(resume?.name || "");

  // A blind screen hid who the candidate is while scoring - opening the
  // original shows their name, so it's a deliberate step, not a stray click.
  function confirmUnblind() {
    if (!candidate.screenedBlind) return true;
    return confirm("This candidate was screened blind. The original CV shows their name and contact details. Open it anyway?");
  }

  async function openFile(download) {
    if (!confirmUnblind()) return;
    setError("");
    setBusy(download ? "download" : "view");
    // Opened before the request so browsers don't treat it as a pop-up.
    const tab = download ? null : window.open("", "_blank");
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/cv${download ? "?download=1" : ""}`, { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) throw new Error(data?.error || "Couldn't open the CV.");
      if (tab) tab.location.href = data.url;
      else window.location.href = data.url;
    } catch (err) {
      tab?.close();
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleText() {
    if (showText) {
      setShowText(false);
      return;
    }
    if (text == null) {
      setBusy("text");
      setError("");
      try {
        const res = await fetch(`/api/candidates/${candidate.id}/cv?format=text`, { credentials: "include" });
        const data = await res.json().catch(() => null);
        if (!res.ok || typeof data?.text !== "string") throw new Error(data?.error || "Couldn't load the CV text.");
        setText(data.text);
      } catch (err) {
        setError(err.message);
        setBusy(null);
        return;
      }
      setBusy(null);
    }
    setShowText(true);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy - select the text and copy it instead.");
    }
  }

  const buttonClass =
    "inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full transition disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Documents" title="CV & documents" />

      {resume ? (
        <div className="flex flex-wrap items-center gap-4 rounded-[12px] p-4" style={{ background: "var(--mist)" }}>
          <span
            className="w-10 h-12 rounded-[6px] flex items-center justify-center shrink-0 text-[10px] font-bold tracking-wide"
            style={{ background: "white", border: "1px solid var(--border)", color: isPdf ? "#b42318" : "#1d4ed8" }}
            aria-hidden="true"
          >
            {isPdf ? "PDF" : "DOCX"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate" style={{ color: INK }}>
              {resume.name}
            </p>
            <p className="text-[12px]" style={{ color: INK_MUTED }}>
              Uploaded {formatDateOnly(resume.uploadedAt)}
              {candidate.screenedBlind ? " · screened blind" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openFile(false)}
              disabled={busy !== null}
              className={buttonClass}
              style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
              title={isPdf ? "Open in a new tab" : "Word files download to open in Word"}
            >
              {busy === "view" ? "Opening…" : "Open"}
            </button>
            <button
              type="button"
              onClick={() => openFile(true)}
              disabled={busy !== null}
              className={buttonClass}
              style={{ background: "var(--forest)", color: "white" }}
            >
              {busy === "download" ? "Preparing…" : "Download"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>
          {candidate.hasCvText
            ? "The original file wasn't kept for this candidate - they were analysed before Helixon stored CVs. The CV text is below."
            : "No CV on file."}
        </p>
      )}

      {candidate.hasCvText && (
        <div className="mt-3">
          <button
            type="button"
            onClick={toggleText}
            disabled={busy === "text"}
            className="text-[12px] font-semibold rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ color: "var(--forest)" }}
            aria-expanded={showText}
          >
            {busy === "text" ? "Loading…" : showText ? "Hide CV text" : "View CV text"}
          </button>
          {showText && text != null && (
            <div className="mt-2 rounded-[10px]" style={{ border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <span className="text-[11px]" style={{ color: INK_FAINT }}>Text read from the CV - formatting isn&apos;t kept</span>
                <button type="button" onClick={copyText} className="text-[11px] font-semibold" style={{ color: INK_MUTED }}>
                  {copied ? "Copied" : "Copy text"}
                </button>
              </div>
              <pre
                className="max-h-[420px] overflow-auto whitespace-pre-wrap px-3 py-2.5 text-[12.5px] leading-relaxed"
                style={{ color: INK, fontFamily: "inherit" }}
              >
                {text}
              </pre>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-[12px] mt-3" style={{ color: "var(--score-low)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Activity timeline
 * ---------------------------------------------------------------------- */

function ActivityTimeline({ activity }) {
  const groups = useMemo(() => {
    const byDay = new Map();
    activity.forEach((entry) => {
      const label = dayBucketLabel(entry.timestamp);
      if (!byDay.has(label)) byDay.set(label, []);
      byDay.get(label).push(entry);
    });
    return Array.from(byDay.entries());
  }, [activity]);

  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="History" title="Activity" />
      {groups.length === 0 ? (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>
          Activity will appear here as the team works this candidate.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map(([day, entries]) => (
            <div key={day}>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-2.5" style={{ color: INK_FAINT }}>
                {day}
              </p>
              <ul className="space-y-3">
                {entries.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3">
                    <span
                      className="text-[11px] tabular-nums shrink-0 w-11 pt-0.5"
                      style={{ fontFamily: "var(--font-mono)", color: INK_FAINT }}
                    >
                      {formatTime(entry.timestamp)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold" style={{ color: INK }}>
                        {entry.meta?.sent_via === "helixon" ? "Email sent" : EVENT_LABELS[entry.type] ?? entry.type}
                      </p>
                      <p className="text-[12px]" style={{ color: INK_MUTED }}>
                        {activityDescription(entry)}
                        {entry.actor ? ` · ${entry.actor}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Recruiter workspace (stage / recruiter / tags / next action)
 * ---------------------------------------------------------------------- */

function RecruiterWorkspace({ candidate, recruiters, tags, onStageChange, onAssign, onAddTag, onRemoveTag, onCreateTag, onSetNextAction, onCompleteNextAction, onLogActivity, loggingActivity }) {
  const [nextActionLabel, setNextActionLabel] = useState("");
  const [nextActionDue, setNextActionDue] = useState("");
  const overdue = candidate.nextAction && new Date(candidate.nextAction.dueAt).getTime() < Date.now();
  const availableTags = tags.filter((t) => !candidate.tags.includes(t.id));

  return (
    <div className="rounded-[14px] p-5 sm:p-6 space-y-5" style={CARD}>
      <SectionHeading eyebrow="Recruiter workspace" title="Manage this candidate" />

      <div>
        <FieldLabel>Log outreach</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {OUTREACH_ACTIONS.map((a) => (
            <button
              key={a.type}
              type="button"
              onClick={() => onLogActivity(a.type)}
              disabled={loggingActivity === a.type}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full transition disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
            >
              {loggingActivity === a.type ? "Logging…" : a.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] mt-1.5" style={{ color: INK_FAINT }}>
          Records that you did this, for your own activity metrics - not sent from Helixon.
        </p>
      </div>

      <div>
        <FieldLabel>Stage</FieldLabel>
        <SelectField
          ariaLabel="Candidate stage"
          value={candidate.stage ?? ""}
          onChange={onStageChange}
          disabled={candidate.status !== "completed"}
          options={
            candidate.stage
              ? STAGE_ORDER.map((k) => ({ value: k, label: STAGE_LABELS[k] }))
              : [{ value: "", label: "Not yet analysed" }]
          }
        />
      </div>

      <div>
        <FieldLabel>Recruiter</FieldLabel>
        <SelectField
          ariaLabel="Assigned recruiter"
          value={candidate.recruiterId ?? ""}
          onChange={onAssign}
          options={[{ value: "", label: "Unassigned" }, ...recruiters.map((r) => ({ value: r.id, label: r.name }))]}
        />
      </div>

      <div>
        <FieldLabel>Tags</FieldLabel>
        <div className="flex flex-wrap items-center gap-1.5">
          {candidate.tags.map((tagId) => {
            const t = tags.find((x) => x.id === tagId);
            return (
              <span
                key={tagId}
                className="inline-flex items-center gap-1 text-[11px] font-semibold pl-2.5 pr-1.5 py-1 rounded-full"
                style={{ background: "var(--mist)", color: INK_MUTED }}
              >
                {t?.label ?? tagId}
                <button
                  type="button"
                  onClick={() => onRemoveTag(tagId)}
                  aria-label={`Remove tag ${t?.label ?? tagId}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  ×
                </button>
              </span>
            );
          })}
          <details className="relative">
            <summary
              className="list-none cursor-pointer text-[11px] font-semibold px-2.5 py-1 rounded-full select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px dashed var(--border)", color: "var(--forest)" }}
            >
              + Add tag
            </summary>
            <div className="absolute left-0 mt-2 w-48 rounded-[10px] p-1.5 z-20" style={{ ...CARD, boxShadow: "0 12px 32px rgba(19,32,27,0.14)" }}>
              <div className="max-h-56 overflow-y-auto">
                {availableTags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onAddTag(t.id)}
                    className="w-full text-left text-[12px] px-2.5 py-1.5 rounded-[8px] hover:bg-[var(--mist)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ color: INK }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <NewTagForm onCreate={onCreateTag} />
            </div>
          </details>
        </div>
      </div>

      <div>
        <FieldLabel>Next action</FieldLabel>
        {candidate.nextAction ? (
          <div className="flex items-start justify-between gap-3 rounded-[10px] p-3" style={{ background: overdue ? RED_BG : "var(--mist)" }}>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: INK }}>
                {candidate.nextAction.label}
              </p>
              <p className="text-[11px]" style={{ color: overdue ? RED_STRONG : INK_MUTED }}>
                {overdue ? "Overdue · " : "Due "}
                {formatDateOnly(candidate.nextAction.dueAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={onCompleteNextAction}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
            >
              Mark done
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!nextActionLabel.trim()) return;
              onSetNextAction({ label: nextActionLabel, dueAt: nextActionDue ? new Date(nextActionDue).toISOString() : null });
              setNextActionLabel("");
              setNextActionDue("");
            }}
            className="space-y-2"
          >
            <input
              type="text"
              value={nextActionLabel}
              onChange={(e) => setNextActionLabel(e.target.value)}
              placeholder="e.g. Call candidate"
              className="w-full text-sm px-3 py-2 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK }}
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={nextActionDue}
                onChange={(e) => setNextActionDue(e.target.value)}
                className="flex-1 text-sm px-3 py-2 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--border)", color: INK }}
              />
              <button
                type="submit"
                disabled={!nextActionLabel.trim()}
                className="text-[12px] font-semibold px-3 py-2 rounded-[10px] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: "var(--forest)", color: "white" }}
              >
                Add
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Outcome reporting (source of hire, rejection reason, placement fee/cost,
 * 30/90-day retention) - all self-reported, all feeding the agency-level
 * figures on /dashboard/analytics. None of it is inferred or automated.
 * ---------------------------------------------------------------------- */

const SOURCE_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "referral", label: "Referral" },
  { value: "job_board", label: "Job board" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "direct_sourcing", label: "Direct sourcing" },
  { value: "agency_database", label: "Agency database" },
  { value: "other", label: "Other" },
];

const REJECTION_REASON_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "unrealistic_requirements", label: "Unrealistic requirements" },
  { value: "compensation", label: "Compensation mismatch" },
  { value: "culture_fit", label: "Culture fit" },
  { value: "skills_gap", label: "Skills gap" },
  { value: "slow_process", label: "Process too slow" },
  { value: "candidate_withdrew", label: "Candidate withdrew" },
  { value: "client_declined", label: "Client declined" },
  { value: "role_closed", label: "Role closed" },
  { value: "other", label: "Other" },
];

function RetentionToggle({ value, onChange }) {
  const options = [
    { value: "retained", label: "Still there" },
    { value: "left", label: "Left" },
  ];
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(value === o.value ? null : o.value)}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={
            value === o.value
              ? { background: o.value === "retained" ? "var(--forest)" : RED, color: "white" }
              : { border: "1px solid var(--border)", color: INK_MUTED, background: "white" }
          }
        >
          {o.label}
        </button>
      ))}
      {!value && (
        <span className="text-[11px]" style={{ color: INK_FAINT }}>
          Not checked yet
        </span>
      )}
    </div>
  );
}

function OutcomeReportingPanel({ candidate, onUpdateDetails }) {
  const [fee, setFee] = useState(candidate.placementFee ?? "");
  const [cost, setCost] = useState(candidate.placementCost ?? "");

  useEffect(() => {
    setFee(candidate.placementFee ?? "");
    setCost(candidate.placementCost ?? "");
  }, [candidate.placementFee, candidate.placementCost]);

  const isRejected = candidate.stage === "Rejected";
  const isPlaced = candidate.stage === "Placed";

  return (
    <div className="rounded-[14px] p-5 sm:p-6 space-y-5" style={CARD}>
      <SectionHeading eyebrow="Reporting" title="Source & outcome" />

      <div>
        <FieldLabel>Source of hire</FieldLabel>
        <SelectField
          ariaLabel="Source of hire"
          value={candidate.source ?? ""}
          onChange={(v) => onUpdateDetails({ source: v || null })}
          options={SOURCE_OPTIONS}
        />
      </div>

      {isRejected && (
        <div>
          <FieldLabel>Why did this fall through?</FieldLabel>
          <SelectField
            ariaLabel="Rejection reason"
            value={candidate.rejectionReason ?? ""}
            onChange={(v) => onUpdateDetails({ rejectionReason: v || null })}
            options={REJECTION_REASON_OPTIONS}
          />
          <p className="text-[11px] mt-1.5" style={{ color: INK_FAINT }}>
            Feeds the &quot;why we lose candidates&quot; breakdown in Analytics - add detail in Notes if useful.
          </p>
        </div>
      )}

      {isPlaced && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Fee earned</FieldLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                onBlur={() => onUpdateDetails({ placementFee: fee === "" ? null : Number(fee) })}
                placeholder="0.00"
                className="w-full text-sm px-3 py-2 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--border)", color: INK }}
              />
            </div>
            <div>
              <FieldLabel>Cost attributed</FieldLabel>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                onBlur={() => onUpdateDetails({ placementCost: cost === "" ? null : Number(cost) })}
                placeholder="0.00"
                className="w-full text-sm px-3 py-2 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--border)", color: INK }}
              />
            </div>
          </div>
          <p className="text-[11px] -mt-3" style={{ color: INK_FAINT }}>
            Self-reported - feeds fee income/margin figures in Analytics. Helixon has no way to verify these.
          </p>

          <div>
            <FieldLabel>Still placed, 30 days on?</FieldLabel>
            <RetentionToggle value={candidate.retention30d} onChange={(v) => onUpdateDetails({ retention30d: v })} />
          </div>
          <div>
            <FieldLabel>Still placed, 90 days on?</FieldLabel>
            <RetentionToggle value={candidate.retention90d} onChange={(v) => onUpdateDetails({ retention90d: v })} />
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Feedback requests (candidate NPS + hiring-manager/client feedback)
 * ---------------------------------------------------------------------- */

const FEEDBACK_KINDS = {
  candidate_nps: { button: "Request candidate feedback", title: "Candidate feedback" },
  client_feedback: { button: "Request client feedback", title: "Client feedback" },
};

// "Send to" form for a feedback link - pre-filled with the candidate's email
// or the job's client contact. Sending is optional: "Just create link" makes
// the link to copy and send yourself.
function FeedbackSendForm({ defaultTo, busy, onSend, onLinkOnly, onCancel }) {
  const [to, setTo] = useState(defaultTo || "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (to.trim()) onSend(to.trim());
      }}
      className="flex flex-wrap items-center gap-2 p-3 rounded-[10px]"
      style={{ background: "var(--mist)" }}
    >
      <input
        type="email"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="name@example.com"
        aria-label="Send the link to"
        autoFocus
        className="flex-1 min-w-[180px] text-[12px] px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2"
        style={{ border: "1px solid var(--border)", color: INK }}
      />
      <button
        type="submit"
        disabled={busy || !to.trim()}
        className="text-[12px] font-semibold px-3 py-1.5 rounded-full disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--forest)", color: "white" }}
      >
        {busy ? "Sending…" : "Send email"}
      </button>
      {onLinkOnly && (
        <button type="button" onClick={onLinkOnly} disabled={busy} className="text-[12px] font-semibold disabled:opacity-50" style={{ color: INK }}>
          Just create link
        </button>
      )}
      <button type="button" onClick={onCancel} disabled={busy} className="text-[12px] font-semibold" style={{ color: INK_MUTED }}>
        Cancel
      </button>
    </form>
  );
}

function FeedbackRequestsPanel({ requests, onCreate, onEmail, creating, candidateEmail, clientEmail }) {
  const [copiedId, setCopiedId] = useState(null);
  // Which form is open: a kind (new request) or a request id (email an existing one).
  const [open, setOpen] = useState(null);

  function copy(req) {
    navigator.clipboard?.writeText(req.url).then(() => {
      setCopiedId(req.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const defaultTo = (kind) => (kind === "candidate_nps" ? candidateEmail : clientEmail) || "";

  async function run(fn) {
    if (await fn()) setOpen(null);
  }

  return (
    <div className="rounded-[14px] p-5 sm:p-6 space-y-4" style={CARD}>
      <SectionHeading eyebrow="Feedback" title="Request feedback" />
      <p className="text-[12px] -mt-2" style={{ color: INK_FAINT }}>
        Emails them a link to a one-question page - no account needed on their end. Feeds candidate NPS / client
        satisfaction figures in Analytics.
      </p>

      <div className="flex flex-wrap gap-2">
        {Object.entries(FEEDBACK_KINDS).map(([kind, k]) => (
          <button
            key={kind}
            type="button"
            onClick={() => setOpen(open === kind ? null : kind)}
            aria-expanded={open === kind}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: `1px solid ${open === kind ? "var(--forest)" : "var(--border)"}`, color: INK, background: "white" }}
          >
            {k.button}
          </button>
        ))}
      </div>
      {FEEDBACK_KINDS[open] && (
        <FeedbackSendForm
          key={open}
          defaultTo={defaultTo(open)}
          busy={creating === open}
          onSend={(to) => run(() => onCreate(open, to))}
          onLinkOnly={() => run(() => onCreate(open, null))}
          onCancel={() => setOpen(null)}
        />
      )}

      {requests.length > 0 && (
        <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
          {requests.map((req) => (
            <li key={req.id} className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: INK }}>
                    {FEEDBACK_KINDS[req.kind]?.title ?? "Feedback"}
                    {req.recipientLabel && <span className="font-normal" style={{ color: INK_MUTED }}> · {req.recipientLabel}</span>}
                  </p>
                  <p className="text-[11px]" style={{ color: INK_MUTED }}>
                    {req.respondedAt
                      ? `Responded · rated ${req.rating}${req.kind === "candidate_nps" ? "/10" : "/5"}${req.comment ? ` · "${req.comment}"` : ""}`
                      : "Awaiting response"}
                  </p>
                </div>
                {!req.respondedAt && req.url && (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpen(open === req.id ? null : req.id)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(req)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
                    >
                      {copiedId === req.id ? "Copied" : "Copy link"}
                    </button>
                  </div>
                )}
              </div>
              {open === req.id && (
                <FeedbackSendForm
                  defaultTo={req.recipientLabel?.includes("@") ? req.recipientLabel : defaultTo(req.kind)}
                  busy={creating === req.id}
                  onSend={(to) => run(() => onEmail(req.id, to))}
                  onCancel={() => setOpen(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Notes
 * ---------------------------------------------------------------------- */

function NoteItem({ note, mine, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.body);
  const [saving, setSaving] = useState(false);

  if (editing) {
    return (
      <li className="text-[13px] rounded-[10px] p-3" style={{ background: "var(--mist)" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          aria-label="Edit note"
          className="w-full text-sm p-2.5 rounded-[8px] resize-none bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        />
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={() => { setEditing(false); setText(note.body); }} className="text-[12px] font-semibold px-3 py-1 rounded-full" style={{ color: INK_MUTED }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!text.trim() || saving}
            onClick={async () => {
              setSaving(true);
              const ok = await onEdit(note.id, text);
              setSaving(false);
              if (ok) setEditing(false);
            }}
            className="text-[12px] font-semibold px-3 py-1 rounded-full disabled:opacity-40"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="group text-[13px] rounded-[10px] p-3" style={{ background: "var(--mist)" }}>
      <p className="whitespace-pre-wrap" style={{ color: INK }}>{note.body}</p>
      <div className="flex items-center justify-between gap-2 mt-1.5">
        <p className="text-[11px]" style={{ color: INK_FAINT }}>
          - {note.author} · {formatRelativeTime(note.createdAt)}
        </p>
        {mine && (
          <span className="flex items-center gap-2 text-[11px] font-semibold">
            <button type="button" onClick={() => setEditing(true)} className="hover:underline" style={{ color: INK_MUTED }}>
              Edit
            </button>
            <button type="button" onClick={() => onDelete(note.id)} className="hover:underline" style={{ color: RED_STRONG }}>
              Delete
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

function NotesPanel({ notes, currentUserId, onAddNote, onEditNote, onDeleteNote }) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Working notes" title="Notes" />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.trim() || saving) return;
          setSaving(true);
          const ok = await onAddNote(draft);
          setSaving(false);
          if (ok) setDraft("");
        }}
        className="mb-4"
      >
        <textarea
          id="candidate-note-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note for the team…"
          rows={3}
          className="w-full text-sm p-3 rounded-[10px] resize-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={!draft.trim() || saving}
            className="text-[12px] font-semibold px-3.5 py-1.5 rounded-full disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {saving ? "Saving…" : "Add note"}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>
          No notes yet.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {notes.map((n) => (
            <NoteItem key={n.id} note={n} mine={Boolean(currentUserId) && n.authorId === currentUserId} onEdit={onEditNote} onDelete={onDeleteNote} />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Talent pool & other roles - keep someone for future jobs, and screen them
 * against another job from the CV already on file (lib/rescreen.js).
 * ---------------------------------------------------------------------- */

function TalentPoolPanel({ candidate, jobs, onSave, onUpdate, onRemove, onRescreen }) {
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState("");
  const [screening, setScreening] = useState(false);
  const pool = candidate.talentPool;

  const screenedJobIds = new Set([candidate.jobId, ...candidate.otherRoles.map((r) => r.jobId)]);
  const availableJobs = jobs.filter((j) => !screenedJobIds.has(j.id));
  const openJobs = availableJobs.filter((j) => j.status === "open");
  const closedJobs = availableJobs.filter((j) => j.status !== "open");

  async function save() {
    setBusy(true);
    const ok = await onSave(note);
    setBusy(false);
    if (ok) {
      setNote("");
      setNoting(false);
    }
  }

  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading
        eyebrow="Talent pool"
        title={pool ? "Saved for future roles" : "Keep for future roles"}
        action={
          <Link href="/dashboard/talent-pool" className="text-[12px] font-semibold" style={{ color: "var(--forest)" }}>
            Open pool →
          </Link>
        }
      />

      {pool ? (
        <div className="rounded-[10px] p-3 mb-4" style={{ background: "var(--mint)" }}>
          <p className="text-[12.5px] font-semibold" style={{ color: "var(--forest-deep)" }}>
            In the talent pool
          </p>
          <p className="text-[11.5px] mt-0.5" style={{ color: INK_MUTED }}>
            Saved {formatRelativeTime(new Date(pool.savedAt))}
            {pool.savedBy ? ` by ${pool.savedBy}` : ""}
          </p>
          {pool.note && <p className="text-[12.5px] italic mt-1.5" style={{ color: INK }}>“{pool.note}”</p>}
          <div className="grid grid-cols-2 gap-2 mt-2.5">
            <label className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: INK_FAINT }}>
              Availability
              <select
                value={pool.status || ""}
                onChange={(e) => onUpdate({ status: e.target.value || null })}
                className="mt-1 w-full text-[12px] font-semibold normal-case tracking-normal px-2.5 py-1.5 rounded-full bg-white"
                style={{ border: "1px solid var(--border)", color: INK }}
              >
                <option value="">Unknown</option>
                <option value="available">Available</option>
                <option value="open">Open to offers</option>
                <option value="not_looking">Not looking</option>
              </select>
            </label>
            <label className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: INK_FAINT }}>
              Check in
              <input
                type="date"
                value={pool.checkIn || ""}
                onChange={(e) => onUpdate({ checkIn: e.target.value || null })}
                className="mt-1 w-full text-[12px] font-semibold normal-case tracking-normal px-2.5 py-1 rounded-full bg-white"
                style={{ border: "1px solid var(--border)", color: INK }}
              />
            </label>
          </div>
          <button
            type="button"
            onClick={async () => {
              setBusy(true);
              await onRemove();
              setBusy(false);
            }}
            disabled={busy}
            className="text-[11.5px] font-semibold mt-2 hover:underline disabled:opacity-50"
            style={{ color: INK_MUTED }}
          >
            Remove from pool
          </button>
        </div>
      ) : noting ? (
        <div className="mb-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Why keep them? e.g. great fit for senior sales, wants remote (optional)"
            aria-label="Why keep them"
            className="w-full text-[13px] p-2.5 rounded-[10px] resize-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={() => setNoting(false)} className="text-[12px] font-semibold px-3 py-1.5 rounded-full" style={{ color: INK_MUTED }}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={busy} className="text-[12px] font-semibold px-3.5 py-1.5 rounded-full disabled:opacity-50" style={{ background: "var(--forest)", color: "white" }}>
              {busy ? "Saving…" : "Save to pool"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setNoting(true)}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2 rounded-full"
            style={{ border: "1px solid var(--forest)", color: "var(--forest)" }}
          >
            ☆ Save to talent pool
          </button>
          <p className="text-[11.5px] mt-2" style={{ color: INK_FAINT }}>
            Not right for this role? Keep them - when a new job comes in, you can screen them against it without re-uploading.
          </p>
        </div>
      )}

      <FieldLabel>Screened for</FieldLabel>
      <ul className="space-y-1.5 mb-4">
        <li className="flex items-center justify-between gap-2 text-[12.5px]">
          <span className="truncate" style={{ color: INK }}>
            {candidate.jobTitle} <span style={{ color: INK_FAINT }}>(this page)</span>
          </span>
          <span className="tabular-nums font-semibold" style={{ color: scoreColor(candidate.score) }}>{candidate.score ?? "–"}</span>
        </li>
        {candidate.otherRoles.map((r) => (
          <li key={r.candidateId} className="flex items-center justify-between gap-2 text-[12.5px]">
            <Link href={`/dashboard/candidates/${r.candidateId}`} className="truncate hover:underline" style={{ color: "var(--forest)" }}>
              {r.jobTitle}
              {r.stage ? <span style={{ color: INK_FAINT }}> · {STAGE_LABELS[r.stage] || r.stage}</span> : null}
            </Link>
            <span className="tabular-nums font-semibold" style={{ color: scoreColor(r.score) }}>{r.score ?? "–"}</span>
          </li>
        ))}
      </ul>

      <FieldLabel>Screen for another job</FieldLabel>
      {candidate.hasCvText ? (
        <div className="flex gap-2">
          <select
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            disabled={screening}
            aria-label="Job to screen them for"
            className="min-w-0 flex-1 text-[12.5px] px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            <option value="">{availableJobs.length ? "Choose a job…" : "No other jobs yet"}</option>
            {openJobs.length > 0 && (
              <optgroup label="Open">
                {openJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </optgroup>
            )}
            {closedJobs.length > 0 && (
              <optgroup label="Closed">
                {closedJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </optgroup>
            )}
          </select>
          <button
            type="button"
            disabled={!jobId || screening}
            onClick={async () => {
              setScreening(true);
              const ok = await onRescreen(jobId);
              setScreening(false);
              if (ok) setJobId("");
            }}
            className="text-[12px] font-semibold px-3.5 py-1.5 rounded-full shrink-0 disabled:opacity-40"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {screening ? "Screening…" : "Screen"}
          </button>
        </div>
      ) : (
        <p className="text-[12px]" style={{ color: INK_FAINT }}>No CV text on file - upload their CV on Analyse to screen them for another job.</p>
      )}
      {screening && <p className="text-[11.5px] mt-2" style={{ color: INK_FAINT }}>Running a full analysis - about 20–40 seconds.</p>}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Loading / error / not-found
 * ---------------------------------------------------------------------- */

function Block({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading candidate">
      <div className="rounded-[16px] p-8" style={CARD}>
        <Block className="h-4 w-32 mb-6" />
        <div className="flex gap-4">
          <Block className="h-14 w-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Block className="h-6 w-56" />
            <Block className="h-4 w-40" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-[14px] p-6" style={CARD}>
              <Block className="h-4 w-40 mb-4" />
              <Block className="h-16 w-full" />
            </div>
          ))}
        </div>
        <div className="rounded-[14px] p-6" style={CARD}>
          <Block className="h-4 w-40 mb-4" />
          <Block className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}

function StateMessage({ title, body, retryLabel, onRetry }) {
  return (
    <div className="rounded-[16px] p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1" style={{ color: INK }}>
        {title}
      </p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: INK_MUTED }}>
        {body}
      </p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {retryLabel ?? "Try again"}
          </button>
        )}
        <Link
          href="/dashboard/candidates"
          className="inline-flex items-center text-[13px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ border: "1px solid var(--border)", color: INK }}
        >
          Back to candidates
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------------- */

/* ------------------------------------------------------------------------
 * Full analysis - the same report the Analyse screen shows straight after
 * screening, rebuilt from the saved analysis. It used to be unreachable once
 * you left that screen.
 * ---------------------------------------------------------------------- */

function FullAnalysis({ analysis, candidateName }) {
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
              className="text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
              style={{ color: INK_MUTED }}
              title="Print, or choose Save as PDF to send it"
            >
              Print / PDF
            </button>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
              style={{ color: "var(--forest)" }}
            >
              {open ? "Hide report" : "Show full report"}
            </button>
          </span>
        }
      />
      <p className="text-[12.5px]" style={{ color: INK_MUTED }}>
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

function EmailPanel({ candidate, onSent }) {
  const router = useRouter();
  const { toasts, toast } = useToasts();
  const handleStatus = useCallback((response, data) => {
    if (response.status === 402 || data?.upgrade) {
      router.push("/pricing?reason=subscription_required");
      return true;
    }
    if (response.status === 401) {
      router.push(`/login?redirect_url=${encodeURIComponent(`/dashboard/candidates/${candidate.id}`)}`);
      return true;
    }
    return false;
  }, [candidate.id, router]);

  const { email } = useEmailComposer({
    candidateId: candidate.id,
    jobId: candidate.jobId,
    candidateEmail: candidate.email,
    clientEmail: candidate.job?.client_email || "",
    toast,
    handleStatus,
    onSent,
  });

  if (!candidate.jobId) return null;

  return (
    <>
      <Toasts toasts={toasts} />
      <EmailCard email={email} />
    </>
  );
}

/* ------------------------------------------------------------------------
 * Edit details - correct what was read off the CV.
 * ---------------------------------------------------------------------- */

const CONTACT_FIELDS = [
  { key: "fullName", label: "Name", required: true },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "location", label: "Location" },
  { key: "currentTitle", label: "Current title" },
  { key: "currentCompany", label: "Current company" },
];

function EditDetailsDialog({ candidate, onCancel, onSaved }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(CONTACT_FIELDS.map((f) => [f.key, candidate[f.key] || ""]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape" && !saving) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, onCancel]);

  async function save(e) {
    e.preventDefault();
    // Send only what changed.
    const changes = Object.fromEntries(
      CONTACT_FIELDS.filter((f) => (values[f.key] || "").trim() !== (candidate[f.key] || "")).map((f) => [f.key, values[f.key].trim()])
    );
    if (Object.keys(changes).length === 0) {
      onCancel();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await updateCandidateContact(candidate.id, changes);
      onSaved(updated);
    } catch (err) {
      setError(err.message || "Couldn't save those details.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(19,32,27,0.45)" }}>
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-details-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[16px] p-6 bg-white shadow-xl"
      >
        <h2 id="edit-details-title" className="text-base font-semibold mb-1" style={{ color: INK }}>
          Edit candidate details
        </h2>
        <p className="text-[13px] mb-4" style={{ color: INK_MUTED }}>
          Fix anything the CV reader got wrong. The change is noted on their timeline.
        </p>
        <div className="space-y-3">
          {CONTACT_FIELDS.map((f, i) => (
            <label key={f.key} className="block">
              <span className="block text-[12px] font-semibold mb-1" style={{ color: INK }}>{f.label}</span>
              <input
                ref={i === 0 ? firstRef : undefined}
                type={f.type || "text"}
                value={values[f.key]}
                required={f.required}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                className="w-full text-sm px-3 py-2 rounded-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px solid var(--border)", color: INK }}
              />
            </label>
          ))}
        </div>
        {error && <p role="alert" className="text-[12px] mt-3" style={{ color: RED_STRONG }}>{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ border: "1px solid var(--border)", color: INK }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function CandidateProfilePage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const { user: clerkUser } = useUser();
  const currentUserId = clerkUser?.id ?? null;

  const [candidate, setCandidate] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error | not-found
  const [reloadKey, setReloadKey] = useState(0);
  const [recruiters, setRecruiters] = useState([]);
  const [feedbackRequests, setFeedbackRequests] = useState([]);
  const [creatingFeedbackRequest, setCreatingFeedbackRequest] = useState(null);
  // Every action on this page reports a failure here - they used to fail
  // silently (a lost note, a stage that snapped back on reload).
  const { toasts, toast } = useToasts();
  const failed = useCallback((err, fallback) => toast(err?.message || fallback, "error"), [toast]);
  // Built-in tags straight away; the agency's own arrive from /api/tags.
  const [tags, setTags] = useState(TAG_CATALOG);
  // No prev/next-candidate endpoint exists yet - the UI already disables
  // these buttons cleanly when both are null.
  const prevId = null;
  const nextId = null;

  useEffect(() => {
    getRecruiters().then(setRecruiters).catch(() => {});
    getTags().then(setTags).catch(() => {});
  }, []);

  useEffect(() => {
    getFeedbackRequests(id).then(setFeedbackRequests).catch(() => {});
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getCandidateById(id)
      .then((c) => {
        if (cancelled) return;
        if (!c) {
          setStatus("not-found");
          return;
        }
        setCandidate(c);
        setStatus("ready");
        pushRecentlyViewed(id);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err?.message === "Not found" ? "not-found" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  // After an email is sent from the profile, pull in the new timeline entry
  // without flashing the whole page back to its loading skeleton.
  const refreshActivity = useCallback(() => {
    getCandidateById(id)
      .then((c) => {
        if (c) setCandidate((prev) => (prev ? { ...prev, activity: c.activity } : prev));
      })
      .catch(() => {});
  }, [id]);

  // Each resolves true when done, so the panel can close its form.
  const handleCreateFeedbackRequest = useCallback(
    async (kind, sendTo) => {
      setCreatingFeedbackRequest(kind);
      try {
        const res = await createFeedbackRequest(id, { kind, sendTo });
        if (res.request) setFeedbackRequests((list) => [res.request, ...list]);
        if (res.sendError) {
          toast(`Link created, but ${res.sendError.charAt(0).toLowerCase()}${res.sendError.slice(1)}`, "error");
        } else {
          toast(res.emailedTo ? `Feedback request sent to ${res.emailedTo}` : "Feedback link created - copy it below");
        }
        if (res.emailedTo) refreshActivity();
        return true;
      } catch (err) {
        failed(err, "Couldn't create the feedback request.");
        return false;
      } finally {
        setCreatingFeedbackRequest(null);
      }
    },
    [id, failed, toast, refreshActivity]
  );

  const handleEmailFeedbackRequest = useCallback(
    async (requestId, sendTo) => {
      setCreatingFeedbackRequest(requestId);
      try {
        await emailFeedbackRequest(id, requestId, sendTo);
        toast(`Feedback request sent to ${sendTo}`);
        refreshActivity();
        return true;
      } catch (err) {
        failed(err, "Couldn't send the email.");
        return false;
      } finally {
        setCreatingFeedbackRequest(null);
      }
    },
    [id, failed, toast, refreshActivity]
  );

  const [editingDetails, setEditingDetails] = useState(false);
  const closeEditDetails = useCallback(() => setEditingDetails(false), []);
  const handleDetailsSaved = useCallback((updated) => {
    setEditingDetails(false);
    setCandidate((c) => (c ? { ...c, ...updated } : c));
    refreshActivity();
  }, [refreshActivity]);

  const handleStageChange = useCallback(
    async (stage) => {
      const previousStage = candidate?.stage ?? null;
      const updated = await updateCandidateStage(id, stage).catch((err) => failed(err, "Couldn't move this candidate."));
      if (updated) {
        if (previousStage !== stage && posthog.__loaded) {
          posthog.capture("candidate_stage_changed", {
            from_stage: previousStage,
            to_stage: stage,
          });
        }
        setCandidate((c) => (c ? { ...c, stage: updated.stage ?? stage } : c));
        toast(`Moved to ${STAGE_LABELS[updated.stage ?? stage] || stage}`);
      }
    },
    [id, candidate, failed, toast]
  );

  const handleAssign = useCallback(
    async (recruiterId) => {
      const updated = await assignCandidate(id, recruiterId || null).catch((err) => failed(err, "Couldn't reassign this candidate."));
      if (updated) setCandidate((c) => (c ? { ...c, recruiterId: updated.recruiter_id ?? recruiterId } : c));
    },
    [id, failed]
  );

  const handleDeleteCandidate = useCallback(async () => {
    const name = candidate?.fullName || "this candidate";
    const others = candidate?.otherRoles?.length || 0;
    if (!confirm(`Permanently delete ${name}? This erases their CV, scores, notes and activity history, and cannot be undone.`)) {
      return;
    }
    // They're also on file for other jobs - an erasure request has to
    // cover those records too.
    const everyRecord =
      others > 0 &&
      confirm(
        `${name} also has ${others} other record${others === 1 ? "" : "s"} (screened for ${candidate.otherRoles.map((r) => r.jobTitle).join(", ")}).\n\nOK = erase every record (use this for a GDPR erasure request)\nCancel = only remove them from ${candidate.jobTitle}`
      );
    try {
      await deleteCandidate(id, { everyRecord });
      router.push("/dashboard/candidates");
    } catch (err) {
      failed(err, "Couldn't delete this candidate. Please try again.");
    }
  }, [id, candidate, router, failed]);

  const handleAddNote = useCallback(
    async (body) => {
      // Returns whether it saved, so the note box only clears on success.
      const note = await addCandidateNote(id, body).catch((err) => failed(err, "Couldn't save the note - it's still in the box."));
      if (!note) return false;
      setCandidate((c) => (c ? { ...c, notes: [note, ...c.notes] } : c));
      return true;
    },
    [id, failed]
  );

  const handleEditNote = useCallback(
    async (noteId, body) => {
      const note = await editCandidateNote(id, noteId, body).catch((err) => failed(err, "Couldn't save the note."));
      if (!note) return false;
      setCandidate((c) => (c ? { ...c, notes: c.notes.map((n) => (n.id === noteId ? note : n)) } : c));
      return true;
    },
    [id, failed]
  );

  const handleDeleteNote = useCallback(
    async (noteId) => {
      if (!confirm("Delete this note?")) return;
      const ok = await deleteCandidateNote(id, noteId).catch((err) => failed(err, "Couldn't delete the note."));
      if (ok) setCandidate((c) => (c ? { ...c, notes: c.notes.filter((n) => n.id !== noteId) } : c));
    },
    [id, failed]
  );

  const handleAddTag = useCallback(
    async (tagId) => {
      const res = await addCandidateTag(id, tagId).catch((err) => failed(err, "Couldn't add the tag."));
      if (res) setCandidate((c) => (c ? { ...c, tags: res.tags } : c));
    },
    [id, failed]
  );

  const handleCreateTag = useCallback(
    async (label) => {
      const tag = await createTag(label).catch((err) => failed(err, "Couldn't create the tag."));
      if (!tag) return false;
      setTags((list) => (list.some((t) => t.id === tag.id) ? list : [...list, tag]));
      await handleAddTag(tag.id);
      return true;
    },
    [failed, handleAddTag]
  );

  const handleRemoveTag = useCallback(
    async (tagId) => {
      const res = await removeCandidateTag(id, tagId).catch((err) => failed(err, "Couldn't remove the tag."));
      if (res) setCandidate((c) => (c ? { ...c, tags: res.tags } : c));
    },
    [id, failed]
  );

  const handleSetNextAction = useCallback(
    async (payload) => {
      const res = await setCandidateNextAction(id, payload).catch((err) => failed(err, "Couldn't save the next action."));
      if (res) setCandidate((c) => (c ? { ...c, nextAction: res.nextAction } : c));
    },
    [id, failed]
  );

  const handleCompleteNextAction = useCallback(async () => {
    const res = await completeNextAction(id).catch((err) => failed(err, "Couldn't mark it done."));
    if (res) setCandidate((c) => (c ? { ...c, nextAction: res.nextAction } : c));
  }, [id, failed]);

  const handleUpdateDetails = useCallback(
    async (fields) => {
      const res = await updateCandidateDetails(id, fields).catch((err) => failed(err, "Couldn't save that change."));
      if (res) setCandidate((c) => (c ? { ...c, ...res } : c));
    },
    [id, failed]
  );

  const [loggingActivity, setLoggingActivity] = useState(null);
  const handleLogActivity = useCallback(
    async (type) => {
      setLoggingActivity(type);
      try {
        const res = await logCandidateActivity(id, type).catch((err) => failed(err, "Couldn't log that."));
        if (res?.activity) {
          setCandidate((c) => (c ? { ...c, activity: [res.activity, ...c.activity] } : c));
        }
      } finally {
        setLoggingActivity(null);
      }
    },
    [id, failed]
  );

  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    getJobs().then(setJobs).catch(() => {});
  }, []);

  const handleSaveToPool = useCallback(
    async (note) => {
      const talentPool = await saveToTalentPool(id, note).catch((err) => failed(err, "Couldn't save them to the talent pool."));
      if (!talentPool) return false;
      setCandidate((c) => (c ? { ...c, talentPool } : c));
      toast("Saved to the talent pool");
      refreshActivity();
      return true;
    },
    [id, failed, toast, refreshActivity]
  );

  const handleUpdatePool = useCallback(
    async (fields) => {
      const talentPool = await updateTalentPoolEntry(id, fields).catch((err) => failed(err, "Couldn't save that."));
      if (talentPool) setCandidate((c) => (c ? { ...c, talentPool } : c));
    },
    [id, failed]
  );

  const handleRemoveFromPool = useCallback(async () => {
    const ok = await removeFromTalentPool(id).catch((err) => failed(err, "Couldn't remove them from the pool."));
    if (!ok) return;
    setCandidate((c) => (c ? { ...c, talentPool: null } : c));
    toast("Removed from the talent pool");
    refreshActivity();
  }, [id, failed, toast, refreshActivity]);

  const handleRescreen = useCallback(
    async (jobId) => {
      try {
        const r = await rescreenCandidate(id, jobId);
        setCandidate((c) =>
          c
            ? {
                ...c,
                otherRoles: [
                  { candidateId: r.candidateId, jobId, jobTitle: r.job?.title || "Role", score: r.score, stage: "Screened" },
                  ...c.otherRoles,
                ],
              }
            : c
        );
        toast(`Screened for ${r.job?.title || "that job"}: ${r.score}`);
        refreshActivity();
        return true;
      } catch (err) {
        if (err.status === 409 && err.existingId) {
          router.push(`/dashboard/candidates/${err.existingId}`);
          return true;
        }
        failed(err, "Couldn't screen them for that job.");
        return false;
      }
    },
    [id, failed, toast, refreshActivity, router]
  );

  const focusNoteField = useCallback(() => {
    document.getElementById("candidate-note-input")?.focus();
  }, []);

  // Keyboard shortcuts - ignored while typing in a field, per the brief's
  // note not to fight normal browser/input behaviour.
  useEffect(() => {
    function onKeydown(e) {
      const activeTag = document.activeElement?.tagName;
      const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA" || activeTag === "SELECT";
      if (e.key === "Escape") {
        document.activeElement?.blur();
        return;
      }
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.key === "j" || e.key === "J") && nextId) router.push(`/dashboard/candidates/${nextId}`);
      if ((e.key === "k" || e.key === "K") && prevId) router.push(`/dashboard/candidates/${prevId}`);
      if ((e.key === "s" || e.key === "S") && candidate?.status === "completed" && candidate.stage !== "Shortlisted") {
        handleStageChange("Shortlisted");
      }
      if (e.key === "n" || e.key === "N") focusNoteField();
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, [nextId, prevId, candidate, router, handleStageChange, focusNoteField]);

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6">
        {status === "loading" && <ProfileSkeleton />}

        {status === "error" && (
          <StateMessage title="Unable to load candidate" body="Something went wrong while loading this candidate's profile." onRetry={retry} />
        )}

        {status === "not-found" && (
          <StateMessage title="Candidate not found" body="This candidate may have been removed, or the link is out of date." />
        )}

        {status === "ready" && candidate && (
          <>
            <ProfileHeader
              candidate={candidate}
              prevId={prevId}
              nextId={nextId}
              onQuickShortlist={() => handleStageChange("Shortlisted")}
              onMoveNext={handleStageChange}
              onFocusNote={focusNoteField}
              onDelete={handleDeleteCandidate}
              onEdit={() => setEditingDetails(true)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 lg:gap-6">
              <div className="space-y-4 lg:space-y-6">
                <MatchOverview candidate={candidate} />
                <FullAnalysis analysis={candidate.analysis} candidateName={candidate.screenedBlind ? null : candidate.fullName} />
                <ExperienceSection candidate={candidate} />
                <DocumentsSection candidate={candidate} />
                <ActivityTimeline activity={candidate.activity} />
              </div>
              <div className="space-y-4 lg:space-y-6">
                <TalentPoolPanel
                  candidate={candidate}
                  jobs={jobs}
                  onSave={handleSaveToPool}
                  onUpdate={handleUpdatePool}
                  onRemove={handleRemoveFromPool}
                  onRescreen={handleRescreen}
                />
                <RecruiterWorkspace
                  candidate={candidate}
                  recruiters={recruiters}
                  tags={tags}
                  onStageChange={handleStageChange}
                  onAssign={handleAssign}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                  onCreateTag={handleCreateTag}
                  onSetNextAction={handleSetNextAction}
                  onCompleteNextAction={handleCompleteNextAction}
                  onLogActivity={handleLogActivity}
                  loggingActivity={loggingActivity}
                />
                <OutcomeReportingPanel candidate={candidate} onUpdateDetails={handleUpdateDetails} />
                <FeedbackRequestsPanel
                  requests={feedbackRequests}
                  onCreate={handleCreateFeedbackRequest}
                  onEmail={handleEmailFeedbackRequest}
                  creating={creatingFeedbackRequest}
                  candidateEmail={candidate.email}
                  clientEmail={candidate.job?.client_email}
                />
                <NotesPanel notes={candidate.notes} currentUserId={currentUserId} onAddNote={handleAddNote} onEditNote={handleEditNote} onDeleteNote={handleDeleteNote} />
                <EmailPanel candidate={candidate} onSent={refreshActivity} />
              </div>
            </div>
          </>
        )}
      </div>
      {editingDetails && candidate && (
        <EditDetailsDialog candidate={candidate} onCancel={closeEditDetails} onSaved={handleDetailsSaved} />
      )}
      <Toasts toasts={toasts} />
    </main>
  );
}
