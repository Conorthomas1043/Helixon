"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/analyse", label: "Analyse" },
  { href: "/dashboard/candidates", label: "Candidates" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/jobs", label: "Jobs" },
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/analytics", label: "Analytics" },
];

export default function DashboardNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoaded, isSignedIn, user } = useUser();
  const userId = user?.id;
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const userName = user?.fullName;
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || !posthog.__loaded) return;

    const properties = {};
    if (userEmail) properties.email = userEmail;
    if (userName) properties.name = userName;

    posthog.identify(userId, properties);
  }, [isLoaded, isSignedIn, userId, userEmail, userName]);

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1200px] mx-auto px-6 h-[56px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
          <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>Helixon</span>
            <span className="hidden sm:block text-[10px] font-medium mt-0.5" style={{ color: "var(--ink-soft)" }}>Screen candidates in seconds</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1 text-xs font-medium" style={{ color: "#5a7a6a" }}>
          {TABS.map((t) => {
            const active = t.href === "/dashboard" ? pathname === t.href : pathname === t.href || pathname?.startsWith(`${t.href}/`);
            return (
              <Link
                key={t.href}
                href={t.href}
                className="px-3 py-1.5 rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]"
                style={active ? { background: "var(--mint)", color: "var(--forest)", fontWeight: 600 } : {}}
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: "var(--forest)" }}>
              {(userName || userEmail || "?").charAt(0).toUpperCase()}
            </div>
            <span className="text-[11px] font-medium hidden sm:block" style={{ color: "#13201b" }}>{userName || userEmail}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-44 rounded-[12px] p-1.5 bg-white" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 24px -12px rgba(19,32,27,0.25)" }}>
              <Link href="/account" className="block text-xs px-3 py-2 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]" style={{ color: "#13201b" }} onClick={() => setMenuOpen(false)}>Account settings</Link>
              <Link href="/billing" className="block text-xs px-3 py-2 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]" style={{ color: "#13201b" }} onClick={() => setMenuOpen(false)}>Billing</Link>
              <SignOutButton redirectUrl="/login">
                <button
                  type="button"
                  onClick={() => {
                    if (posthog.__loaded) posthog.reset();
                  }}
                  className="w-full text-left block text-xs px-3 py-2 rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]"
                  style={{ color: "#b91c1c" }}
                >
                  Log out
                </button>
              </SignOutButton>
            </div>
          )}
        </div>
      </div>

      {/* Mobile tab row */}
      <div className="md:hidden flex overflow-x-auto gap-1 px-4 pb-2 text-xs font-medium" style={{ color: "#5a7a6a" }}>
        {TABS.map((t) => {
          const active = t.href === "/dashboard" ? pathname === t.href : pathname === t.href || pathname?.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              className="px-3 py-1.5 rounded-[8px] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]"
              style={active ? { background: "var(--mint)", color: "var(--forest)", fontWeight: 600 } : {}}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
