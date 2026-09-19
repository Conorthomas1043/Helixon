"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ModalHost } from "./modal";
import { ToastHost } from "./toast";
import { Icon } from "./icons";
import { Avatar } from "./ui";
import { NAV_GROUPS, titleFor } from "./nav";
import { CommandPalette } from "./palette";
import { useAdminSession, formatCountdown } from "./session";

// The signed-in console chrome: sidebar, top bar, command palette, session
// countdown and toasts. It is rendered only for a signed-in admin (see
// app/admin/layout.js), never on the login page.
export default function AdminShell({ children, initialUsername }) {
  const pathname = usePathname();
  const { info, secondsLeft, warning, staySignedIn, signOut } = useAdminSession();

  const [now, setNow] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const username = info?.username || initialUsername || "admin";
  const { title, group } = titleFor(pathname);

  // Clock. Set from callbacks (not synchronously in the effect body) and only on
  // the client, so it never mismatches the server render.
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  // Cmd/Ctrl+K opens the palette; Escape closes the mobile menu.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      <ModalHost />
      <ToastHost />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onLogout={signOut} />

      {warning && (
        <div className="modal-overlay" role="alertdialog" aria-modal="true" aria-label="Session about to expire">
          <div className="modal-card">
            <div className="modal-title">You&apos;re about to be signed out</div>
            <p className="modal-message">
              For your security the console signs you out after 30 minutes of inactivity. That happens in{" "}
              <b style={{ color: "var(--warn)", fontVariantNumeric: "tabular-nums" }}>{formatCountdown(secondsLeft)}</b>.
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={signOut}>
                Sign out now
              </button>
              <button className="btn primary" onClick={staySignedIn} autoFocus>
                Stay signed in
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-shell">
        <div className={`scrim ${menuOpen ? "open" : ""}`} onClick={closeMenu} />

        <aside className={`sidebar ${menuOpen ? "open" : ""}`} aria-label="Console navigation">
          <div className="brand-row">
            <div className="brand-mark">H</div>
            <div className="brand-text">
              <div className="brand-name">Helixon</div>
              <div className="brand-sub">Admin console</div>
            </div>
          </div>

          <div className="status-row">
            <span className="status-dot pulse" />
            <span>All systems connected</span>
          </div>

          <nav className="side-nav">
            {NAV_GROUPS.map((navGroup) => (
              <div key={navGroup.label}>
                <div className="side-nav-group">{navGroup.label}</div>
                {navGroup.items.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeMenu}
                      className={`side-link ${active ? "active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon name={item.icon} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="user-card">
              <Avatar name={username} />
              <div className="user-meta">
                <span className="user-name">{username}</span>
                {info && !info.twoFactor ? (
                  <span className="user-sub warn" title="Add ADMIN_TOTP_SECRET_<YOU> to require a code at sign-in">
                    2FA not enabled
                  </span>
                ) : (
                  <span className="user-sub">
                    {secondsLeft !== null ? `Session ${formatCountdown(secondsLeft)}` : "Signed in"}
                  </span>
                )}
              </div>
            </div>
            <button className="logout" onClick={signOut}>
              <Icon name="logout" />
              Log out
            </button>
          </div>
        </aside>

        <div className="main-col">
          <div className="topbar">
            <button className="icon-btn menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
              <Icon name="menu" />
            </button>
            <div>
              <div className="topbar-title">{title}</div>
              {group && <div className="topbar-crumb">{group}</div>}
            </div>

            <button className="search-trigger" onClick={() => setPaletteOpen(true)} aria-label="Jump to a page">
              <Icon name="search" />
              <span>Jump to...</span>
              <span className="kbd">Ctrl K</span>
            </button>

            <span className="topbar-time" style={{ marginLeft: 0 }}>
              {now ? now.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
            </span>
          </div>

          <main className="content">{children}</main>
        </div>
      </div>
    </>
  );
}
