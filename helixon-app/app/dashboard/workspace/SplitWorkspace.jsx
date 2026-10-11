"use client";

// Up to four candidates side by side, each pane showing their screening
// report, their CV or a profile summary (CandidatePane.jsx). The layout is
// the address (lib/workspace/panes.js), so every change replaces it: a
// reload, a bookmark or a link to a teammate opens the same view.

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { EmptyState, cx } from "@/components/ui";
import { MAX_PANES, addPane, paneGridClass, parsePanes, removePane, serializePanes, setPaneView } from "@/lib/workspace/panes";
import CandidatePane from "./CandidatePane";
import CandidatePicker from "./CandidatePicker";

export default function SplitWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const panes = parsePanes(searchParams.get("open"));

  const update = useCallback(
    (next) => {
      const open = serializePanes(next);
      router.replace(open ? `${pathname}?open=${open}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  const full = panes.length >= MAX_PANES;

  return (
    <main className="min-h-screen bg-[var(--mist)]">
      <DashboardNav />
      <div className="mx-auto max-w-[1500px] px-4 sm:px-6 py-5">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">Split view</h1>
            <p className="text-sm text-[var(--ink-soft)]">
              Up to {MAX_PANES} candidates side by side. Switch each pane between their score, their CV and their profile.
            </p>
          </div>
          {!full && <CandidatePicker exclude={panes.map((p) => p.id)} onPick={(id) => update(addPane(panes, id))} />}
        </header>

        {panes.length === 0 ? (
          <EmptyState
            title="Nothing open yet"
            body="Find a candidate above to open them here, or pick several on the Candidates list and choose Open side by side."
          />
        ) : (
          <div className={cx("grid gap-4", paneGridClass(panes.length))}>
            {panes.map((pane) => (
              <CandidatePane
                key={pane.id}
                id={pane.id}
                view={pane.view}
                tall={panes.length <= 3}
                onView={(view) => update(setPaneView(panes, pane.id, view))}
                onClose={() => update(removePane(panes, pane.id))}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
