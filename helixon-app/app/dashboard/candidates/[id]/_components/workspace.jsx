"use client";

// Part of the candidate profile page (../page.jsx).

import { CARD, INK, INK_FAINT, INK_MUTED, RED, RED_BG, RED_STRONG, formatDateOnly } from "@/lib/candidates/format";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { SubStagePicker } from "@/components/dashboard/custom-fields";
import { useNow } from "@/lib/hooks/useNow";
import { useState } from "react";
import { FieldLabel, NewTagForm, SectionHeading, SelectField } from "./primitives";
import { OUTREACH_ACTIONS, STAGE_ORDER } from "./utils";

export function RecruiterWorkspace({ candidate, recruiters, tags, onStageChange, onSubStageChange, onAssign, onAddTag, onRemoveTag, onCreateTag, onSetNextAction, onCompleteNextAction, onLogActivity, loggingActivity }) {
  const [nextActionLabel, setNextActionLabel] = useState("");
  const [nextActionDue, setNextActionDue] = useState("");
  const now = useNow();
  const overdue = candidate.nextAction && new Date(candidate.nextAction.dueAt).getTime() < now;
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
              className="text-[12px] font-semibold px-2.5 py-1.5 rounded-full transition disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ border: "1px solid var(--border)", color: INK, background: "white" }}
            >
              {loggingActivity === a.type ? "Logging…" : a.label}
            </button>
          ))}
        </div>
        <p className="text-[12px] mt-1.5" style={{ color: INK_FAINT }}>
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
        <SubStagePicker
          className="mt-2"
          stage={candidate.stage}
          subStage={candidate.subStage}
          disabled={candidate.status !== "completed"}
          onChange={onSubStageChange}
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
                className="inline-flex items-center gap-1 text-[12px] font-semibold pl-2.5 pr-1.5 py-1 rounded-full"
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
              className="list-none cursor-pointer text-[12px] font-semibold px-2.5 py-1 rounded-full select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
                    className="w-full text-left text-[13px] px-2.5 py-1.5 rounded-[8px] hover:bg-[var(--mist)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
              <p className="text-[14px] font-semibold" style={{ color: INK }}>
                {candidate.nextAction.label}
              </p>
              <p className="text-[12px]" style={{ color: overdue ? RED_STRONG : INK_MUTED }}>
                {overdue ? "Overdue · " : "Due "}
                {formatDateOnly(candidate.nextAction.dueAt)}
              </p>
            </div>
            <button
              type="button"
              onClick={onCompleteNextAction}
              className="text-[12px] font-semibold px-2.5 py-1 rounded-full shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
                className="text-[13px] font-semibold px-3 py-2 rounded-[10px] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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

export const SOURCE_OPTIONS = [
  { value: "", label: "Not set" },
  { value: "referral", label: "Referral" },
  { value: "job_board", label: "Job board" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "direct_sourcing", label: "Direct sourcing" },
  { value: "agency_database", label: "Agency database" },
  { value: "careers_page", label: "Your jobs page" },
  { value: "other", label: "Other" },
];

export const REJECTION_REASON_OPTIONS = [
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

export function RetentionToggle({ value, onChange }) {
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
          className="text-[13px] font-semibold px-3 py-1.5 rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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
        <span className="text-[12px]" style={{ color: INK_FAINT }}>
          Not checked yet
        </span>
      )}
    </div>
  );
}

export function OutcomeReportingPanel({ candidate, onUpdateDetails }) {
  const [fee, setFee] = useState(candidate.placementFee ?? "");
  const [cost, setCost] = useState(candidate.placementCost ?? "");
  // Reset the inputs when the saved values change (after a save, or another
  // candidate), during render rather than in an effect's extra render.
  const savedKey = `${candidate.placementFee ?? ""}|${candidate.placementCost ?? ""}`;
  const [syncedKey, setSyncedKey] = useState(savedKey);
  if (syncedKey !== savedKey) {
    setSyncedKey(savedKey);
    setFee(candidate.placementFee ?? "");
    setCost(candidate.placementCost ?? "");
  }

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
          <p className="text-[12px] mt-1.5" style={{ color: INK_FAINT }}>
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
          <p className="text-[12px] -mt-3" style={{ color: INK_FAINT }}>
            Feeds fee income/margin figures in Analytics. Recording the offer above fills in the fee for you.
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
