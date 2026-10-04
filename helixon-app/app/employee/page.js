"use client";
// app/employee/page.js
// Front door of the staff portal. Signed-in employees go straight to their
// Today page; everyone else sees what the portal is for and a sign-in
// button.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/landing/Button";
import { FullPageSpinner } from "./_shared/ui";

const FEATURES = [
  { title: "Today", body: "Your tasks by due date, today's events and the calls to return, in one view.", icon: <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /> },
  { title: "Team tasks & goals", body: "Shared tasks, goals with checklists, and who's working on what.", icon: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /> },
  { title: "Cold calls", body: "Log calls, work through the call list and never miss a follow-up.", icon: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /> },
  { title: "Calendar & files", body: "One shared calendar that syncs with Google, and the team's documents.", icon: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /> },
];

export default function EmployeeLanding() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  // Already signed in: skip this page.
  useEffect(() => {
    fetch("/api/employee/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok) router.replace("/employee/dashboard");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) return <FullPageSpinner />;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--mist)" }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }} aria-label="Main">
        <div className="max-w-[1100px] mx-auto px-6 h-[60px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group" aria-label="Helixon home">
            <span className="w-8 h-8 rounded-[9px] flex items-center justify-center transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none" aria-hidden="true">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </span>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>Helixon</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md" style={{ background: "var(--mint)", color: "var(--forest)" }}>Staff</span>
          </Link>
          <Link href="/" className="nav-link text-sm font-medium" style={{ color: "var(--ink-soft)" }}>
            Helixon website
          </Link>
        </div>
      </nav>

      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] mb-3" style={{ color: "var(--forest)" }}>Helixon staff portal</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              Everything you need for the working day
            </h1>
            <p className="text-[15px] leading-relaxed max-w-md mx-auto mb-8" style={{ color: "var(--ink-soft)" }}>
              Tasks, calls, goals and the team calendar in one place. For Helixon employees only.
            </p>
            <Button as="a" href="/employee/login" variant="primary" className="min-h-[48px] px-8">
              Sign in
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Button>
          </div>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-12">
            {FEATURES.map((f) => (
              <li key={f.title} className="rounded-[14px] p-5 bg-white flex gap-3.5" style={{ border: "1px solid var(--border)" }}>
                <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "var(--mint)" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {f.icon}
                  </svg>
                </span>
                <span>
                  <span className="block text-sm font-semibold" style={{ color: "var(--ink)" }}>{f.title}</span>
                  <span className="block text-[14px] mt-0.5 leading-relaxed" style={{ color: "var(--ink-soft)" }}>{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
