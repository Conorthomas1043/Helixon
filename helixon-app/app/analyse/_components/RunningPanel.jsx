"use client";

// Shown while /api/run works. The CV page on the left is scanned as the steps
// advance, and the must-haves the recruiter asked for are listed as what the
// run is looking for. The steps follow the analysis as /api/run streams its
// progress (a timer stands in until the first update arrives, or if it never
// does); the elapsed clock is honest about how long it's taking.

import { useEffect, useState } from "react";
import { Card, Icon, Spinner, cx } from "./ui";
import { RUN_STEPS } from "../_lib/analyse";

// The CV page's text lines, as widths. Lines light up as the run reads them.
const LINES = ["w-2/3", "w-full", "w-11/12", "w-4/5", "w-full", "w-3/5", "w-11/12", "w-full", "w-2/3", "w-5/6", "w-full", "w-3/4"];
const HEADINGS = new Set([0, 4, 8]);

function CvPage({ fileName, step }) {
  // How far down the page the run has read: a quarter per step.
  const read = Math.min(LINES.length, Math.round(((step + 1) / RUN_STEPS.length) * LINES.length));
  return (
    <div
      className="relative mx-auto w-[150px] sm:w-full aspect-[3/4] rounded-lg border border-[var(--border)] bg-[var(--bg)] shadow-sm overflow-hidden p-3.5"
      aria-hidden="true"
    >
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full shrink-0 bg-[var(--mint)] border border-[var(--mint-line)] flex items-center justify-center text-[var(--forest)]">
          <Icon name="file" size={13} />
        </span>
        <span className="min-w-0 text-11 font-semibold truncate text-[var(--ink)]">{fileName || "CV"}</span>
      </div>
      <div className="mt-3.5 space-y-2">
        {LINES.map((w, i) => (
          <div
            key={i}
            className={cx(
              "rounded-full transition-colors duration-500 motion-reduce:transition-none",
              HEADINGS.has(i) ? "h-1.5 mt-3 first:mt-0" : "h-1",
              HEADINGS.has(i) ? "w-1/3" : w,
              i < read ? (HEADINGS.has(i) ? "bg-[var(--forest)]" : "bg-[var(--mint-line)]") : "bg-[var(--border)]",
            )}
          />
        ))}
      </div>
      <span className="scan-sweep" />
    </div>
  );
}

// The must-haves, with a highlight moving across them so the recruiter can
// see what's being checked. No verdicts here: those arrive with the report.
function LookingFor({ requirements }) {
  const [focus, setFocus] = useState(0);
  useEffect(() => {
    if (requirements.length < 2) return undefined;
    const t = setInterval(() => setFocus((i) => (i + 1) % requirements.length), 1400);
    return () => clearInterval(t);
  }, [requirements.length]);

  return (
    <div className="mt-6">
      <p className="text-13 font-semibold text-[var(--ink)]">Checking your must-haves</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {requirements.map((r, i) => (
          <li
            key={r}
            className={cx(
              "inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full border text-13 transition-colors duration-300 motion-reduce:transition-none",
              i === focus ? "bg-[var(--mint)] border-[var(--mint-line)] text-[var(--forest)]" : "bg-[var(--bg)] border-[var(--border)] text-[var(--ink-soft)]",
            )}
          >
            <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", i === focus ? "bg-[var(--signal)] pulse-dot" : "bg-[var(--border)]")} aria-hidden="true" />
            <span className="truncate">{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RunningPanel({ fileName, roleLabel, step, compare, requirements = [] }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const current = RUN_STEPS[Math.min(step, RUN_STEPS.length - 1)];

  return (
    <div className="max-w-[720px] mx-auto">
      <Card className="px-6 sm:px-8 py-8">
        <div className="flex items-center gap-3">
          <Spinner size={18} />
          <h2 className="text-16 font-semibold tracking-tight text-[var(--ink)] font-display">
            {compare ? "Screening the second candidate" : "Screening candidate"}
          </h2>
          <span className="ml-auto text-14 tabular-nums text-[var(--ink-faint)]" aria-label={`${elapsed} seconds elapsed`}>
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </span>
        </div>
        <p className="text-14 text-[var(--ink-soft)] mt-2 truncate">
          <span className="text-[var(--ink)] font-medium">{fileName}</span>
          {roleLabel ? <> against <span className="text-[var(--ink)] font-medium">{roleLabel}</span></> : null}
        </p>
        {/* One polite announcement per step, not per tick of the clock. */}
        <p className="sr-only" aria-live="polite">{current.label}</p>

        <div className="mt-7 grid gap-7 sm:grid-cols-[170px_1fr] items-start">
          <CvPage fileName={fileName} step={step} />

          <div className="min-w-0">
            <ol aria-label="Analysis progress">
              {RUN_STEPS.map((s, i) => {
                const done = i < step;
                const isCurrent = i === step;
                return (
                  <li key={s.label} className="flex gap-3.5">
                    <div className="flex flex-col items-center">
                      <span
                        className={cx(
                          "w-6 h-6 rounded-full flex items-center justify-center border transition-colors",
                          done ? "bg-[var(--forest)] border-[var(--forest)] text-[var(--on-accent)]" : "bg-[var(--bg)] text-[var(--forest)]",
                          !done && (isCurrent ? "border-[var(--forest)]" : "border-[var(--border)]"),
                        )}
                      >
                        {done ? <Icon name="check" size={12} strokeWidth={2.6} /> : isCurrent ? <span className="w-1.5 h-1.5 rounded-full bg-[var(--forest)] animate-pulse motion-reduce:animate-none" /> : null}
                      </span>
                      {i < RUN_STEPS.length - 1 && <span className={`w-px flex-1 min-h-[18px] my-1 transition-colors duration-500 ${done ? "bg-[var(--forest)]" : "bg-[var(--border)]"}`} />}
                    </div>
                    <div className="pb-4 -mt-0.5">
                      <p className={cx("text-15", isCurrent ? "font-semibold text-[var(--ink)]" : done ? "text-[var(--ink)]" : "text-[var(--ink-faint)]")}>{s.label}</p>
                      <p className={cx("text-13 mt-0.5", isCurrent ? "text-[var(--ink-soft)]" : "text-[var(--ink-faint)]")}>{s.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
            {requirements.length > 0 && <LookingFor requirements={requirements} />}
          </div>
        </div>

        <p className="text-13 text-[var(--ink-faint)] border-t border-[var(--border-soft)] pt-4 mt-6">
          {elapsed > 60
            ? "Longer CVs and detailed specs take a little more time. Keep this tab open."
            : "The candidate is saved to your pipeline as soon as the assessment finishes."}
        </p>
      </Card>
    </div>
  );
}
