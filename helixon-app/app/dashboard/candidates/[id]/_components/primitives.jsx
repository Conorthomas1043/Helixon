"use client";

// Part of the candidate profile page (../page.jsx).

import Link from "next/link";
import { CARD, INK, INK_FAINT, INK_MUTED } from "@/lib/candidate-format";
import { track } from "@/lib/analytics";
import { useRef, useState } from "react";
import { Avatar as KitAvatar, SectionHeading, Skeleton as Block } from "@/components/ui";

export { Block, SectionHeading };

// Creates one of the agency's own tags and puts it on this candidate.
export function NewTagForm({ onCreate }) {
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
        className="min-w-0 flex-1 text-[13px] px-2 py-1 rounded-[6px] focus-visible:outline focus-visible:outline-2"
        style={{ border: "1px solid var(--border)", color: INK }}
      />
      <button type="submit" disabled={!label.trim() || saving} className="text-[12px] font-semibold px-2 py-1 rounded-[6px] disabled:opacity-40" style={{ color: "var(--forest)" }}>
        {saving ? "…" : "Add"}
      </button>
    </form>
  );
}

export function Avatar({ name, size = 56 }) {
  return <KitAvatar name={name} size={size} />;
}

export function FieldLabel({ children }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>
      {children}
    </p>
  );
}

export function SelectField({ value, onChange, options, ariaLabel, disabled }) {
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

export function ShortcutsHint() {
  return (
    <details className="relative">
      <summary
        className="list-none cursor-pointer text-[12px] font-semibold px-2.5 py-1.5 rounded-full select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ border: "1px solid var(--border)", color: INK_MUTED }}
      >
        Shortcuts
      </summary>
      <div
        className="absolute right-0 mt-2 w-60 rounded-[10px] p-3 z-20 text-[13px] space-y-2"
        style={{ ...CARD, boxShadow: "0 12px 32px rgba(19,32,27,0.14)" }}
      >
        <div className="flex justify-between gap-3">
          <span style={{ color: INK_MUTED }}>Next / previous candidate</span>
          <kbd className="font-mono text-[12px]" style={{ color: INK }}>J / K</kbd>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: INK_MUTED }}>Shortlist</span>
          <kbd className="font-mono text-[12px]" style={{ color: INK }}>S</kbd>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: INK_MUTED }}>Focus note field</span>
          <kbd className="font-mono text-[12px]" style={{ color: INK }}>N</kbd>
        </div>
        <div className="flex justify-between gap-3">
          <span style={{ color: INK_MUTED }}>Close menus</span>
          <kbd className="font-mono text-[12px]" style={{ color: INK }}>Esc</kbd>
        </div>
      </div>
    </details>
  );
}

/* ------------------------------------------------------------------------
 * Header
 * ---------------------------------------------------------------------- */

// A small "copy" button next to contact details.
export function CopyButton({ text, label }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        })
      }
      className="text-[12px] font-semibold px-1.5 py-0.5 rounded"
      style={{ background: "var(--mist)", color: copied ? "var(--forest)" : INK_FAINT }}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function ProfileSkeleton() {
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

export function StateMessage({ title, body, retryLabel, onRetry }) {
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
            className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {retryLabel ?? "Try again"}
          </button>
        )}
        <Link
          href="/dashboard/candidates"
          className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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

// A titled, collapsible group of panels on the candidate profile. Showing
// the everyday groups open and the occasional ones closed is progressive
// disclosure (Nielsen, 2006, Nielsen Norman Group): fewer visible options
// make the frequent ones faster to find, as choice time grows with the
// number of alternatives (Hick, 1952, Quarterly Journal of Experimental
// Psychology 4(1); Hyman, 1953, Journal of Experimental Psychology 45(3)).
// Group titles name the task, which is what people scan for (Pirolli &
// Card, 1999, "Information foraging", Psychological Review 106(4)).
// Opening a group and using a panel in it are recorded, so the order can
// be revisited with data (docs/ux-research-audit.md, R4).
export function PanelGroup({ id, title, summary, defaultOpen = false, children }) {
  const usedRef = useRef(false);
  return (
    <details
      open={defaultOpen}
      className="group/panel space-y-4"
      onToggle={(e) => track("profile_group_toggled", { group: id, open: e.currentTarget.open })}
      onClickCapture={(e) => {
        if (usedRef.current || e.target.closest("summary")) return;
        usedRef.current = true;
        track("profile_panel_used", { group: id });
      }}
    >
      <summary className="list-none cursor-pointer select-none flex items-center justify-between gap-3 rounded-[12px] px-4 py-3 min-h-[44px] bg-white border border-[var(--border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forest)] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold" style={{ color: "var(--ink)" }}>{title}</span>
          {summary && <span className="block text-[13px] group-open/panel:hidden" style={{ color: "var(--ink-faint)" }}>{summary}</span>}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0 transition-transform group-open/panel:rotate-180" style={{ color: "var(--ink-faint)" }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      {children}
    </details>
  );
}
