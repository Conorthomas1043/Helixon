"use client";

// Part of the candidate list (app/dashboard/candidates/page.jsx).

import Link from "next/link";
import { AMBER, AMBER_BG, GREEN_BG, INK, INK_FAINT, INK_MUTED, RED_BG, formatRelativeTime, scoreColor, scoreLabel } from "@/lib/candidate-format";
import { Avatar as KitAvatar } from "@/components/ui";
import { STAGE_LABELS } from "@/lib/stage-labels";
import { useNow } from "@/lib/hooks/useNow";
import { STAGE_ORDER } from "./shared";

export function TagChip({ label, active, onClick, onDelete }) {
  return (
    <span
      className="inline-flex items-center rounded-full transition-colors"
      style={{
        background: active ? "var(--forest)" : "var(--mist)",
        color: active ? "white" : INK_MUTED,
      }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`text-[12px] font-semibold py-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${onDelete ? "pl-2.5 pr-1" : "px-2.5"}`}
      >
        {label}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete the tag ${label}`}
          title="Delete this tag"
          className="w-4 h-4 mr-1 rounded-full flex items-center justify-center text-[12px] hover:bg-white/40 focus-visible:outline focus-visible:outline-2"
        >
          ×
        </button>
      )}
    </span>
  );
}

export function ScorePill({ score }) {
  const color = scoreColor(score);
  return (
    <div className="flex flex-col items-end shrink-0 w-12">
      <span className="text-sm font-semibold tabular-nums" style={{ fontFamily: "var(--font-mono)", color }}>
        {score === null || score === undefined ? "-" : score}
      </span>
      <span className="text-[12px] whitespace-nowrap" style={{ color: INK_FAINT }}>
        {score === null || score === undefined ? "" : scoreLabel(score).split(" ")[0]}
      </span>
    </div>
  );
}

export function StageBadge({ stage, status }) {
  if (status === "failed") {
    return (
      <span className="inline-flex items-center text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: RED_BG, color: "#b91c1c" }}>
        Failed
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="inline-flex items-center text-[12px] font-semibold px-2 py-0.5 rounded-full" style={{ background: AMBER_BG, color: AMBER }}>
        Processing
      </span>
    );
  }
  if (!stage || !STAGE_LABELS[stage]) {
    return (
      <span className="text-[12px]" style={{ color: INK_FAINT }}>
        No stage
      </span>
    );
  }
  const isPlaced = stage === STAGE_ORDER[STAGE_ORDER.length - 1];
  return (
    <span
      className="inline-flex items-center text-[12px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: isPlaced ? GREEN_BG : "var(--mist)", color: isPlaced ? "var(--forest)" : INK_MUTED }}
    >
      {STAGE_LABELS[stage]}
    </span>
  );
}

export function Avatar({ name }) {
  return <KitAvatar name={name} size={40} />;
}

export function shortDate(iso) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
}

export function CandidateRow({ candidate, selected, onToggleSelect, columns }) {
  const now = useNow();
  const overdue = candidate.nextAction && new Date(candidate.nextAction.dueAt).getTime() < now;
  const show = (key) => columns.has(key);
  return (
    <li>
      <div
        className="flex items-center gap-3 py-3.5 -mx-2 px-2 rounded-[10px] transition-colors hover:bg-[var(--mist)] focus-within:bg-[var(--mist)]"
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(candidate.id)}
          aria-label={`Select ${candidate.fullName}`}
          className="w-4 h-4 shrink-0 accent-[var(--forest)]"
        />

        <Avatar name={candidate.fullName} />

        <Link href={`/dashboard/candidates/${candidate.id}`} className="flex-1 min-w-0 flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate" style={{ color: INK }}>
              {candidate.fullName}
              {candidate.inTalentPool && (
                <span className="ml-1.5 align-middle text-[12px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "var(--mint)", color: "var(--forest)" }} title="In the talent pool">
                  ☆ Pool
                </span>
              )}
            </p>
            <p className="text-[13px] truncate" style={{ color: INK_MUTED }}>
              {candidate.jobTitle}
              {candidate.company ? ` · ${candidate.company}` : ""}
              {candidate.location ? ` · ${candidate.location}` : ""}
              {candidate.distanceMiles != null ? ` (~${candidate.distanceMiles} mi)` : ""}
            </p>
          </div>

          {show("currentRole") && (
            <div className="hidden lg:block w-40 shrink-0 text-[13px] truncate" style={{ color: INK_MUTED }}>
              {[candidate.currentTitle, candidate.currentCompany].filter(Boolean).join(" at ") || "-"}
            </div>
          )}

          {show("skills") && (
            <div className="hidden lg:flex flex-wrap gap-1 w-40 shrink-0">
              {candidate.skills.slice(0, 3).map((s) => (
                <span key={s} className="text-[12px] px-1.5 py-0.5 rounded-full" style={{ background: "var(--mist)", color: INK_MUTED }}>
                  {s}
                </span>
              ))}
            </div>
          )}

          {show("recruiter") && (
            <div className="hidden md:block w-24 shrink-0 text-[13px] truncate" style={{ color: INK_MUTED }}>
              {candidate.recruiterName ?? "Unassigned"}
            </div>
          )}

          {show("source") && (
            <div className="hidden md:block w-24 shrink-0 text-[13px] truncate" style={{ color: INK_MUTED }}>
              {candidate.source || "-"}
            </div>
          )}

          {show("stage") && (
            <div className="hidden sm:block w-24 shrink-0">
              <StageBadge stage={candidate.stage} status={candidate.status} />
            </div>
          )}

          {show("lastActivity") && (
            <div className="hidden md:block w-24 shrink-0 text-[12px] truncate" style={{ color: INK_FAINT }} title="Last activity">
              {candidate.lastActivityAt ? formatRelativeTime(candidate.lastActivityAt) : "-"}
            </div>
          )}

          {show("added") && (
            <div className="hidden md:block w-16 shrink-0 text-[12px]" style={{ color: INK_FAINT }} title="Added">
              {shortDate(candidate.createdAt)}
            </div>
          )}

          {show("nextAction") && (
            <div className="hidden xl:block w-40 shrink-0 text-[12px] truncate" style={{ color: overdue ? "#b91c1c" : INK_FAINT }}>
              {candidate.nextAction ? `${overdue ? "Overdue: " : "Next: "}${candidate.nextAction.label}` : ""}
            </div>
          )}

          {show("score") && <ScorePill score={candidate.score} />}
        </Link>
      </div>
    </li>
  );
}
