"use client";

// Options above a client profile / client pack: anonymise, include the
// "points to explore", show the match score, and print. Hidden from the
// printout itself (.print-hide).

import Link from "next/link";
import { INK, INK_MUTED, CARD } from "@/lib/candidates/format";

function Toggle({ checked, onChange, children }) {
  return (
    <label className="inline-flex items-center gap-2 text-13 font-medium cursor-pointer text-[var(--ink)]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--forest)]" />
      {children}
    </label>
  );
}

export default function ClientProfileToolbar({ backHref, backLabel, options, onOptions, onPrint, printing, disabled }) {
  const set = (key) => (value) => onOptions({ ...options, [key]: value });
  return (
    <div className="print-hide rounded-card p-4 flex flex-wrap items-center gap-x-5 gap-y-3" style={CARD}>
      <Link href={backHref} className="text-13 font-semibold" style={{ color: INK_MUTED }}>
        ← {backLabel}
      </Link>
      <Toggle checked={options.blind} onChange={set("blind")}>Anonymise</Toggle>
      <Toggle checked={options.includeConcerns} onChange={set("includeConcerns")}>Include points to explore</Toggle>
      <Toggle checked={options.showScore} onChange={set("showScore")}>Show match score</Toggle>
      <button
        type="button"
        onClick={onPrint}
        disabled={disabled || printing}
        className="ml-auto text-14 font-semibold px-4 py-2 rounded-full disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 bg-[var(--forest)] text-[var(--on-accent)]"
      >
        Print / Save as PDF
      </button>
      {options.blind && (
        <p className="w-full text-12 text-[var(--ink-soft)]">
          Names, employers, institutions and location are withheld, including where they appear in the text. A distinctive
          career history can still identify someone - read it through before sending.
        </p>
      )}
    </div>
  );
}
