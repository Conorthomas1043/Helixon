"use client";
// app/employee/settings/page.js
// Self-service account settings - currently just "change your password",
// the one thing every employee needs that previously had no UI anywhere
// (only an admin could reset a password for someone, from app/admin/employees).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const MIN_PASSWORD_LENGTH = 12;

const ROLE_LABELS = {
  super_admin: "Super admin",
  admin: "Admin",
  sales: "Sales",
  support: "Support",
  operations: "Operations",
  viewer: "Viewer",
  employee: "Employee",
};

function formatDateTime(iso) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmployeeSettingsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [employee, setEmployee] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/employee/me");
        if (!res.ok) { router.replace("/employee/login"); return; }
        const data = await res.json();
        if (!data.ok) { router.replace("/employee/login"); return; }
        setEmployee(data.employee);
      } catch {
        router.replace("/employee/login");
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/employee/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not update your password. Please try again.");
        return;
      }
      setDone(true);
      // The API just revoked every session (this one included) and cleared
      // the cookie, so the browser is already signed out - this just gets
      // the user somewhere useful instead of leaving them on a dead page.
      setTimeout(() => router.replace("/employee/login?passwordChanged=1"), 1800);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
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

  function fieldStyle() {
    return { border: "1.5px solid var(--border)", transition: `all 0.2s ${EASE}` };
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b"
        style={{ borderColor: "var(--border)" }}
        aria-label="Main"
      >
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link href="/employee/dashboard" className="flex items-center gap-3 group" aria-label="Employee dashboard">
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

          <Link
            href="/employee/dashboard"
            className="text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:bg-white"
            style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}
          >
            ← My dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-[640px] mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Account settings
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            Your profile and sign-in details.
          </p>
        </div>

        {/* ── Profile ───────────────────────────────────────────────────── */}
        <div className="rounded-[16px] p-6 mb-6" style={{ background: "white", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Profile
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Name</dt>
              <dd className="text-sm mt-0.5" style={{ color: "var(--ink)" }}>{employee?.fullName || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Username</dt>
              <dd className="text-sm mt-0.5" style={{ color: "var(--ink)" }}>{employee?.username}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Role</dt>
              <dd className="text-sm mt-0.5" style={{ color: "var(--ink)" }}>{ROLE_LABELS[employee?.role] || employee?.role || "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>Last signed in</dt>
              <dd className="text-sm mt-0.5" style={{ color: "var(--ink)" }}>{formatDateTime(employee?.lastLogin)}</dd>
            </div>
          </dl>
          <p className="text-xs mt-4" style={{ color: "var(--ink-faint)" }}>
            Need your name or role changed? Ask an admin - that&apos;s managed from the admin console, not here.
          </p>
        </div>

        {/* ── Change password ──────────────────────────────────────────── */}
        <div className="rounded-[16px] p-6" style={{ background: "white", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Change password
          </h2>
          <p className="text-xs mb-5" style={{ color: "var(--ink-faint)" }}>
            You&apos;ll be signed out everywhere afterwards, so sign back in with your new password.
          </p>

          {done ? (
            <div
              role="status"
              className="flex items-center gap-2.5 rounded-[12px] px-4 py-3"
              style={{ background: "var(--mint)", border: "1px solid var(--border)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
              </svg>
              <p className="text-xs font-medium" style={{ color: "var(--forest)" }}>
                Password updated. Taking you to sign in…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink-faint)" }}>
                  Current password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="w-full bg-transparent rounded-[12px] px-3.5 py-2.5 text-sm outline-none"
                  style={{ color: "var(--ink)", ...fieldStyle() }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink-faint)" }}>
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  className="w-full bg-transparent rounded-[12px] px-3.5 py-2.5 text-sm outline-none"
                  style={{ color: "var(--ink)", ...fieldStyle() }}
                />
                <p className="text-[11px] mt-1" style={{ color: "var(--ink-faint)" }}>
                  At least {MIN_PASSWORD_LENGTH} characters.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink-faint)" }}>
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full bg-transparent rounded-[12px] px-3.5 py-2.5 text-sm outline-none"
                  style={{ color: "var(--ink)", ...fieldStyle() }}
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
                disabled={saving}
                aria-busy={saving}
                className="btn-forest text-white font-semibold py-2.5 px-5 rounded-[12px] text-sm transition-all flex items-center justify-center gap-2"
                style={{
                  background: saving ? "var(--ink-mute)" : "var(--forest)",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
