"use client";
// app/employee/login/page.js

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

function EmployeeLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  // Set by app/employee/settings after a self-service password change,
  // which signs the browser out everywhere as part of that change - without
  // this the employee lands back on a bare login form with no explanation
  // for why they were suddenly signed out.
  const passwordChanged = searchParams.get("passwordChanged") === "1";

  // Already signed in? Skip the form entirely, same check the /employee
  // landing page does - previously this page had no such check, so a
  // logged-in employee hitting /employee/login directly just saw the form
  // again instead of being sent straight to their dashboard.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/employee/me");
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/employee/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      // Read once by the dashboard on its next mount to show a one-time
      // "Welcome back" banner - see app/employee/dashboard/page.js.
      try {
        sessionStorage.setItem("employee_just_logged_in", "1");
      } catch {
        // Storage can be unavailable (private browsing, quota) - the banner
        // just won't show, which isn't worth failing the login over.
      }
      router.replace("/employee/dashboard");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

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

  function fieldStyle(name) {
    const focused = focusedField === name;
    return {
      border: `1.5px solid ${focused ? "var(--forest)" : "var(--border)"}`,
      boxShadow: focused ? "0 0 0 4px var(--mint)" : "none",
      transition: `all 0.2s ${EASE}`,
    };
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--mist)" }}>
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-3 justify-center mb-8 group" aria-label="Helixon home">
          <div
            className="w-8 h-8 rounded-[9px] flex items-center justify-center transition-transform group-hover:scale-105"
            style={{ background: "var(--forest)" }}
          >
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Helixon
          </span>
        </Link>

        <div
          className="rounded-[20px] p-6 sm:p-7"
          style={{ background: "white", border: "1px solid var(--border)", boxShadow: "0 20px 40px -20px rgba(19,32,27,0.18)" }}
        >
          <div className="w-11 h-11 rounded-[12px] flex items-center justify-center mb-5" style={{ background: "var(--mint)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
          </div>

          <h1 className="text-lg font-semibold tracking-tight mb-1" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Employee sign in
          </h1>
          <p className="text-[13px] leading-relaxed mb-5" style={{ color: "var(--ink-soft)" }}>
            Use your Helixon employee account.
          </p>

          {passwordChanged && (
            <div
              role="status"
              className="flex items-start gap-2.5 p-3 rounded-[10px] mb-4"
              style={{ background: "var(--mint)", border: "1px solid var(--border)" }}
            >
              <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
              </svg>
              <p className="text-[13px]" style={{ color: "var(--forest)" }}>
                Password updated. Sign in with your new password.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink-faint)" }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={() => setFocusedField("username")}
                onBlur={() => setFocusedField(null)}
                required
                autoFocus
                autoComplete="username"
                placeholder="yourusername"
                className="w-full bg-transparent rounded-[12px] px-3.5 py-2.5 text-sm outline-none"
                style={{ color: "var(--ink)", ...fieldStyle("username") }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink-faint)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-transparent rounded-[12px] px-3.5 py-2.5 text-sm outline-none"
                style={{ color: "var(--ink)", ...fieldStyle("password") }}
              />
            </div>

            {error && (
              <div role="alert" aria-live="assertive" className="flex items-start gap-2.5 p-3 rounded-[10px]" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                <svg className="mt-0.5 shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--score-low)" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-[13px]" style={{ color: "var(--score-low)" }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="btn-forest w-full text-white font-semibold py-3 rounded-[12px] text-sm transition-all flex items-center justify-center gap-2"
              style={{
                background: loading ? "var(--ink-mute)" : "var(--forest)",
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 12px 24px -10px rgba(11,58,42,0.5)",
              }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

// useSearchParams() (for ?passwordChanged=1) requires a Suspense boundary
// in the app router, or static prerendering fails the build - same reason
// app/login/[[...rest]]/page.jsx wraps its own content component.
export default function EmployeeLogin() {
  return (
    <Suspense fallback={null}>
      <EmployeeLoginForm />
    </Suspense>
  );
}