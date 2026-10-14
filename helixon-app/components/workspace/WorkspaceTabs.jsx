"use client";

// The strip of open records under the main nav: every candidate, job,
// client or shortlist opened recently, one click away (lib/workspace/tabs.js,
// stored per user by lib/hooks/useWorkspaceTabs.js). With two or more
// candidates open, "Split view" shows them side by side
// (app/dashboard/workspace).
//
// It sits below the sticky nav and scrolls with the page, so the sticky
// headers further down (report sections, side rails) keep the offset they
// were built for.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, cx } from "@/components/ui";
import { useEffect, useSyncExternalStore } from "react";
import { markTabReturn, setTabsCookie, useWorkspaceTabs } from "@/lib/hooks/useWorkspaceTabs";
import { TAB_KINDS, neighbourAfterClose, tabHref, tabKey, tabKeyForPath } from "@/lib/workspace/tabs";
import { splitViewHref } from "@/lib/workspace/panes";

const noSubscribe = () => () => {};

export default function WorkspaceTabs() {
  const { tabs, close, closeAll } = useWorkspaceTabs();
  const pathname = usePathname();
  const router = useRouter();
  const activeKey = tabKeyForPath(pathname);
  // Before the tabs are read (the server render, hydration) this holds the
  // strip's place - sized in CSS only when the cookie says there are tabs.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  useEffect(() => {
    // Tabs gone some other way (storage cleared): stop reserving room.
    if (hydrated && !tabs.length) setTabsCookie(false);
  }, [hydrated, tabs.length]);
  if (!hydrated) return <div className="ws-tabs-slot" aria-hidden="true" />;

  function onClose(key) {
    if (key === activeKey) {
      const next = neighbourAfterClose(tabs, key);
      if (next) {
        markTabReturn(tabKey(next));
        router.push(tabHref(next));
      }
    }
    close(key);
  }

  return <WorkspaceTabStrip tabs={tabs} activeKey={activeKey} onClose={onClose} onCloseAll={closeAll} />;
}

/**
 * The strip itself, drawn from props (the UI gallery shows it with sample
 * tabs).
 * @param {{
 *   tabs: import("@/lib/workspace/tabs").WorkspaceTab[],
 *   activeKey: string | null,
 *   onClose: (key: string) => void,
 *   onCloseAll: () => void,
 * }} props
 */
export function WorkspaceTabStrip({ tabs, activeKey, onClose, onCloseAll }) {
  if (!tabs.length) return null;

  const candidateIds = tabs.filter((t) => t.kind === "candidate").map((t) => t.id);
  // The candidate on screen goes first, then the most recently opened.
  const current = activeKey?.startsWith("candidate:") ? activeKey.slice("candidate:".length) : null;
  const splitIds = [...new Set([...(current ? [current] : []), ...candidateIds.slice().reverse()])];

  return (
    <nav aria-label="Open records" className="print-hide border-b border-[var(--border)] bg-[var(--mist)]">
      {/* A fixed height, matched by .ws-tabs-slot in globals.css. */}
      <div className="mx-auto flex h-10 max-w-[1500px] items-center gap-2 px-4 sm:px-6">
        <ul className="scroll-fade-x flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const key = tabKey(tab);
            const active = key === activeKey;
            const kind = TAB_KINDS[tab.kind];
            return (
              <li key={key} className="shrink-0">
                <span
                  className={cx(
                    "group flex items-center rounded-lg border text-sm",
                    active
                      ? "border-[var(--border)] bg-white text-[var(--ink)] shadow-sm"
                      : "border-transparent text-[var(--ink-soft)] hover:bg-white hover:text-[var(--ink)]"
                  )}
                >
                  <Link
                    href={tabHref(tab)}
                    // Back to where you were on that page.
                    onClick={() => markTabReturn(key)}
                    aria-current={active ? "page" : undefined}
                    title={`${kind.label}: ${tab.title}`}
                    className="flex max-w-[220px] items-center gap-1.5 rounded-l-lg py-1 pl-2.5 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
                  >
                    <Icon name={kind.icon} size={13} className="shrink-0 opacity-70" />
                    <span className={cx("truncate", active && "font-semibold")}>{tab.title}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onClose(key)}
                    aria-label={`Close ${tab.title}`}
                    className="rounded-r-lg px-1.5 py-1.5 opacity-50 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
                  >
                    <Icon name="x" size={12} />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        {splitIds.length >= 2 && (
          <Link
            href={splitViewHref(splitIds)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold text-[var(--forest)] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
          >
            <Icon name="compare" size={14} />
            <span className="hidden sm:inline">Split view</span>
          </Link>
        )}
        <button
          type="button"
          onClick={onCloseAll}
          className="shrink-0 rounded-lg px-2 py-1 text-xs text-[var(--ink-soft)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
        >
          Close all
        </button>
      </div>
    </nav>
  );
}
