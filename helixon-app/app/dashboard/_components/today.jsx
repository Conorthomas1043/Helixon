"use client";

// Part of the dashboard home (app/dashboard/page.js): the "Today" strip under
// the greeting - the three things most worth doing now, each with one
// button. What goes in it, and in what order, is lib/dashboard/today.js.

import { Button, Icon, cx } from "@/components/ui";

const TONE = {
  red: { dot: "bg-[var(--score-low)]", text: "text-[var(--score-low)]", edge: "border-t-[var(--score-low)]" },
  amber: { dot: "bg-[var(--score-mid)]", text: "text-[var(--score-mid)]", edge: "border-t-[var(--score-mid)]" },
  green: { dot: "bg-[var(--score-strong)]", text: "text-[var(--score-strong)]", edge: "border-t-[var(--score-strong)]" },
  neutral: { dot: "bg-[var(--ink-faint)]", text: "text-[var(--ink-soft)]", edge: "border-t-[var(--border)]" },
};

// The cards arrive one after another (globals.css .fade-up-in).
const STAGGER = ["[--stagger-delay:0ms]", "[--stagger-delay:70ms]", "[--stagger-delay:140ms]"];

export function TodayStrip({ cards }) {
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return (
    <section aria-labelledby="today-title">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id="today-title" className="text-20 font-semibold tracking-tight font-display text-[var(--ink)]">
          Today
        </h2>
        <span className="text-13 text-[var(--ink-faint)]">{date}</span>
      </div>
      {cards.length === 0 ? (
        <p className="flex items-center gap-2 rounded-card border border-[var(--border)] bg-[var(--bg)] px-5 py-4 text-14 text-[var(--ink-soft)]">
          <Icon name="check" size={15} className="text-[var(--score-strong)]" />
          Nothing urgent. No interviews in the next day, nothing overdue and no strong matches waiting.
        </p>
      ) : (
        <ol className={cx("grid gap-3 list-none m-0 p-0", cards.length > 1 && "sm:grid-cols-2", cards.length > 2 && "lg:grid-cols-3")}>
          {cards.map((c, i) => {
            const tone = TONE[c.tone] || TONE.neutral;
            return (
              <li
                key={c.id}
                className={cx("fade-up-in flex flex-col rounded-card border border-[var(--border)] border-t-[3px] bg-[var(--bg)] px-5 pt-4 pb-4", tone.edge, STAGGER[i])}
              >
                <p className={cx("flex items-center gap-1.5 text-13 font-semibold", tone.text)}>
                  <span className={cx("w-1.5 h-1.5 rounded-full", tone.dot)} aria-hidden="true" />
                  {c.when}
                </p>
                <p className="mt-1.5 text-15 font-semibold leading-snug text-[var(--ink)]">{c.title}</p>
                <p className="mt-0.5 text-14 text-[var(--ink-soft)] line-clamp-2">{c.body}</p>
                <div className="mt-auto pt-3">
                  <Button size="sm" variant={i === 0 ? "primary" : "secondary"} href={c.href} iconRight="arrowRight">
                    {c.cta}
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
