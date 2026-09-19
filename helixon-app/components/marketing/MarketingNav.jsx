"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser, SignOutButton } from "@clerk/nextjs";
import Button from "@/components/landing/Button";
import Logo from "@/components/marketing/Logo";

// Shared across every marketing/public page (home, about, pricing, blog,
// careers, faq, how-it-works, contact, demo) - import this instead of
// redefining a nav per page.
const NAV_LINKS = [
  ["how", "How it works", "/how-it-works"],
  ["pricing", "Pricing", "/pricing"],
  ["about", "About", "/about"],
  ["blog", "Blog", "/blog"],
  ["faq", "FAQ", "/faq"],
];

function initialsFor(user) {
  const source = user?.fullName || user?.primaryEmailAddress?.emailAddress || "";
  return (
    source
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export default function MarketingNav({ active, showTagline = true }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const signedIn = isLoaded && isSignedIn;
  const initials = signedIn ? initialsFor(user) : "";

  return (
    <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }} aria-label="Main">
      <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
        <Logo showTagline={showTagline} />

        <div className="hidden md:flex items-center gap-1 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
          {NAV_LINKS.map(([key, label, href]) => (
            <Link key={key} href={href} className={`nav-link ${active === key ? "nav-link--active" : ""}`}>
              {label}
            </Link>
          ))}
          {!signedIn && (
            <Link href="/login" className="nav-link">
              Login
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <div className="hidden md:flex items-center gap-2 relative">
              <Button as="a" href="/dashboard" variant="primary" size="sm" className="min-h-[36px]">
                Dashboard
              </Button>
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                aria-label="Account menu"
                className="w-8 h-8 rounded-full text-white text-[11px] font-semibold flex items-center justify-center transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--forest)]"
                style={{ background: "var(--forest)" }}
              >
                {initials}
              </button>
              {accountOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-11 w-48 rounded-[14px] py-1.5 z-50"
                  style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 16px 32px -14px rgba(19,32,27,0.25)" }}
                  onMouseLeave={() => setAccountOpen(false)}
                >
                  <Link href="/dashboard" role="menuitem" className="block px-3.5 py-2 text-sm transition-colors hover:bg-[var(--mint)]" style={{ color: "var(--ink)" }}>
                    Dashboard
                  </Link>
                  <Link href="/account" role="menuitem" className="block px-3.5 py-2 text-sm transition-colors hover:bg-[var(--mint)]" style={{ color: "var(--ink-soft)" }}>
                    Account settings
                  </Link>
                  <div className="border-t mt-1 pt-1" style={{ borderColor: "var(--border)" }}>
                    <SignOutButton redirectUrl="/login">
                      <button type="button" role="menuitem" className="w-full text-left block px-3.5 py-2 text-sm transition-colors hover:bg-red-50" style={{ color: "var(--score-low)" }}>
                        Log out
                      </button>
                    </SignOutButton>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button as="a" href="/demo" variant="primary" size="sm" className="hidden md:inline-flex min-h-[36px]">
              Get a demo
            </Button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            className="md:hidden w-10 h-10 rounded-[8px] flex items-center justify-center"
            style={{ color: "var(--ink)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-nav" className="md:hidden border-t px-4 py-3 flex flex-col gap-0.5 bg-white" style={{ borderColor: "var(--border)" }}>
          {NAV_LINKS.map(([key, label, href]) => (
            <Link
              key={key}
              href={href}
              onClick={() => setMobileOpen(false)}
              className="text-sm px-2.5 py-3 rounded-[8px] min-h-[44px] flex items-center"
              style={{ color: active === key ? "var(--forest)" : "var(--ink-soft)", fontWeight: active === key ? 600 : 400, background: active === key ? "var(--mint)" : "transparent" }}
            >
              {label}
            </Link>
          ))}

          {signedIn ? (
            <>
              <Link href="/account" onClick={() => setMobileOpen(false)} className="text-sm px-2.5 py-3 rounded-[8px] min-h-[44px] flex items-center" style={{ color: "var(--ink-soft)" }}>
                Account settings
              </Link>
              <Button as="a" href="/dashboard" variant="primary" size="sm" onClick={() => setMobileOpen(false)} className="mt-1 min-h-[44px]">
                Go to dashboard
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)} className="text-sm px-2.5 py-3 rounded-[8px] min-h-[44px] flex items-center" style={{ color: "var(--ink-soft)" }}>
                Login
              </Link>
              <Button as="a" href="/demo" variant="primary" size="sm" onClick={() => setMobileOpen(false)} className="mt-1 min-h-[44px]">
                Get a demo
              </Button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
