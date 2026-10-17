"use client";
// app/employee/_shared/EmployeeShell.jsx
// Page frame for every signed-in employee page: skip link, the portal nav
// and a <main> landmark. The nav is defined once, here, so every page has
// the same links and every section is one click from everywhere.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { can } from "@/lib/employee/permissions";
import { reportQuietly } from "@/lib/report-error";

// `section` is the permission key (lib/employee/permissions.js) that
// decides whether the link shows. Today has none: it adapts its cards.
export const EMPLOYEE_SECTIONS = [
  { href: "/employee/dashboard", label: "Today", section: null },
  { href: "/employee/calendar", label: "Calendar", section: "calendar" },
  { href: "/employee/goals", label: "Goals", section: "goals" },
  { href: "/employee/cold-calls", label: "Cold calls", section: "cold_calls" },
  { href: "/employee/files", label: "Files", section: "files" },
  { href: "/employee/ops", label: "Platform", section: "platform" },
];

/** Sections this employee can open (all of them until /me has loaded). */
export function visibleSections(employee) {
  if (!employee) return EMPLOYEE_SECTIONS;
  return EMPLOYEE_SECTIONS.filter((s) => !s.section || can(employee, s.section, "view"));
}

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
    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 bg-[var(--forest)]">
      <svg width="18" height="18" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="var(--on-accent)" opacity="0.55" />
        <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="var(--on-accent)" />
        <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
      </svg>
    </span>
  );
}

// The shell fetches the signed-in employee itself so pages don't all have
// to pass it down; a page that already has it can pass `employee` to skip
// that.
function useEmployee(initial) {
  const [employee, setEmployee] = useState(initial || null);
  useEffect(() => {
    if (initial) return undefined;
    let cancelled = false;
    fetch("/api/employee/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled && d?.ok) setEmployee(d.employee); })
      .catch(reportQuietly);
    return () => { cancelled = true; };
  }, [initial]);
  return initial || employee;
}

function EmployeeNav({ employee }) {
  const pathname = usePathname();
  const router = useRouter();
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
    await fetch("/api/employee/logout", { method: "POST" }).catch(reportQuietly);
    router.replace("/employee/login");
  }

  const isActive = (href) => pathname === href || pathname?.startsWith(`${href}/`);
  const name = employee?.fullName || employee?.username || "";
  const sections = visibleSections(employee);

  return (
    <nav className="sticky top-0 z-40 w-full bg-[var(--bg)]/95 backdrop-blur border-b border-[var(--border)]" aria-label="Employee portal">
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-4">
        <Link href="/employee/dashboard" className="flex items-center gap-2.5 group shrink-0" aria-label="Employee portal home">
          <LogoMark />
          <span className="flex items-center gap-2 leading-none">
            <span className="text-sm font-semibold tracking-tight text-[var(--ink)] font-display">Helixon</span>
            <span className="hidden sm:inline text-11 font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[var(--mint)] text-[var(--forest)]">
              Staff
            </span>
          </span>
        </Link>

        <ul className="hidden lg:flex items-center gap-0.5">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                aria-current={isActive(s.href) ? "page" : undefined}
                className={`nav-link text-14 font-medium ${isActive(s.href) ? "nav-link--active" : ""}`}
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
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-12 font-semibold text-[var(--on-accent)] bg-[var(--forest)]" aria-hidden="true">
                {initialsOf(name)}
              </span>
              <span className="hidden sm:block text-14 font-medium max-w-[120px] truncate text-[var(--ink)]">
                {name.split(/\s+/)[0] || "Account"}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="hidden sm:block">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-11 w-56 rounded-card py-1.5 z-50" style={{ background: "var(--bg)", border: "1px solid var(--border)", boxShadow: "0 16px 32px -14px rgba(19,32,27,0.25)" }}>
                {name && (
                  <div className="px-3.5 pt-1.5 pb-2.5 mb-1 border-b border-[var(--border-soft)]">
                    <p className="text-sm font-semibold truncate text-[var(--ink)]">{name}</p>
                    {employee?.role && <p className="text-xs capitalize text-[var(--ink-faint)]">{String(employee.role).replace(/_/g, " ")}</p>}
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
                <div className="border-t mt-1 pt-1 border-[var(--border-soft)]">
                  <button type="button" role="menuitem" onClick={signOut} className="w-full text-left px-3.5 py-2 text-sm hover:bg-[var(--ui-danger-soft)] text-[var(--score-low)]">
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
            className="lg:hidden w-10 h-10 rounded-lg flex items-center justify-center text-[var(--ink)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <ul id="employee-mobile-nav" className="lg:hidden border-t px-4 py-2 grid grid-cols-2 gap-1 bg-[var(--bg)] border-[var(--border)]">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                onClick={() => setMobileOpen(false)}
                aria-current={isActive(s.href) ? "page" : undefined}
                className="flex items-center min-h-[44px] px-3 rounded-btn text-sm"
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

// Shown while an admin is using the portal: either "as" an employee
// (impersonation, from Admin > Employees) or with their own linked
// portal account. Exiting ends this portal session only.
function AdminBanner({ employee }) {
  const [leaving, setLeaving] = useState(false);
  if (!employee?.impersonatedBy && !employee?.adminUsername) return null;

  async function exit() {
    setLeaving(true);
    await fetch("/api/employee/logout", { method: "POST" }).catch(reportQuietly);
    window.location.assign(employee.impersonatedBy ? "/admin/employees" : "/admin");
  }

  const who = employee.fullName || employee.username;
  return (
    <div role="status" className={`w-full text-14 border-b border-b-[var(--border)] text-[var(--ink)] ${employee.impersonatedBy ? "bg-[var(--ui-warn-soft)]" : "bg-[var(--mint)]"}`}>
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
        <span>
          {employee.impersonatedBy ? (
            <>Viewing the portal as <b>{who}</b>. Signed in by admin <b>{employee.impersonatedBy}</b>. Changes you make are saved under their name.</>
          ) : (
            <>Signed in from the admin console as <b>{employee.adminUsername}</b>.</>
          )}
        </span>
        <button type="button" onClick={exit} disabled={leaving} className="font-semibold underline disabled:opacity-60">
          {leaving ? "Leaving…" : employee.impersonatedBy ? "Exit to admin" : "Back to admin"}
        </button>
      </div>
    </div>
  );
}

function NoAccess({ label }) {
  return (
    <div className="max-w-[640px] mx-auto px-4 sm:px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--ink)] font-display">
        {label} isn&rsquo;t available to you
      </h1>
      <p className="text-15 mt-2 text-[var(--ink-soft)]">
        Your account doesn&rsquo;t have access to this part of the portal. If you need it, ask an admin to change your permissions.
      </p>
      <Link href="/employee/dashboard" className="inline-flex mt-6 text-sm font-semibold px-4 py-2.5 rounded-full text-[var(--on-accent)]" style={{ background: "var(--forest)" }}>
        Back to Today
      </Link>
    </div>
  );
}

/**
 * `section` (optional) is the page's permission key. Without "view" access
 * the page body is replaced by a short explanation; with "view" but not
 * "edit" a read-only notice sits above it (the API refuses changes either
 * way - this just says so up front).
 */
export default function EmployeeShell({ employee: employeeProp, section, children }) {
  const employee = useEmployee(employeeProp);
  const meta = section ? EMPLOYEE_SECTIONS.find((s) => s.section === section) : null;
  const blocked = section && employee && !can(employee, section, "view");
  const readOnly = section && employee && !blocked && !can(employee, section, "edit") && section !== "platform";

  return (
    <div className="min-h-screen bg-[var(--mist)]">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <AdminBanner employee={employee} />
      <EmployeeNav employee={employee} />
      <main id="main-content">
        {readOnly && (
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 pt-5">
            <p className="text-14 rounded-btn px-3.5 py-2.5 bg-[var(--bg)] border border-[var(--border)] text-[var(--ink-soft)]">
              <b className="text-[var(--ink)]">View only.</b> You can look around {meta?.label ? `in ${meta.label}` : "here"}, but changes are turned off for your account.
            </p>
          </div>
        )}
        {blocked ? <NoAccess label={meta?.label || "This page"} /> : children}
      </main>
    </div>
  );
}
