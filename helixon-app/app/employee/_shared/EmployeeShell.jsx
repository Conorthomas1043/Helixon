"use client";
// app/employee/_shared/EmployeeShell.jsx
// Page frame for every signed-in employee page: skip link, the portal nav
// and a <main> landmark. The nav used to be copied into each page with a
// different set of links on each one (calendar linked to goals but not ops,
// ops only to settings...), so where you could get to depended on where you
// were. Now every section is one click from everywhere.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export const EMPLOYEE_SECTIONS = [
  { href: "/employee/dashboard", label: "Today" },
  { href: "/employee/calendar", label: "Calendar" },
  { href: "/employee/goals", label: "Goals" },
  { href: "/employee/cold-calls", label: "Cold calls" },
  { href: "/employee/files", label: "Files" },
  { href: "/employee/ops", label: "Platform" },
];

function initialsOf(name) {
  return (
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

function LogoMark() {
  return (
    <span className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
      <svg width="18" height="18" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
        <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
        <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
      </svg>
    </span>
  );
}

// The nav fetches the signed-in employee itself so pages don't all have to
// pass it down; a page that already has it can pass `employee` to skip that.
function useEmployee(initial) {
  const [employee, setEmployee] = useState(initial || null);
  useEffect(() => {
    if (initial) return undefined;
    let cancelled = false;
    fetch("/api/employee/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.ok) setEmployee(d.employee); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initial]);
  return initial || employee;
}

export function EmployeeNav({ employee: employeeProp }) {
  const pathname = usePathname();
  const router = useRouter();
  const employee = useEmployee(employeeProp);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onPointerDown(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  async function signOut() {
    await fetch("/api/employee/logout", { method: "POST" }).catch(() => {});
    router.replace("/employee/login");
  }

  const isActive = (href) => pathname === href || pathname?.startsWith(`${href}/`);
  const name = employee?.fullName || employee?.username || "";

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }} aria-label="Employee portal">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-4">
        <Link href="/employee/dashboard" className="flex items-center gap-2.5 group shrink-0" aria-label="Employee portal home">
          <LogoMark />
          <span className="flex items-center gap-2 leading-none">
            <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>Helixon</span>
            <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md" style={{ background: "var(--mint)", color: "var(--forest)" }}>
              Staff
            </span>
          </span>
        </Link>

        <ul className="hidden lg:flex items-center gap-0.5">
          {EMPLOYEE_SECTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={isActive(s.href) ? "page" : undefined}
                className={`nav-link text-[13px] font-medium ${isActive(s.href) ? "nav-link--active" : ""}`}
                style={{ color: "var(--ink-soft)" }}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-1.5">
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
              className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 transition hover:bg-[var(--mist)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
            >
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white" style={{ background: "var(--forest)" }} aria-hidden="true">
                {initialsOf(name)}
              </span>
              <span className="hidden sm:block text-[13px] font-medium max-w-[120px] truncate" style={{ color: "var(--ink)" }}>
                {name.split(/\s+/)[0] || "Account"}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="hidden sm:block">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-11 w-56 rounded-[14px] py-1.5 z-50" style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 16px 32px -14px rgba(19,32,27,0.25)" }}>
                {name && (
                  <div className="px-3.5 pt-1.5 pb-2.5 mb-1 border-b" style={{ borderColor: "var(--border-soft)" }}>
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>{name}</p>
                    {employee?.role && <p className="text-xs capitalize" style={{ color: "var(--ink-faint)" }}>{String(employee.role).replace(/_/g, " ")}</p>}
                  </div>
                )}
                <Link href="/employee/settings" role="menuitem" className="block px-3.5 py-2 text-sm hover:bg-[var(--mint)]" style={{ color: "var(--ink)" }} onClick={() => setMenuOpen(false)}>
                  Settings
                </Link>
                <Link href="/employee/mobile" role="menuitem" className="block px-3.5 py-2 text-sm hover:bg-[var(--mint)]" style={{ color: "var(--ink)" }} onClick={() => setMenuOpen(false)}>
                  Mobile view
                </Link>
                <Link href="/" role="menuitem" className="block px-3.5 py-2 text-sm hover:bg-[var(--mint)]" style={{ color: "var(--ink)" }}>
                  Helixon website
                </Link>
                <div className="border-t mt-1 pt-1" style={{ borderColor: "var(--border-soft)" }}>
                  <button type="button" role="menuitem" onClick={signOut} className="w-full text-left px-3.5 py-2 text-sm hover:bg-red-50" style={{ color: "var(--score-low)" }}>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="employee-mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="lg:hidden w-10 h-10 rounded-[8px] flex items-center justify-center"
            style={{ color: "var(--ink)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <ul id="employee-mobile-nav" className="lg:hidden border-t px-4 py-2 grid grid-cols-2 gap-1 bg-white" style={{ borderColor: "var(--border)" }}>
          {EMPLOYEE_SECTIONS.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(s.href) ? "page" : undefined}
                className="flex items-center min-h-[44px] px-3 rounded-[10px] text-sm"
                style={isActive(s.href) ? { background: "var(--mint)", color: "var(--forest)", fontWeight: 600 } : { color: "var(--ink-soft)" }}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}

export default function EmployeeShell({ employee, children }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--mist)" }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <EmployeeNav employee={employee} />
      <main id="main-content">{children}</main>
    </div>
  );
}
