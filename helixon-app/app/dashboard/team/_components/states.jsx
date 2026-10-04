"use client";

// Part of the team page (app/dashboard/team/page.jsx).

import { Skeleton as Block } from "@/components/ui";
import { CARD, INK, INK_MUTED } from "@/lib/candidate-format";

export function TeamSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true" aria-label="Loading team">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-[14px] p-5" style={CARD}>
          <Block className="h-11 w-11 rounded-full mb-4" />
          <Block className="h-14 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }) {
  return (
    <div className="rounded-[16px] p-10 flex flex-col items-center text-center" style={CARD}>
      <p className="text-base font-semibold mb-1" style={{ color: INK }}>
        Unable to load team
      </p>
      <p className="text-sm mb-5 max-w-sm" style={{ color: INK_MUTED }}>
        Something went wrong while loading recruiter workload.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--forest)", color: "white" }}
      >
        Try again
      </button>
    </div>
  );
}
