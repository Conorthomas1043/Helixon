"use client";

// Part of the candidate list (app/dashboard/candidates/page.jsx).

import { CANDIDATE_COLUMNS } from "@/lib/candidates/list-columns";
import { INK, INK_FAINT, INK_MUTED } from "@/lib/candidates/format";

/* ------------------------------------------------------------------------
 * Small pieces
 * ---------------------------------------------------------------------- */

export function FilterChip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-13 font-semibold px-3 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 shrink-0 ${active ? "bg-[var(--forest)]" : "bg-[var(--bg)]"} ${active ? "text-[var(--on-accent)]" : "text-[var(--ink-soft)]"} ${active ? "border border-[var(--forest)]" : "border border-[var(--border)]"}`}
    >
      {children}
      {typeof count === "number" && (
        <span
          className="text-12 font-semibold px-1.5 rounded-full tabular-nums"
          style={{
            background: active ? "rgba(0,0,0,0.2)" : "var(--mist)", // white on 25% white over forest was 3.7:1
            color: active ? "var(--on-accent)" : INK_FAINT,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function Select({ value, onChange, options, ariaLabel }) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-13 font-semibold px-3 py-1.5 rounded-full bg-[var(--bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 border border-[var(--border)] text-[var(--ink)]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// "Columns" - pick which columns the list shows; remembered in this browser.
export function ColumnsMenu({ columns, onChange }) {
  return (
    <details className="relative">
      <summary
        className="list-none cursor-pointer text-13 font-semibold px-3 py-1.5 rounded-full select-none border border-[var(--border)] text-[var(--ink-soft)]"
      >
        Columns
      </summary>
      <div className="absolute right-0 z-20 mt-1.5 w-48 rounded-btn bg-[var(--bg)] p-2 shadow-lg border border-[var(--border)]">
        {CANDIDATE_COLUMNS.map((c) => (
          <label key={c.key} className="flex items-center gap-2 px-1.5 py-1 text-13 rounded hover:bg-[var(--mist)] text-[var(--ink)]">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-[var(--forest)]"
              checked={columns.has(c.key)}
              onChange={() => {
                const next = new Set(columns);
                if (next.has(c.key)) next.delete(c.key);
                else next.add(c.key);
                onChange(next);
              }}
            />
            {c.label}
          </label>
        ))}
        <button
          type="button"
          onClick={() => onChange(new Set(CANDIDATE_COLUMNS.filter((c) => c.default).map((c) => c.key)))}
          className="w-full text-left px-1.5 pt-1.5 mt-1 text-12 font-semibold text-[var(--ink-soft)] border-t border-t-[var(--border)]"
        >
          Reset to default
        </button>
      </div>
    </details>
  );
}
