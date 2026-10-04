"use client";

// Small pieces shared by the compare page's two views (CompareView.jsx and
// RawCvCompare.jsx) and its candidate chooser, styled to match the dashboard
// (pill buttons and tabs, initials avatars, stage colours from the pipeline).

import { useState } from "react";
import Link from "next/link";
import { updateCandidateStage } from "@/lib/dashboard-api";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/stage-labels";
import { initials } from "@/lib/candidates/format";
import { Icon, cx } from "./ui";
import { Avatar as KitAvatar } from "@/components/ui";

// Column letters, A-D, used by both views.
export const LETTERS = ["A", "B", "C", "D"];

const PILL =
  "inline-flex items-center justify-center gap-1.5 text-[14px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

// Same shape as the dashboard's header buttons ("← Dashboard", "+ New analysis").
export function PillButton({ href, primary, icon, children, className = "", ...props }) {
  const cls = cx(
    PILL,
    primary ? "bg-[var(--forest)] text-white hover:bg-[var(--forest-deep)]" : "bg-white border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--mist)]",
    className
  );
  const body = (
    <>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </>
  );
  return href ? (
    <Link href={href} className={cls} {...props}>
      {body}
    </Link>
  ) : (
    <button type="button" className={cls} {...props}>
      {body}
    </button>
  );
}

// Same look as the Candidates page's stage filter chips.
export function PillTabs({ value, onChange, options, ariaLabel }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center gap-1.5 text-[14px] font-semibold px-3.5 py-2 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              on ? "bg-[var(--forest)] border-[var(--forest)] text-white" : "bg-white border-[var(--border)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
            )}
          >
            {o.icon && <Icon name={o.icon} size={14} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({ name, letter, size = 36 }) {
  return <KitAvatar name={name} letter={letter} size={size} bordered />;
}

export function StagePill({ stage }) {
  if (!stage) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-2 py-0.5 rounded-full bg-[var(--mist)] text-[var(--ink)]">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STAGE_COLORS[stage] || "var(--ink-faint)" }} />
      {STAGE_LABELS[stage] || stage}
    </span>
  );
}

// Move a candidate through the pipeline without leaving the comparison.
// Uses the same stage endpoint as the pipeline board and profile page.
export function StagePicker({ candidateId, stage, onChanged }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function change(next) {
    if (!next || next === stage) return;
    setSaving(true);
    setError("");
    try {
      const updated = await updateCandidateStage(candidateId, next);
      onChanged(updated?.stage ?? next);
    } catch (err) {
      setError(err.message || "Couldn't move them.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <label className="relative inline-flex items-center">
        <span className="sr-only">Stage</span>
        <span
          className="absolute left-2.5 w-2 h-2 rounded-full pointer-events-none"
          style={{ background: STAGE_COLORS[stage] || "var(--ink-faint)" }}
          aria-hidden="true"
        />
        <select
          value={stage || ""}
          disabled={saving}
          onChange={(e) => change(e.target.value)}
          className="appearance-none text-[13px] font-semibold pl-6 pr-7 py-1.5 rounded-full border border-[var(--border)] bg-white text-[var(--ink)] hover:border-[var(--ink-mute)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 cursor-pointer"
        >
          {!stage && <option value="">Set stage…</option>}
          {Object.entries(STAGE_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <Icon name="arrowRight" size={11} className="absolute right-2.5 rotate-90 text-[var(--ink-faint)] pointer-events-none" />
      </label>
      {error && <p className="text-[12px] text-[#a83226] mt-1">{error}</p>}
    </div>
  );
}

export const UNBLIND_CONFIRM = {
  title: "Show who this candidate is?",
  body: "This candidate was screened blind. The original CV shows their name and contact details.",
  confirmLabel: "Open the original CV",
};

// Opens the candidate's original uploaded CV in a new tab (a one-minute
// signed link from /api/candidates/[id]/cv). Asks first for anyone screened
// blind, since the file shows who they are; `ask` comes from useConfirm().
// The tab opens straight after the dialog's click resolves `ask`, inside
// that click's user activation, so browsers don't block it as a pop-up.
export async function openOriginalCv(c, ask) {
  if (c.blind && !(await ask(UNBLIND_CONFIRM))) return;
  // Opened before the request so browsers don't treat it as a pop-up.
  const tab = window.open("", "_blank");
  try {
    const res = await fetch(`/api/candidates/${c.id}/cv`, { credentials: "include" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.url) throw new Error();
    tab.location.href = data.url;
  } catch {
    tab?.close();
  }
}
