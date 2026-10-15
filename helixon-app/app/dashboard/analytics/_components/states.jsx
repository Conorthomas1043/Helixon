"use client";

// Part of the analytics page (../page.jsx): loading and error states.

import { INK, INK_MUTED, CARD } from "@/lib/candidates/format";
import { Skeleton as Block } from "@/components/ui";

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading analytics">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-card p-5" style={CARD}>
            <Block className="h-3 w-20 mb-3" />
            <Block className="h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="rounded-card p-6" style={CARD}>
        <Block className="h-4 w-40 mb-5" />
        <Block className="h-40 w-full" />
      </div>
    </div>
  );
}

export function ErrorState({ onRetry }) {
  return (
    <div className="rounded-2xl p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1 text-[var(--ink)]">
        Unable to load analytics
      </p>
      <p className="text-sm mb-5 max-w-sm text-[var(--ink-soft)]">
        Something went wrong while loading recruitment analytics.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center text-14 font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 bg-[var(--forest)] text-white"
      >
        Try again
      </button>
    </div>
  );
}
