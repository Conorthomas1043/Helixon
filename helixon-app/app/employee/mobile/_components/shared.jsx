"use client";

import { Icon as KitIcon } from "@/components/ui";

// Part of the employee mobile app (EmployeeMobileApp.jsx).

export const RED = "var(--score-low)";
export const AMBER = "var(--gold)";
export const GRAY = "var(--ink-mute)";

// Icons come from the UI kit (components/ui). ICONS keeps the names this app
// passes as `path`, so <Icon path={ICONS.trash} /> still works.
export function Icon({ path, size = 18, strokeWidth = 2, className = "", ...rest }) {
  return <KitIcon name={path} size={size} strokeWidth={strokeWidth} className={className} {...rest} />;
}

export const ICONS = {
  todo: "todo",
  chart: "chart",
  plus: "plus",
  trash: "trash",
  check: "check",
  logout: "logout",
  settings: "settings",
  refresh: "refresh",
  calendar: "calendar",
  chevronRight: "chevronRight",
  phone: "phone",
  folder: "folder",
  file: "file",
};

export function SectionTitle({ children }) {
  return (
    <h2 className="text-12 font-semibold uppercase tracking-wide mb-2.5 mt-5 first:mt-0 text-[var(--ink-faint)]">
      {children}
    </h2>
  );
}

export function ErrorNotice({ message }) {
  if (!message) return null;
  return (
    <div className="text-13 rounded-btn px-3 py-2.5 mb-3 bg-[var(--ui-danger-soft)] text-[var(--score-low)] border border-[var(--danger-line)]">
      {message}
    </div>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────

export function Kpi({ label, value }) {
  return (
    <div className="rounded-card p-3.5 bg-[var(--bg)] border border-[var(--border)]">
      <div className="text-11 font-medium mb-1 text-[var(--ink-faint)]">
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums text-[var(--ink)] font-display">
        {value}
      </div>
    </div>
  );
}
