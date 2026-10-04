"use client";

// Shown while /api/run works. The steps advance on a timer (the server
// doesn't stream progress) and describe the real pipeline order; the elapsed
// clock is honest about how long it's taking.

import { useEffect, useState } from "react";
import { Card, Icon, Spinner, cx } from "./ui";
import { RUN_STEPS } from "../_lib/analyse";

export default function RunningPanel({ fileName, roleLabel, step, compare }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="max-w-[560px] mx-auto">
      <Card className="px-6 sm:px-8 py-8">
        <div className="flex items-center gap-3">
          <Spinner size={18} />
          <h2 className="text-[17px] font-semibold tracking-tight text-[var(--ink)]" style={{ fontFamily: "var(--font-display)" }}>
            {compare ? "Screening the second candidate" : "Screening candidate"}
          </h2>
          <span className="ml-auto text-[13.5px] tabular-nums text-[var(--ink-faint)]" aria-label={`${elapsed} seconds elapsed`}>
            {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </span>
        </div>
        <p className="text-[14px] text-[var(--ink-soft)] mt-2 truncate">
          <span className="text-[var(--ink)] font-medium">{fileName}</span>
          {roleLabel ? <> against <span className="text-[var(--ink)] font-medium">{roleLabel}</span></> : null}
        </p>

        <ol className="mt-7 space-y-0" aria-label="Analysis progress">
          {RUN_STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s.label} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span
                    className={cx("w-6 h-6 rounded-full flex items-center justify-center border transition-colors")}
                    style={{
                      background: done ? "var(--forest)" : "white",
                      borderColor: done || current ? "var(--forest)" : "var(--border)",
                      color: done ? "white" : "var(--forest)",
                    }}
                  >
                    {done ? <Icon name="check" size={12} strokeWidth={2.6} /> : current ? <span className="w-1.5 h-1.5 rounded-full bg-[var(--forest)] animate-pulse motion-reduce:animate-none" /> : null}
                  </span>
                  {i < RUN_STEPS.length - 1 && <span className="w-px flex-1 min-h-[22px] my-1" style={{ background: done ? "var(--forest)" : "var(--border)" }} />}
                </div>
                <div className="pb-5 -mt-0.5">
                  <p className={cx("text-[14.5px]", current ? "font-semibold text-[var(--ink)]" : done ? "text-[var(--ink)]" : "text-[var(--ink-faint)]")}>{s.label}</p>
                  <p className={cx("text-[13px] mt-0.5", current ? "text-[var(--ink-soft)]" : "text-[var(--ink-faint)]")}>{s.detail}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="text-[13px] text-[var(--ink-faint)] border-t border-[var(--border-soft)] pt-4">
          {elapsed > 60
            ? "Longer CVs and detailed specs take a little more time. Keep this tab open."
            : "The candidate is saved to your pipeline as soon as the assessment finishes."}
        </p>
      </Card>
    </div>
  );
}
