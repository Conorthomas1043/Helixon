"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import { COLORS } from "@/lib/account";

// Shared across Dashboard, Billing, and Account settings - import this
// component from all three instead of redefining it per page.
export default function AppNav({ active }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { isLoaded, isSignedIn, user } = useUser();
  const userId = user?.id;
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const userName = user?.fullName;
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId || !posthog.__loaded) return;

    const properties = {};
    if (userEmail) properties.email = userEmail;
    if (userName) properties.name = userName;

    posthog.identify(userId, properties);
  }, [isLoaded, isSignedIn, userId, userEmail, userName]);

  const topLink = (key, label, href) => (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)] ${
        active === key ? "font-semibold" : "font-medium hover:bg-[var(--mint)]"
      }`}
      style={{ color: active === key ? COLORS.ink : COLORS.muted, background: active === key ? "var(--mint)" : "transparent" }}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }}>
      <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight hidden sm:block" style={{ color: COLORS.ink, fontFamily: "var(--font-display)" }}>
              Helixon
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-1 text-xs">
            {topLink("scoring", "Scoring", "/")}
            {topLink("dashboard", "Dashboard", "/dashboard")}
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Account menu"
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full transition-colors hover:bg-[var(--mint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]"
            style={{ border: "1px solid var(--border)" }}
          >
            <span className="w-7 h-7 rounded-full text-white text-xs font-semibold flex items-center justify-center" style={{ background: "var(--forest)" }} aria-hidden="true">
              AV
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8aaa9a" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {menuOpen && (
            <div role="menu" className="absolute right-0 mt-2 w-52 rounded-[14px] py-1.5 z-50" style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 16px 32px -14px rgba(19,32,27,0.25)" }}>
              <div className="px-3.5 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                <p className="text-sm font-medium truncate" style={{ color: COLORS.ink }}>Acme Recruiting</p>
                <p className="text-xs truncate" style={{ color: COLORS.muted }}>agency@acme.com</p>
              </div>
              <Link
                href="/account/profile"
                role="menuitem"
                className={`block px-3.5 py-2 text-sm transition-colors ${active === "account" ? "" : "hover:bg-[var(--mint)]"}`}
                style={{ color: active === "account" ? COLORS.ink : COLORS.muted, background: active === "account" ? "var(--mint)" : "transparent", fontWeight: active === "account" ? 600 : 400 }}
              >
                Account settings
              </Link>
              <Link href="/billing" role="menuitem" className="block px-3.5 py-2 text-sm transition-colors hover:bg-[var(--mint)]" style={{ color: COLORS.muted }}>
                Billing
              </Link>
              <div className="border-t mt-1 pt-1" style={{ borderColor: "var(--border)" }}>
                <SignOutButton redirectUrl="/login">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (posthog.__loaded) posthog.reset();
                    }}
                    className="w-full text-left block px-3.5 py-2 text-sm transition-colors hover:bg-red-50"
                    style={{ color: COLORS.dangerText }}
                  >
                    Log out
                  </button>
                </SignOutButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}