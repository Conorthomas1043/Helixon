"use client";

import { Icon as KitIcon } from "@/components/ui";

// Part of the employee mobile app (EmployeeMobileApp.jsx).

export const RED = "#e0554f";
export const AMBER = "#d99a3a";
export const GRAY = "#94a3b8";

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
    <h2 className="text-12 font-semibold uppercase tracking-wide mb-2.5 mt-5 first:mt-0" style={{ color: "var(--ink-faint)" }}>
      {children}
    </h2>
  );
}

export function ErrorNotice({ message }) {
  if (!message) return null;
  return (
    <div className="text-13 rounded-btn px-3 py-2.5 mb-3" style={{ background: "#fdf1f0", color: RED, border: "1px solid #f6d6d3" }}>
      {message}
    </div>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────

export function Kpi({ label, value }) {
  return (
    <div className="rounded-card p-3.5" style={{ background: "white", border: "1px solid var(--border)" }}>
      <div className="text-11 font-medium mb-1" style={{ color: "var(--ink-faint)" }}>
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
        {value}
      </div>
    </div>
  );
}
