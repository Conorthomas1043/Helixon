"use client";

// Part of the talent pool page (app/dashboard/talent-pool/page.jsx).

import Link from "next/link";
import { Avatar } from "@/app/analyse/_components/compareBits";
import { Icon, Spinner, cx } from "@/app/analyse/_components/ui";
import { formatRelativeTime } from "@/lib/candidate-format";
import { scoreTone } from "@/app/analyse/_lib/analyse";
import { AvailabilityPicker, CheckInPicker, NoteEditor, PoolExpiry } from "./pickers";

export function fitTone(fit) {
  if (fit == null) return { fg: "var(--ink-faint)", ring: "var(--border)", label: "Can't check" };
  if (fit >= 70) return { fg: "var(--score-strong)", ring: "var(--score-strong)", label: "Likely fit" };
  if (fit >= 40) return { fg: "var(--score-mid)", ring: "var(--score-mid)", label: "Partial fit" };
  return { fg: "var(--score-low)", ring: "var(--score-low)", label: "Unlikely fit" };
}

/* ── Small pieces ─────────────────────────────────────────────────────── */

export function Chip({ children, tone = "plain", title }) {
  const styles = {
    plain: "bg-[var(--mist)] text-[var(--ink-soft)]",
    match: "bg-[var(--mint)] text-[var(--forest-deep)]",
    miss: "bg-[#fbefed] text-[#a83226]",
  };
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 text-[12px] font-medium px-2 py-0.5 rounded-full", styles[tone])}>
      {tone === "match" && <Icon name="check" size={10} strokeWidth={2.4} />}
      {tone === "miss" && <Icon name="x" size={10} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

export function FitRing({ fit, size = 52 }) {
  const tone = fitTone(fit);
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center shrink-0" title="Quick keyword check of their CV against the job's requirements - not the real screening score">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--mist)" strokeWidth="5" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={tone.ring}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - (fit ?? 0) / 100)}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[14px] font-semibold tabular-nums" style={{ color: tone.fg }}>
          {fit == null ? "–" : fit}
        </span>
      </div>
      <span className="text-[11.5px] mt-1 text-[var(--ink-faint)] whitespace-nowrap">{tone.label}</span>
    </div>
  );
}

export function RoleLink({ role }) {
  const tone = scoreTone(role.score);
  return (
    <Link
      href={`/dashboard/candidates/${role.candidateId}`}
      className="inline-flex items-center gap-1.5 text-[12.5px] px-2 py-0.5 rounded-full border border-[var(--border)] bg-white hover:bg-[var(--mist)]"
      title={`Screened for ${role.jobTitle}`}
    >
      <span className="truncate max-w-[160px] text-[var(--ink-soft)]">{role.jobTitle}</span>
      {role.score != null && (
        <b className="tabular-nums" style={{ color: tone.fg }}>
          {role.score}
        </b>
      )}
    </Link>
  );
}

export function RowStatus({ item, screened, screening }) {
  const status = screening?.status;
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-soft)]">
        <Spinner size={12} /> Screening…
      </span>
    );
  if (status === "queued") return <span className="text-[13px] text-[var(--ink-faint)]">Queued</span>;
  if (status === "failed") return <span className="text-[13px] text-[#a83226] max-w-[200px] sm:text-right">{screening.error}</span>;
  if (screened)
    return (
      <Link href={`/dashboard/candidates/${screened.candidateId}`} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--forest)] hover:underline">
        Screened{screened.score != null ? `: ${screened.score}` : ""}
        <Icon name="arrowRight" size={12} />
      </Link>
    );
  if (!item.hasCv) return <span className="text-[12px] text-[var(--ink-faint)]">No CV text on file</span>;
  return null;
}

/* ── A person in the pool ─────────────────────────────────────────────── */

export function PoolRow({ item, job, selected, onToggle, screening, onUpdate, onRemove, onMatchJob, busy }) {
  const screened = job ? item.screened : null;
  const canPick = job ? !screened && item.hasCv && !screening : true;

  return (
    <li className={cx("px-4 sm:px-5 py-4 transition-colors", selected ? "bg-[#f4faf7]" : "bg-white hover:bg-[#fbfcfb]")}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          disabled={!canPick}
          onChange={() => onToggle(item.id)}
          aria-label={`Select ${item.name}`}
          className="mt-3 w-4 h-4 shrink-0 accent-[var(--forest)] disabled:opacity-30"
        />
        <Link href={`/dashboard/candidates/${item.id}`} className="shrink-0 mt-0.5" tabIndex={-1} aria-hidden="true">
          <Avatar name={item.name} size={42} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <Link href={`/dashboard/candidates/${item.id}`} className="text-[15px] font-semibold text-[var(--ink)] hover:underline">
              {item.name}
            </Link>
            <AvailabilityPicker value={item.status} disabled={busy} onChange={(v) => onUpdate(item, { status: v })} />
            <CheckInPicker value={item.checkIn} disabled={busy} onChange={(v) => onUpdate(item, { checkIn: v })} />
          </div>
          <p className="text-[13.5px] text-[var(--ink-soft)] mt-1">
            {[item.currentTitle, item.currentCompany].filter(Boolean).join(" · ") || "No current role on file"}
            <span className="text-[var(--ink-faint)]">
              {[item.location, item.yearsExperience != null && `${item.yearsExperience} yrs`]
                .filter(Boolean)
                .map((x) => ` · ${x}`)
                .join("")}
            </span>
          </p>

          <NoteEditor note={item.note} onSave={(note) => onUpdate(item, { note })} />

          {job ? (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {item.matched.map((s) => (
                <Chip key={`m-${s}`} tone="match">
                  {s}
                </Chip>
              ))}
              {item.missing.map((s) => (
                <Chip key={`x-${s}`} tone="miss" title="Not found in their CV">
                  {s}
                </Chip>
              ))}
              {item.experienceOk === false && <Chip tone="miss">Under {job.minYearsExperience} yrs</Chip>}
            </div>
          ) : (
            item.skills.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2.5">
                {item.skills.slice(0, 7).map((s) => (
                  <Chip key={s}>{s}</Chip>
                ))}
                {item.skills.length > 7 && <span className="text-[12px] text-[var(--ink-faint)] self-center">+{item.skills.length - 7}</span>}
              </div>
            )
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5">
            {!job && item.bestMatch && (
              <button
                type="button"
                onClick={() => onMatchJob(item.bestMatch.jobId)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold pl-2 pr-2.5 py-0.5 rounded-full bg-[var(--mint)] text-[var(--forest-deep)] hover:brightness-95"
                title="Their best fit among your open jobs - click to match the pool against it"
              >
                <Icon name="sparkle" size={11} />
                {item.bestMatch.title} · {item.bestMatch.fit}% fit
              </button>
            )}
            {item.roles.length > 0 && (
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] text-[var(--ink-faint)]">Screened for</span>
                {item.roles.map((r) => (
                  <RoleLink key={r.candidateId} role={r} />
                ))}
              </span>
            )}
            <span className="text-[12px] text-[var(--ink-faint)]">
              Saved {formatRelativeTime(item.savedAt)}
              {item.savedBy ? ` by ${item.savedBy}` : ""}
            </span>
            <PoolExpiry expiresAt={item.expiresAt} disabled={busy} onExtend={() => onUpdate(item, { extend: true })} />
          </div>

          {/* Fit and status under the name on phones - the side column is too tight there. */}
          {job && (
            <div className="sm:hidden flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[13.5px]">
              <span className="font-semibold tabular-nums" style={{ color: fitTone(item.fit).fg }}>
                {item.fit == null ? "No fit score" : `${item.fit}% fit`}
              </span>
              <RowStatus item={item} screened={screened} screening={screening} />
            </div>
          )}
        </div>

        <div className="hidden sm:flex flex-col items-end gap-2 shrink-0 min-w-[96px]">
          {job ? (
            <>
              <FitRing fit={item.fit} />
              <RowStatus item={item} screened={screened} screening={screening} />
            </>
          ) : (
            <details className="relative">
              <summary className="list-none cursor-pointer px-2 py-1 rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--mist)]" aria-label={`More for ${item.name}`}>
                <span aria-hidden="true" className="text-[16px] leading-none">⋯</span>
              </summary>
              <div className="absolute right-0 mt-1 w-48 rounded-[10px] p-1 z-20 bg-white border border-[var(--border)] shadow-[0_12px_32px_rgba(19,32,27,0.14)]">
                <Link href={`/dashboard/candidates/${item.id}`} className="block text-[13.5px] px-2.5 py-1.5 rounded-[8px] hover:bg-[var(--mist)]">
                  Open profile
                </Link>
                {item.bestMatch && (
                  <button type="button" onClick={() => onMatchJob(item.bestMatch.jobId)} className="w-full text-left text-[13.5px] px-2.5 py-1.5 rounded-[8px] hover:bg-[var(--mist)]">
                    Match to {item.bestMatch.title}
                  </button>
                )}
                <button type="button" onClick={() => onRemove(item)} className="w-full text-left text-[13.5px] px-2.5 py-1.5 rounded-[8px] text-[#a83226] hover:bg-[#fbefed]">
                  Remove from pool
                </button>
              </div>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}
