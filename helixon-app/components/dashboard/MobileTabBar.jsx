"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, cx } from "@/components/ui";
import { trapTab } from "@/lib/ui/focus-trap";

// On phones the dashboard's destinations sit in a tab bar at the bottom of
// the screen, in thumb reach: the four everyday screens and "More", which
// opens a sheet with everything else. On wider screens the top bar
// (components/DashboardNav.jsx) carries them instead. The page keeps room
// for the bar with `body:has(.mobile-tabbar)` in app/globals.css.

const PRIMARY = [
  { href: "/dashboard", label: "Overview", icon: "command" },
  { href: "/analyse", label: "Screen", icon: "wand" },
  { href: "/dashboard/candidates", label: "Candidates", icon: "users" },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: "layers" },
];

export const MOBILE_PRIMARY_HREFS = PRIMARY.map((t) => t.href);

/**
 * @param {{ activeHref: string | null, groups: { group: string, links: { href: string, label: string, hint?: string, team?: boolean }[] }[], plan?: string | null }} props
 *   groups: everything not in the bar, grouped as the desktop "More" menu is.
 */
export default function MobileTabBar({ activeHref, groups, plan = null }) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef(null);
  const moreRef = useRef(null);
  const inMore = activeHref && !MOBILE_PRIMARY_HREFS.includes(activeHref);

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    sheet?.querySelector("a, button")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "Tab") trapTab(e, sheet);
    };
    document.addEventListener("keydown", onKey);
    const more = moreRef.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      more?.focus();
    };
  }, [open]);

  return (
    <>
      <nav aria-label="Pages" className="mobile-tabbar md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <ul className="grid grid-cols-5">
          {PRIMARY.map((t) => {
            const active = t.href === activeHref;
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex flex-col items-center justify-center gap-0.5 h-14 text-11 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--forest)]",
                    active ? "text-[var(--forest)] font-semibold" : "text-[var(--ink-soft)]"
                  )}
                >
                  <span className={cx("flex items-center justify-center w-12 h-7 rounded-full", active && "bg-[var(--mint)]")}>
                    <Icon name={t.icon} size={19} strokeWidth={active ? 2 : 1.7} />
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              ref={moreRef}
              type="button"
              aria-expanded={open}
              aria-haspopup="dialog"
              onClick={() => setOpen(true)}
              className={cx(
                "w-full flex flex-col items-center justify-center gap-0.5 h-14 text-11 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--forest)]",
                inMore ? "text-[var(--forest)] font-semibold" : "text-[var(--ink-soft)]"
              )}
            >
              <span className={cx("flex items-center justify-center w-12 h-7 rounded-full", inMore && "bg-[var(--mint)]")}>
                <Icon name="menu" size={19} />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <button type="button" aria-label="Close menu" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40 fade-up-in" />
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="All pages"
            className="relative max-h-[80vh] overflow-y-auto rounded-t-2xl bg-[var(--bg)] px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_-12px_rgba(19,32,27,0.3)] fade-up-in"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-15 font-semibold font-display text-[var(--ink)]">All pages</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-[var(--ink-soft)] hover:bg-[var(--mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]">
                <Icon name="x" size={18} />
              </button>
            </div>
            {groups.map((g) => (
              <div key={g.group} className="mb-3">
                <p className="text-12 font-semibold uppercase tracking-widest px-2 mb-1 text-[var(--ink-faint)]">{g.group}</p>
                {g.links.map((l) => {
                  const active = l.href === activeHref;
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className="block px-2 py-2.5 rounded-lg hover:bg-[var(--mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
                    >
                      <span className={cx("flex items-center gap-1.5 text-14", active ? "text-[var(--forest)] font-semibold" : "text-[var(--ink)] font-medium")}>
                        {l.label}
                        {l.team && plan && plan !== "agency" && <span className="text-12 font-semibold px-1.5 py-px rounded-full bg-[var(--mint)] text-[var(--forest)]">Agency plan</span>}
                      </span>
                      {l.hint && <span className="block text-13 mt-0.5 text-[var(--ink-soft)]">{l.hint}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
