"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { css } from "./_shared/styles";
import { ModalHost } from "./_shared/modal";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ href: "/admin/command", label: "Command" }],
  },
  {
    label: "Security",
    items: [
      { href: "/admin/traffic", label: "Traffic" },
      { href: "/admin/security", label: "Security" },
      { href: "/admin/security/investigate", label: "Investigate" },
      { href: "/admin/pentester", label: "Pentester" },
    ],
  },
  {
    label: "Growth",
    items: [{ href: "/admin/seo", label: "SEO" }],
  },
  {
    label: "Accounts",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/employees", label: "Employees" },
      { href: "/admin/billing", label: "Billing" },
    ],
  },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <style>{css}</style>
      <ModalHost />

      <div className="admin-shell">
        <aside className="sidebar">
          <div className="brand-row">
            <div className="brand-mark">H</div>
            <div className="brand-text">
              <div className="brand-name">Helixon</div>
              <div className="brand-sub">Admin console</div>
            </div>
          </div>

          <div className="status-row">
            <span className="status-dot" />
            <span>Console connected</span>
          </div>

          <nav className="side-nav">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="side-nav-group">{group.label}</div>

                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`side-link ${
                      pathname === item.href || pathname?.startsWith(`${item.href}/`)
                        ? "active"
                        : ""
                    }`}
                  >
                    <span className="side-link-dot" />
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button
              className="logout"
              onClick={() => {
                window.location.href = "/api/admin/logout";
              }}
            >
              Log out
            </button>
          </div>
        </aside>

        <div className="main-col">
          <div className="topbar">
            <span className="topbar-time">{now ? now.toLocaleString() : ""}</span>
          </div>

          <main className="content">{children}</main>
        </div>
      </div>
    </>
  );
}
