"use client";

// One candidate in the split view: their screening report, their CV, or a
// summary of their profile. Loaded through the shared cache
// (lib/hooks/useResource.js): a candidate already shown in this session -
// in another pane, or before a reload of the layout - appears at once and
// refreshes in the background. (The full profile page loads on the server
// and doesn't fill this cache.)

import { useState } from "react";
import Link from "next/link";
import { Button, EmptyState, ErrorState, Icon, LoadingCard, Notice, Pill, Segmented, Spinner, cx } from "@/components/ui";
import Report from "@/app/analyse/_components/Report";
import { UNBLIND_CONFIRM, openOriginalCv } from "@/app/analyse/_components/compareBits";
import AiWritingNotice from "@/components/dashboard/AiWritingNotice";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { getCandidateById } from "@/lib/dashboard-api";
import { apiFetch } from "@/lib/api-client/core";
import { useResource } from "@/lib/hooks/useResource";
import { formatDateOnly } from "@/lib/candidates/format";
import { PANE_VIEWS, PANE_VIEW_LABELS } from "@/lib/workspace/panes";
import { REVIEW_MIN, STRONG_MATCH_MIN } from "@/lib/screening/scoreBands";

/** @typedef {import("@/lib/contracts/candidates").ShapedCandidateProfile} Candidate */

const VIEW_OPTIONS = PANE_VIEWS.map((value) => ({ value, label: PANE_VIEW_LABELS[value] }));

/** @param {number | null | undefined} score */
const scorePillTone = (score) => (score == null ? "neutral" : score >= STRONG_MATCH_MIN ? "green" : score >= REVIEW_MIN ? "amber" : "red");

/**
 * @param {{ id: string, view: "score" | "cv" | "profile", onView: (view: string) => void, onClose: () => void }} props
 */
export default function CandidatePane({ id, view, onView, onClose }) {
  const { data: candidate, error, loading, reload } = useResource(`candidate:${id}`, () => getCandidateById(id));
  const name = candidate?.fullName || "Candidate";

  return (
    <section
      aria-label={name}
      className={cx(
        // On a laptop the pane fills its grid cell and scrolls inside.
        "flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-[var(--border)] bg-white lg:h-full lg:min-h-0"
      )}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
        {/* Keeps the name readable: in a narrow pane the controls wrap below. */}
        <div className="min-w-[10rem] flex-1">
          <Link href={`/dashboard/candidates/${id}`} className="block truncate font-semibold text-[var(--ink)] hover:underline" title="Open full profile">
            {loading ? "Loading…" : name}
          </Link>
          {candidate && (
            <p className="truncate text-xs text-[var(--ink-soft)]">
              {[candidate.jobTitle, candidate.stage, candidate.subStage].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        {candidate?.score != null && <Pill tone={scorePillTone(candidate.score)}>{candidate.score}/100</Pill>}
        <Segmented size="sm" value={view} onChange={onView} options={VIEW_OPTIONS} ariaLabel={`What to show for ${name}`} />
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${name}`}
          className="rounded-[8px] p-1.5 text-[var(--ink-soft)] hover:bg-[var(--mist)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
        >
          <Icon name="x" size={14} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading ? (
          <LoadingCard rows={4} />
        ) : !candidate ? (
          <ErrorState title="Couldn't load this candidate" body={error?.message} onRetry={reload} />
        ) : view === "cv" ? (
          <CvView candidate={candidate} />
        ) : view === "profile" ? (
          <ProfileView candidate={candidate} />
        ) : (
          <ScoreView candidate={candidate} />
        )}
      </div>
    </section>
  );
}

/** @param {{ candidate: Candidate }} props */
function ScoreView({ candidate }) {
  const analysis = candidate.analysis;
  if (!analysis?.report) {
    return <EmptyState framed={false} icon="file" title="Not screened yet" body="Screen this candidate against a job to see their score here." />;
  }
  return (
    <>
      <p className="mb-3 text-xs text-[var(--ink-soft)]">
        {analysis.jobTitle ? `For ${analysis.jobTitle}` : "Latest screening"}
        {analysis.analysedAt ? `, ${formatDateOnly(analysis.analysedAt)}` : ""}
      </p>
      <Report result={analysis.report} roleLabel={analysis.jobTitle || "this role"} embedded candidateId={candidate.id} />
    </>
  );
}

/** @param {{ candidate: Candidate }} props */
function CvView({ candidate }) {
  const [ask, confirmDialog] = useConfirm();
  // Someone screened blind stays anonymous until a person chooses to look.
  const [revealed, setRevealed] = useState(!candidate.screenedBlind);
  const cv = useResource(revealed && candidate.hasCvText ? `cv-text:${candidate.id}` : null, () =>
    apiFetch(`/api/candidates/${candidate.id}/cv?format=text`)
  );

  return (
    <div className="space-y-3">
      {confirmDialog}
      <AiWritingNotice notice={candidate.analysis?.report?.ai_writing} candidateId={candidate.id} where="split_view" />
      {candidate.resume && (
        <Button size="sm" variant="secondary" icon="external" onClick={() => openOriginalCv({ id: candidate.id, blind: candidate.screenedBlind }, ask)}>
          Open the original file
        </Button>
      )}
      {!candidate.hasCvText ? (
        <p className="text-sm text-[var(--ink-soft)]">There&apos;s no CV text on file for this candidate.</p>
      ) : !revealed ? (
        <Notice tone="info" action={<Button size="sm" onClick={async () => (await ask(UNBLIND_CONFIRM)) && setRevealed(true)}>Show CV</Button>}>
          Screened blind. The CV shows their name and contact details.
        </Notice>
      ) : cv.loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
          <Spinner size={14} /> Loading the CV…
        </div>
      ) : cv.error && !cv.data ? (
        <ErrorState title="Couldn't load the CV" body={cv.error.message} onRetry={cv.reload} />
      ) : (
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-[var(--ink)]">{cv.data?.text}</pre>
      )}
    </div>
  );
}

/** @param {{ label: string, children: import("react").ReactNode }} props */
function Row({ label, children }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5">
      <dt className="text-xs font-medium text-[var(--ink-soft)]">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-[var(--ink)]">{children}</dd>
    </div>
  );
}

/** @param {{ candidate: Candidate }} props */
function ProfileView({ candidate: c }) {
  const role = [c.currentTitle, c.currentCompany].filter(Boolean).join(" at ");
  return (
    <div className="space-y-4">
      <AiWritingNotice notice={c.analysis?.report?.ai_writing} candidateId={c.id} where="split_view" />
      <dl className="divide-y divide-[var(--border-soft)]">
        <Row label="Current role">{role || null}</Row>
        <Row label="Location">{c.location}</Row>
        <Row label="Email">{c.email && <a href={`mailto:${c.email}`} className="text-[var(--forest)] hover:underline">{c.email}</a>}</Row>
        <Row label="Phone">{c.phone && <a href={`tel:${c.phone}`} className="text-[var(--forest)] hover:underline">{c.phone}</a>}</Row>
        <Row label="LinkedIn">{c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-[var(--forest)] hover:underline">Profile</a>}</Row>
        <Row label="Stage">{[c.stage, c.subStage].filter(Boolean).join(" · ") || null}</Row>
        <Row label="Recruiter">{c.recruiterName}</Row>
        <Row label="Source">{c.source}</Row>
        <Row label="Next action">{c.nextAction ? `${c.nextAction.label}${c.nextAction.dueAt ? ` (due ${formatDateOnly(c.nextAction.dueAt)})` : ""}` : null}</Row>
      </dl>

      {c.matchSummary && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Why they match</h3>
          <p className="text-sm text-[var(--ink)]">{c.matchSummary}</p>
        </div>
      )}
      {(c.strengths.length > 0 || c.concerns.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <List title="Strengths" items={c.strengths} />
          <List title="Concerns" items={c.concerns} />
        </div>
      )}
      {c.otherRoles.length > 0 && <List title="Also screened for" items={c.otherRoles.map((r) => `${r.jobTitle}${r.score != null ? ` - ${r.score}/100` : ""}`)} />}
      {c.notes.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">Latest notes</h3>
          <ul className="space-y-2">
            {c.notes.slice(0, 3).map((n) => (
              <li key={n.id} className="text-sm text-[var(--ink)]">
                <span className="text-xs text-[var(--ink-soft)]">
                  {n.author || "Someone"}
                  {n.createdAt ? `, ${formatDateOnly(n.createdAt)}` : ""}
                </span>
                <p className="whitespace-pre-wrap">{n.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** @param {{ title: string, items: string[] }} props */
function List({ title, items }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-soft)]">{title}</h3>
      <ul className="list-disc space-y-0.5 pl-4 text-sm text-[var(--ink)]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
