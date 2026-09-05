"use client";

/* ------------------------------------------------------------------------
 * ASSUMPTIONS
 * ------------------------------------------------------------------------
 * - Route: /dashboard/candidates/[id]. This is a NEW dedicated workspace,
 *   separate from whatever /analyse/[id] currently does (that route was
 *   assumed, per the existing dashboard file's own notes, to be the
 *   analysis-result view reached from "+ New analysis"). If /analyse/[id]
 *   already contains this recruiter workflow, prefer merging into it
 *   instead of maintaining two candidate detail routes.
 * - `params` is read synchronously (`{ params }` prop, App Router
 *   pre-Next.js-15 convention). On Next.js 15+, wrap with
 *   `const { id } = use(params)` instead.
 * - All mutations (stage, assignment, tags, notes, next action) call the
 *   mock functions in lib/mock-data.js, which mutate an in-memory array
 *   and return the updated candidate. There is no optimistic-update/
 *   rollback path here because there's no real network call to fail yet -
 *   add one when these become real PATCH/POST requests.
 * - Recently-viewed tracking uses localStorage and stores candidate IDs
 *   only (never resume contents or contact details), per the brief's
 *   privacy guidance.
 * - No document viewer is wired up - there's no real file storage to
 *   preview from, so the Documents section shows file metadata only and
 *   says so, rather than faking a PDF preview.
 * - No "email candidate" *sending* is implemented (no email backend to
 *   integrate); the Email action opens a mailto: link to the candidate's
 *   address, which needs no backend and isn't fake functionality.
 * - Archive / export / "more" actions are intentionally omitted - the
 *   brief asks not to build backend actions that don't exist yet.
 * ---------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { useRouter } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import {
  getCandidateById,
  getAdjacentCandidateIds,
  getRecruiters,
  getTagCatalog,
  STAGE_LABELS,
  STAGE_ORDER,
  updateCandidateStage,
  assignCandidate,
  addCandidateNote,
  addCandidateTag,
  removeCandidateTag,
  setCandidateNextAction,
  completeNextAction,
} from "@/lib/mock-data";
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

async function fetchCandidate(id) {
  try {
    return await new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(getCandidateById(id));
        } catch (err) {
          reject(err);
        }
      }, 200);
    });
  } catch (err) {
    throw new Error("Failed to load candidate");
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
    default:
      return "";
  }
}

const EVENT_LABELS = {
  cv_uploaded: "CV uploaded",
  analysis_completed: "Analysis completed",
  stage_changed: "Stage changed",
  assigned: "Assigned",
  tag_added: "Tag added",
  tag_removed: "Tag removed",
  note_added: "Note added",
  next_action_set: "Next action set",
  next_action_completed: "Next action completed",
};

/* ------------------------------------------------------------------------
 * Shared bits
 * ---------------------------------------------------------------------- */

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

function ProfileHeader({ candidate, prevId, nextId, onQuickShortlist, onMoveNext, onFocusNote }) {
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
                background: candidate.stage === "placed" ? GREEN_BG : "var(--mist)",
                color: candidate.stage === "placed" ? "var(--forest)" : INK_MUTED,
              }}
            >
              {STAGE_LABELS[candidate.stage]}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-6 pt-6" style={{ borderTop: "1px solid var(--border)" }}>
        {candidate.status === "completed" && candidate.stage !== "shortlisted" && (
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
          <span className="text-[12px] ml-auto" style={{ color: overdue ? RED_STRONG : INK_MUTED }}>
            {overdue ? "Overdue: " : "Next: "}
            {candidate.nextAction.label}
          </span>
        )}
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
                  {w.start} – {w.end}
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
                {e.degree} <span style={{ color: INK_MUTED }}>· {e.school}</span>{" "}
                <span style={{ color: INK_FAINT }}>({e.years})</span>
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
  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Documents" title="CV & documents" />
      {candidate.resume ? (
        <div className="flex items-center justify-between gap-4 rounded-[10px] p-4" style={{ background: "var(--mist)" }}>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: INK }}>
              {candidate.resume.name}
            </p>
            <p className="text-[12px]" style={{ color: INK_MUTED }}>
              {candidate.resume.sizeKb ? `${(candidate.resume.sizeKb / 1024).toFixed(1)} MB · ` : ""}
              Uploaded {formatDateOnly(candidate.resume.uploadedAt)}
            </p>
          </div>
          <span
            className="text-[11px] px-3 py-1.5 rounded-full shrink-0"
            style={{ border: "1px solid var(--border)", color: INK_FAINT }}
            title="Connect a document store to preview and download CVs in-app"
          >
            Preview unavailable
          </span>
        </div>
      ) : (
        <p className="text-[13px]" style={{ color: INK_MUTED }}>
          No CV on file.
        </p>
      )}
      <p className="text-[11px] mt-3" style={{ color: INK_FAINT }}>
        In-app preview and download will appear here once this project is connected to real document storage.
      </p>
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
                        {EVENT_LABELS[entry.type] ?? entry.type}
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

function RecruiterWorkspace({ candidate, recruiters, tags, onStageChange, onAssign, onAddTag, onRemoveTag, onSetNextAction, onCompleteNextAction }) {
  const [nextActionLabel, setNextActionLabel] = useState("");
  const [nextActionDue, setNextActionDue] = useState("");
  const overdue = candidate.nextAction && new Date(candidate.nextAction.dueAt).getTime() < Date.now();
  const availableTags = tags.filter((t) => !candidate.tags.includes(t.id));

  return (
    <div className="rounded-[14px] p-5 sm:p-6 space-y-5" style={CARD}>
      <SectionHeading eyebrow="Recruiter workspace" title="Manage this candidate" />

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
          {availableTags.length > 0 && (
            <details className="relative">
              <summary
                className="list-none cursor-pointer text-[11px] font-semibold px-2.5 py-1 rounded-full select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ border: "1px dashed var(--border)", color: "var(--forest)" }}
              >
                + Add tag
              </summary>
              <div className="absolute left-0 mt-2 w-48 rounded-[10px] p-1.5 z-20" style={{ ...CARD, boxShadow: "0 12px 32px rgba(19,32,27,0.14)" }}>
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
            </details>
          )}
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
 * Notes
 * ---------------------------------------------------------------------- */

function NotesPanel({ notes, onAddNote }) {
  const [draft, setDraft] = useState("");

  return (
    <div className="rounded-[14px] p-5 sm:p-6" style={CARD}>
      <SectionHeading eyebrow="Working notes" title="Notes" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          onAddNote(draft);
          setDraft("");
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
            disabled={!draft.trim()}
            className="text-[12px] font-semibold px-3.5 py-1.5 rounded-full disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--forest)", color: "white" }}
          >
            Add note
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
            <li key={n.id} className="text-[13px] rounded-[10px] p-3" style={{ background: "var(--mist)" }}>
              <p style={{ color: INK }}>{n.body}</p>
              <p className="text-[11px] mt-1.5" style={{ color: INK_FAINT }}>
                - {n.author} · {formatRelativeTime(n.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
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

export default function CandidateProfilePage({ params }) {
  const { id } = params;
  const router = useRouter();

  const [candidate, setCandidate] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error | not-found
  const [reloadKey, setReloadKey] = useState(0);

  const recruiters = useMemo(() => getRecruiters(), []);
  const tags = useMemo(() => getTagCatalog(), []);
  const { prevId, nextId } = useMemo(() => getAdjacentCandidateIds(id), [id]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchCandidate(id)
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
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  const handleStageChange = useCallback(
    (stage) => {
      const previousStage = candidate?.stage ?? null;
      const updated = updateCandidateStage(id, stage, "You");
      if (updated) {
        if (previousStage !== stage && posthog.__loaded) {
          posthog.capture("candidate_stage_changed", {
            from_stage: previousStage,
            to_stage: stage,
          });
        }
        setCandidate(updated);
      }
    },
    [id, candidate]
  );

  const handleAssign = useCallback(
    (recruiterId) => {
      const updated = assignCandidate(id, recruiterId, "You");
      if (updated) setCandidate(updated);
    },
    [id]
  );

  const handleAddNote = useCallback(
    (body) => {
      const updated = addCandidateNote(id, body, "You");
      if (updated) setCandidate(updated);
    },
    [id]
  );

  const handleAddTag = useCallback(
    (tagId) => {
      const updated = addCandidateTag(id, tagId, "You");
      if (updated) setCandidate(updated);
    },
    [id]
  );

  const handleRemoveTag = useCallback(
    (tagId) => {
      const updated = removeCandidateTag(id, tagId, "You");
      if (updated) setCandidate(updated);
    },
    [id]
  );

  const handleSetNextAction = useCallback(
    (payload) => {
      const updated = setCandidateNextAction(id, payload, "You");
      if (updated) setCandidate(updated);
    },
    [id]
  );

  const handleCompleteNextAction = useCallback(() => {
    const updated = completeNextAction(id, "You");
    if (updated) setCandidate(updated);
  }, [id]);

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
      if ((e.key === "s" || e.key === "S") && candidate?.status === "completed" && candidate.stage !== "shortlisted") {
        handleStageChange("shortlisted");
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
              onQuickShortlist={() => handleStageChange("shortlisted")}
              onMoveNext={handleStageChange}
              onFocusNote={focusNoteField}
            />

            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 lg:gap-6">
              <div className="space-y-4 lg:space-y-6">
                <MatchOverview candidate={candidate} />
                <ExperienceSection candidate={candidate} />
                <DocumentsSection candidate={candidate} />
                <ActivityTimeline activity={candidate.activity} />
              </div>
              <div className="space-y-4 lg:space-y-6">
                <RecruiterWorkspace
                  candidate={candidate}
                  recruiters={recruiters}
                  tags={tags}
                  onStageChange={handleStageChange}
                  onAssign={handleAssign}
                  onAddTag={handleAddTag}
                  onRemoveTag={handleRemoveTag}
                  onSetNextAction={handleSetNextAction}
                  onCompleteNextAction={handleCompleteNextAction}
                />
                <NotesPanel notes={candidate.notes} onAddNote={handleAddNote} />
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
