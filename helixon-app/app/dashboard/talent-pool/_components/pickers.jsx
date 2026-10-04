"use client";

// Part of the talent pool page (app/dashboard/talent-pool/page.jsx).

import { Icon, cx } from "@/app/analyse/_components/ui";
import { useState } from "react";
import { AVAILABILITY, todayIso } from "./shared";

export const UNKNOWN = { label: "Availability?", fg: "var(--ink-faint)", bg: "white", dot: "var(--border)" };

export function daysUntil(iso) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function shortDate(iso) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Availability as a coloured pill that is itself the picker.
export function AvailabilityPicker({ value, onChange, disabled }) {
  const a = AVAILABILITY[value] || UNKNOWN;
  return (
    <label
      className="relative inline-flex items-center gap-1.5 text-[12.5px] font-semibold pl-2 pr-6 py-0.5 rounded-full border cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
      style={{ color: a.fg, background: a.bg, borderColor: value ? "transparent" : "var(--border)" }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.dot }} aria-hidden="true" />
      {a.label}
      <Icon name="arrowRight" size={10} className="absolute right-2 rotate-90 opacity-60" />
      <select
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label="Availability"
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        <option value="">Unknown</option>
        {Object.entries(AVAILABILITY).map(([k, v]) => (
          <option key={k} value={k}>
            {v.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// "Check in 3 Oct" chip; the date input sits on top so clicking it opens
// the browser's own date picker.
export function CheckInPicker({ value, onChange, disabled }) {
  const overdue = value && value <= todayIso();
  return (
    <span className="inline-flex items-center">
      <label
        className={cx(
          "relative inline-flex items-center gap-1 text-[12.5px] font-medium px-2 py-0.5 rounded-full border cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-offset-2",
          overdue
            ? "bg-[#fbefed] text-[#a83226] border-transparent font-semibold"
            : value
              ? "bg-white text-[var(--ink-soft)] border-[var(--border)]"
              : "bg-white text-[var(--ink-faint)] border-dashed border-[var(--border)]"
        )}
        title={value ? "Change the check-in date" : "Set a date to check in with them"}
      >
        <Icon name="clock" size={11} />
        {value ? (overdue ? `Check in due · ${shortDate(value)}` : `Check in ${shortDate(value)}`) : "Set check-in"}
        <input
          type="date"
          value={value || ""}
          disabled={disabled}
          min="2020-01-01"
          onClick={(e) => e.currentTarget.showPicker?.()}
          onChange={(e) => onChange(e.target.value || null)}
          aria-label="Check-in date"
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
      {value && (
        <button type="button" onClick={() => onChange(null)} disabled={disabled} aria-label="Clear check-in date" className="ml-0.5 p-0.5 rounded-full text-[var(--ink-faint)] hover:text-[var(--ink)]">
          <Icon name="x" size={11} />
        </button>
      )}
    </span>
  );
}

export function NoteEditor({ note, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note || "");
  const [saving, setSaving] = useState(false);

  if (editing) {
    return (
      <div className="mt-2 flex items-start gap-2 max-w-2xl">
        <textarea
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
          rows={2}
          maxLength={500}
          placeholder="Why keep them? e.g. great closer, wants remote, salary £60k+"
          aria-label="Why keep them"
          className="flex-1 min-w-0 text-[13.5px] px-3 py-2 rounded-[10px] border border-[var(--border)] resize-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--forest)]"
        />
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              const ok = await onSave(text);
              setSaving(false);
              if (ok) setEditing(false);
            }}
            className="text-[13px] font-semibold px-3 py-1 rounded-full bg-[var(--forest)] text-white disabled:opacity-50"
          >
            {saving ? "…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setText(note || "");
            }}
            className="text-[13px] font-semibold px-3 py-1 text-[var(--ink-soft)]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }
  return note ? (
    <button type="button" onClick={() => setEditing(true)} className="group mt-2 flex items-start gap-1.5 text-left" title="Edit note">
      <span className="text-[13.5px] text-[var(--ink)] italic leading-snug">“{note}”</span>
      <span className="text-[12px] font-semibold not-italic text-[var(--ink-faint)] opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
    </button>
  ) : (
    <button type="button" onClick={() => setEditing(true)} className="mt-1.5 text-[13px] font-medium text-[var(--ink-faint)] hover:text-[var(--forest)]">
      + Add a note
    </button>
  );
}

// Entries lapse after the agency's retention period (GDPR storage
// limitation - lib/data-retention.js); within a month of that, offer to
// extend.
export function PoolExpiry({ expiresAt, onExtend, disabled }) {
  if (!expiresAt) return null;
  const days = daysUntil(expiresAt);
  const date = new Date(expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  if (days > 30) {
    return (
      <span className="text-[12px] text-[var(--ink-faint)]" title="Taken out of the pool on this date unless extended - your retention policy">
        · kept until {date}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2 py-0.5 rounded-full bg-[#fdf6e9] text-[#8a5a12]">
      <Icon name="clock" size={11} />
      Leaves the pool {days <= 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}
      <button type="button" onClick={onExtend} disabled={disabled} className="underline underline-offset-2 disabled:opacity-50">
        Extend
      </button>
    </span>
  );
}
