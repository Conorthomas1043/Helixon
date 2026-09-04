"use client";
// app/employee/page.js

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/landing/Button";

export default function EmployeeLanding() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // If already signed in, skip the landing page and go straight to the dashboard.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/employee/todos");
        if (res.ok) {
          const data = await res.json();
          if (data.ok) {
            router.replace("/employee/dashboard");
            return;
          }
        }
      } catch {
        // ignore - treat as signed out
      }
      setChecking(false);
    })();
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--mist)" }}>
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{ border: "4px solid var(--border)", borderTopColor: "var(--forest)" }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col" style={{ background: "var(--mist)" }}>
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b"
        style={{ borderColor: "var(--border)" }}
        aria-label="Main"
      >
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105"
              style={{ background: "var(--forest)" }}
            >
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Helixon
              </span>
              <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "var(--ink-faint)" }}>
                Employee portal
              </span>
            </span>
          </Link>

          <a href="/" className="nav-link text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
            Back to app
          </a>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <div
            className="w-14 h-14 rounded-[16px] flex items-center justify-center mx-auto mb-6"
            style={{ background: "var(--forest)" }}
          >
            <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>

          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full mb-5"
            style={{ background: "var(--mint)", color: "var(--forest)" }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Employee access
          </span>

          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
          >
            Employee Portal
          </h1>
          <p className="text-sm leading-relaxed mb-8" style={{ color: "var(--ink-soft)" }}>
            Manage your tasks and keep an eye on platform stats - all in one place.
          </p>

          <div className="flex flex-col items-center gap-3">
            <Button
              as="a"
              href="/employee/login"
              variant="primary"
              className="w-full sm:w-auto min-h-[48px]"
            >
              Sign in
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Button>
            <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
              Internal access only · Helixon employees
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-2 gap-4 mt-10 text-left">
            <div className="rounded-[14px] p-4" style={{ background: "white", border: "1px solid var(--border)" }}>
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-3"
                style={{ background: "var(--mint)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Personal to-dos</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>Track and organize your daily tasks.</p>
            </div>
            <div className="rounded-[14px] p-4" style={{ background: "white", border: "1px solid var(--border)" }}>
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-3"
                style={{ background: "var(--mint)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-9 0h10a2 2 0 002-2V9.5a2 2 0 00-.6-1.4l-4-4a2 2 0 00-2.8 0l-4 4A2 2 0 004 9.5V17a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>Platform stats</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>A quick read-only snapshot.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}