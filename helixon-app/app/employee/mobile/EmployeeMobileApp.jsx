"use client";

import Link from "next/link";
import { can } from "@/lib/employee/permissions";
import { useHeartbeat } from "../_shared/useHeartbeat";
import { useState } from "react";
import { CalendarTab } from "./_components/calendar";
import { CallsTab } from "./_components/calls";
import { FilesTab } from "./_components/files";
import { ICONS, Icon } from "./_components/shared";
import { StatsTab } from "./_components/stats";
import { TodosTab } from "./_components/todos";

// `section` is the permission key (lib/employee/permissions.js); tabs the
// employee can't view aren't shown.
const TABS = [
  { id: "todos", label: "To-dos", icon: "todo", section: "tasks" },
  { id: "calendar", label: "Calendar", icon: "calendar", section: "calendar" },
  { id: "calls", label: "Calls", icon: "phone", section: "cold_calls" },
  { id: "files", label: "Files", icon: "folder", section: "files" },
  { id: "stats", label: "Stats", icon: "chart", section: "platform" },
];

export default function EmployeeMobileApp({ employee }) {
  const tabs = TABS.filter((t) => can(employee, t.section, "view"));
  const [tab, setTab] = useState(() => tabs[0]?.id || null);
  useHeartbeat();

  async function signOut() {
    try {
      await fetch("/api/employee/logout", { method: "POST" });
    } catch {
      // cookie will expire on its own if this fails
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full page load on purpose: it drops all client state after sign-out, account deletion or an expired session
    window.location.assign("/employee/login");
  }

  return (
    <div style={{ background: "var(--mist)", minHeight: "100dvh" }}>
      <header
        className="flex items-center justify-between px-4"
        style={{
          height: 52,
          paddingTop: "env(safe-area-inset-top)",
          background: "white",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
            <span className="text-white text-[12px] font-bold">H</span>
          </div>
          <div className="leading-none">
            <div className="text-[14px] font-semibold" style={{ color: "var(--ink)" }}>
              Staff
            </div>
            <div className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
              {employee?.display_name || employee?.full_name || employee?.username}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href="/employee/settings"
            aria-label="Account settings"
            className="w-9 h-9 flex items-center justify-center rounded-[10px]"
            style={{ color: "var(--ink-soft)" }}
          >
            <Icon path={ICONS.settings} size={18} />
          </Link>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="w-9 h-9 flex items-center justify-center rounded-[10px]"
            style={{ color: "var(--ink-soft)" }}
          >
            <Icon path={ICONS.logout} size={18} />
          </button>
        </div>
      </header>

      <main className="px-4 pt-4" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}>
        {tab === "todos" && <TodosTab />}
        {tab === "calendar" && <CalendarTab employee={employee} />}
        {tab === "calls" && <CallsTab employee={employee} />}
        {tab === "files" && <FilesTab employee={employee} />}
        {tab === "stats" && <StatsTab />}
        {!tab && <p className="text-sm text-center py-16" style={{ color: "var(--ink-soft)" }}>Your account doesn&rsquo;t have access to any of these sections. Ask an admin if you need it.</p>}
      </main>

      <nav
        className="flex items-stretch"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: "white",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
          zIndex: 20,
        }}
        aria-label="Sections"
      >
        {tabs.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5"
              style={{ color: active ? "var(--forest)" : "var(--ink-faint)" }}
              aria-current={active ? "page" : undefined}
            >
              <Icon path={ICONS[t.icon]} size={20} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[11px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
