"use client";

// Part of the candidate list (app/dashboard/candidates/page.jsx).

import { Skeleton as Block, Button, EmptyState as KitEmptyState } from "@/components/ui";
import { INK, INK_MUTED } from "@/lib/candidates/format";

/* ------------------------------------------------------------------------
 * Skeleton / empty / error
 * ---------------------------------------------------------------------- */

export function ListSkeleton() {
  return (
    <div className="space-y-2.5" aria-busy="true" aria-label="Loading candidates">
      {Array.from({ length: 8 }).map((_, i) => (
        <Block key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ hasFilters, onClear }) {
  return (
    <KitEmptyState
      framed={false}
      title={hasFilters ? "No candidates match these filters" : "No candidates yet"}
      body={hasFilters ? "Try widening your search or clearing a filter." : "Candidates will appear here once you start screening CVs against your roles."}
      action={
        hasFilters ? (
          <Button onClick={onClear}>Clear filters</Button>
        ) : (
          <Button variant="primary" href="/analyse">
            Screen a CV
          </Button>
        )
      }
    />
  );
}

export function ErrorState({ onRetry, message }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <p className="text-sm font-semibold mb-1" style={{ color: INK }}>
        Unable to load candidates
      </p>
      <p className="text-[14px] max-w-sm mb-4" style={{ color: INK_MUTED }}>
        {message || "Something went wrong while loading the candidate database."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center text-[14px] font-semibold px-4 py-2 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ background: "var(--forest)", color: "white" }}
      >
        Try again
      </button>
    </div>
  );
}
