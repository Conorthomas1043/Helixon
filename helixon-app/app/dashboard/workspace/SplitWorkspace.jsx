"use client";

// Up to four candidates side by side, each pane showing their screening
// report, their CV or a profile summary (CandidatePane.jsx). The layout is
// the address (lib/workspace/panes.js), so every change replaces it: a
// reload, a bookmark or a link to a teammate opens the same view.

import { useCallback, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";
import { EmptyState, cx } from "@/components/ui";
import { MAX_PANES, addPane, paneGridClass, parsePanes, removePane, serializePanes, setPaneView } from "@/lib/workspace/panes";
import CandidatePane from "./CandidatePane";
import CandidatePicker from "./CandidatePicker";
import { track } from "@/lib/analytics/track";

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
  // Compare takes 2-4 candidates; with fewer it opens its chooser.
  const compareHref = panes.length >= 2 ? `/analyse/compare?ids=${panes.map((p) => p.id).join(",")}` : "/analyse/compare";

  // How the split view gets used: how many panes it's opened with, and which
  // views people switch to.
  const initialPanes = panes.length;
  useEffect(() => {
    track("split_view_opened", { panes: initialPanes });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per visit
  }, []);

  return (
    // On a laptop the page is exactly the window's height and the panes share
    // whatever the nav, tabs and header leave, each scrolling on its own. On
    // a phone they stack and the page scrolls.
    <main className="flex min-h-screen flex-col bg-[var(--mist)] lg:h-screen lg:min-h-[640px]">
      <DashboardNav />
      <div className="mx-auto flex w-full max-w-[1500px] min-h-0 flex-1 flex-col px-4 sm:px-6 py-5">
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)]">Split view</h1>
            <p className="text-sm text-[var(--ink-soft)]">
              Up to {MAX_PANES} candidates side by side, each in their own pane: their full report, their CV or their profile. To line
              candidates up skill by skill against one job instead, use{" "}
              <Link href={compareHref} className="font-semibold text-[var(--forest)] hover:underline">
                Compare
              </Link>
              .
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
          <div className={cx("grid min-h-0 flex-1 gap-4", paneGridClass(panes.length))}>
            {panes.map((pane) => (
              <CandidatePane
                key={pane.id}
                id={pane.id}
                view={pane.view}
                onView={(view) => {
                  track("split_view_pane_view", { view });
                  update(setPaneView(panes, pane.id, view));
                }}
                onClose={() => update(removePane(panes, pane.id))}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
