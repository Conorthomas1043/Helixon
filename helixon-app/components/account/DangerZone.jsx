"use client";

import { useState } from "react";
import Link from "next/link";

// The "Delete account" tab. Replaces a "Not built yet" placeholder. The server
// (/api/account/delete) does the real checks - in particular it refuses while a
// subscription is live - so this only collects the confirmation and shows the
// result.
export default function DangerZone() {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsBilling, setNeedsBilling] = useState(false);

  async function deleteAccount(event) {
    event.preventDefault();
    if (confirm !== "DELETE" || busy) return;
    setBusy(true);
    setError("");
    setNeedsBilling(false);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "We couldn't delete your account. Please try again.");
        setNeedsBilling(data.code === "ACTIVE_SUBSCRIPTION");
        setBusy(false);
        return;
      }

      // The sign-in no longer exists, so a full navigation to the home page.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full page load on purpose: it drops all client state after sign-out, account deletion or an expired session
      window.location.assign("/");
    } catch {
      setError("Network error - please check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={deleteAccount} className="px-6 py-8 sm:px-10 sm:py-10">
      <h3 className="text-16 font-semibold text-[var(--ink)]">Delete your account</h3>
      <p className="mt-2 max-w-[560px] text-14 leading-6 text-[var(--ink-faint)]">
        This permanently removes your Helixon sign-in - you won&apos;t be able to log in again with this email. Your agency&apos;s
        candidates, jobs and billing history stay with the agency. To have that data erased as well, email{" "}
        <a href="mailto:support@helixon.co.uk" className="font-semibold text-[var(--forest)] hover:underline">
          support@helixon.co.uk
        </a>
        .
      </p>

      <ul className="mt-4 max-w-[560px] list-disc space-y-1 pl-5 text-14 leading-6 text-[var(--ink-faint)]">
        <li>This can&apos;t be undone.</li>
        <li>If you pay for Helixon, cancel your subscription first - deleting your account doesn&apos;t stop billing.</li>
      </ul>

      <label htmlFor="delete-confirm" className="mt-6 block text-14 font-semibold text-[var(--ink)]">
        Type <span className="font-mono">DELETE</span> to confirm
      </label>
      <input
        id="delete-confirm"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        className="mt-2 w-full max-w-[280px] rounded-xl border px-3.5 py-2.5 font-mono text-sm outline-none focus:border-[var(--forest)]"
        style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.72)" }}
      />

      {error && (
        <div
          role="alert"
          className="mt-4 max-w-[560px] rounded-xl px-4 py-3 text-14 leading-6 bg-[var(--ui-danger-soft)] border border-[var(--danger-line)] text-[var(--score-low)]"
        >
          {error}
          {needsBilling && (
            <>
              {" "}
              <Link href="/billing" className="font-semibold underline">
                Go to billing
              </Link>
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={confirm !== "DELETE" || busy}
        className="mt-6 inline-flex min-h-[44px] items-center rounded-xl px-5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 bg-[var(--score-low)]"
      >
        {busy ? "Deleting..." : "Delete my account"}
      </button>
    </form>
  );
}
