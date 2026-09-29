"use client";

import { useRef } from "react";

/**
 * WAI-ARIA tabs wiring for a horizontal tab list: ids linking each tab to
 * the panel, a roving tabindex so Tab moves into and out of the list in one
 * stop, and Left/Right/Home/End to move between tabs.
 *
 *   const { tabProps, panelProps } = useRovingTabs({ idPrefix, count, active, onChange });
 *   <div role="tablist">{items.map((_, i) => <button {...tabProps(i)} />)}</div>
 *   <div {...panelProps}>...</div>
 */
export default function useRovingTabs({ idPrefix, count, active, onChange }) {
  const tabRefs = useRef([]);

  function onKeyDown(e) {
    let next = null;
    if (e.key === "ArrowRight") next = (active + 1) % count;
    else if (e.key === "ArrowLeft") next = (active - 1 + count) % count;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = count - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(next);
    tabRefs.current[next]?.focus();
  }

  const tabProps = (i) => ({
    ref: (el) => {
      tabRefs.current[i] = el;
    },
    id: `${idPrefix}-tab-${i}`,
    type: "button",
    role: "tab",
    "aria-selected": active === i,
    "aria-controls": `${idPrefix}-panel`,
    tabIndex: active === i ? 0 : -1,
    onClick: () => onChange(i),
    onKeyDown,
  });

  const panelProps = {
    id: `${idPrefix}-panel`,
    role: "tabpanel",
    "aria-labelledby": `${idPrefix}-tab-${active}`,
    tabIndex: 0,
  };

  return { tabProps, panelProps };
}
