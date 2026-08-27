"use client";
// app/employee/page.js

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
        // ignore — treat as signed out
      }
      setChecking(false);
    })();
  }, [router]);

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <span className="text-base font-bold text-white">Helixon</span>
          <span className="text-xs text-emerald-400 border border-emerald-800 bg-emerald-950 px-2 py-0.5 rounded-full font-medium">
            Employee
          </span>
        </div>
        <a href="/" className="text-sm text-slate-400 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition">
          Back to app
        </a>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-white text-xl font-bold">H</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Employee Portal</h1>
          <p className="text-sm text-slate-400 mb-8">
            Manage your tasks and keep an eye on platform stats — all in one place.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push("/employee/login")}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
            >
              Sign in
            </button>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-2 gap-3 mt-10 text-left">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="w-8 h-8 bg-emerald-950 border border-emerald-800 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white">Personal to-dos</p>
              <p className="text-xs text-slate-500 mt-0.5">Track and organize your daily tasks.</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="w-8 h-8 bg-emerald-950 border border-emerald-800 rounded-lg flex items-center justify-center mb-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 012-2h2a2 2 0 012 2v6m-9 0h10a2 2 0 002-2V9.5a2 2 0 00-.6-1.4l-4-4a2 2 0 00-2.8 0l-4 4A2 2 0 004 9.5V17a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white">Platform stats</p>
              <p className="text-xs text-slate-500 mt-0.5">A quick read-only snapshot.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
