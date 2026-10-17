"use client";

// Part of the candidate profile page (../page.jsx): the side column as one
// panel with four tabs (Work · Contact · Placement · More) instead of a
// dozen stacked cards, and the "next step" strip under the header.
// Every tab stays mounted, so a half-written email or note survives a
// switch; only the chosen one is shown. Which tabs get opened is recorded,
// so the grouping can be revisited with data.

import { Button, Segmented } from "@/components/ui";
import { track } from "@/lib/analytics/track";

export const RAIL_TABS = [
  { value: "work", label: "Work" },
  { value: "contact", label: "Contact" },
  { value: "place", label: "Placement" },
  { value: "later", label: "More" },
];

export function RailTabs({ tab, onTab, panels }) {
  return (
    <div className="space-y-4">
      <Segmented
        value={tab}
        onChange={(next) => {
          track("profile_tab_opened", { tab: next });
          onTab(next);
        }}
        options={RAIL_TABS} ariaLabel="Candidate tools" fill idPrefix="rail" />
      {RAIL_TABS.map((t) => (
        <div key={t.value} id={`rail-${t.value}-panel`} role="tabpanel" aria-labelledby={`rail-${t.value}`} hidden={tab !== t.value} className="space-y-4">
          {panels[t.value]}
        </div>
      ))}
    </div>
  );
}

export function NextStepStrip({ step, onAct }) {
  if (!step) return null;
  return (
    <div className="fade-up-in flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-[var(--mint-line)] bg-[var(--mint)] px-4 sm:px-5 py-3">
      <p className="min-w-0 flex-1 basis-56 text-14 text-[var(--ink)]">
        <span className="font-semibold text-[var(--forest)]">Next step </span>
        {step.text}
      </p>
      <Button size="sm" variant="primary" iconRight="arrowRight" onClick={() => onAct(step.action)}>
        {step.cta}
      </Button>
    </div>
  );
}
