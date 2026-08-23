"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COLORS } from "@/lib/account";

const NAV_ICONS = {
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" /></>,
  security: <><path d="M12 3.5l6.5 2.6v4.4c0 4.2-2.7 7.7-6.5 9-3.8-1.3-6.5-4.8-6.5-9V6.1L12 3.5z" /><path d="M9.3 12l1.8 1.8 3.6-3.8" /></>,
  notifications: <><path d="M6 8a6 6 0 0112 0c0 4.5 1.5 6 2 6.5H4c.5-.5 2-2 2-6.5z" /><path d="M9.5 18.5a2.5 2.5 0 005 0" /></>,
  danger: <><path d="M12 2l9.5 16.5H2.5z" /><path d="M12 9v4" /><circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" /></>,
};

const ITEMS = [
  { key: "profile", label: "Profile", href: "/account/profile" },
  { key: "security", label: "Security", href: "/account/security" },
  { key: "notifications", label: "Notifications", href: "/account/notifications" },
  { key: "danger", label: "Danger zone", href: "/account/danger" },
];

export default function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Settings sections" className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-visible sm:w-48 shrink-0 -mx-1 px-1 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
      {ITEMS.map((item) => {
        const isActive = pathname === item.href;
        const isDanger = item.key === "danger";
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-[10px] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)] ${
              !isActive ? (isDanger ? "hover:bg-red-50" : "hover:bg-[var(--mint)]") : ""
            }`}
            style={{
              color: isActive ? COLORS.ink : isDanger ? COLORS.dangerText : COLORS.muted,
              background: isActive ? "var(--mint)" : "transparent",
              fontWeight: isActive ? 600 : 500,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
              {NAV_ICONS[item.key]}
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}