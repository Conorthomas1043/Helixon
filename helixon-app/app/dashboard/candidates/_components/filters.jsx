"use client";

// Part of the candidate list (app/dashboard/candidates/page.jsx).

import { CANDIDATE_COLUMNS } from "@/lib/list-columns";
import { INK, INK_FAINT, INK_MUTED } from "@/lib/candidate-format";

/* ------------------------------------------------------------------------
 * Small pieces
 * ---------------------------------------------------------------------- */

export function FilterChip({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 shrink-0"
      style={{
        background: active ? "var(--forest)" : "white",
        color: active ? "white" : INK_MUTED,
        border: active ? "1px solid var(--forest)" : "1px solid var(--border)",
      }}
    >
      {children}
      {typeof count === "number" && (
        <span
          className="text-[12px] font-semibold px-1.5 rounded-full tabular-nums"
          style={{
            background: active ? "rgba(255,255,255,0.25)" : "var(--mist)",
            color: active ? "white" : INK_FAINT,
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
      className="text-[13px] font-semibold px-3 py-1.5 rounded-full bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
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

// "Columns" - pick which columns the list shows; remembered in this browser.
export function ColumnsMenu({ columns, onChange }) {
  return (
    <details className="relative">
      <summary
        className="list-none cursor-pointer text-[13px] font-semibold px-3 py-1.5 rounded-full select-none"
        style={{ border: "1px solid var(--border)", color: INK_MUTED }}
      >
        Columns
      </summary>
      <div className="absolute right-0 z-20 mt-1.5 w-48 rounded-[10px] bg-white p-2 shadow-lg" style={{ border: "1px solid var(--border)" }}>
        {CANDIDATE_COLUMNS.map((c) => (
          <label key={c.key} className="flex items-center gap-2 px-1.5 py-1 text-[13px] rounded hover:bg-[var(--mist)]" style={{ color: INK }}>
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
          className="w-full text-left px-1.5 pt-1.5 mt-1 text-[12px] font-semibold"
          style={{ color: INK_MUTED, borderTop: "1px solid var(--border)" }}
        >
          Reset to default
        </button>
      </div>
    </details>
  );
}
