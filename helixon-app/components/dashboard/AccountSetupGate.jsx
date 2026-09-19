"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";

// Wraps every /dashboard page.
//
// Signing in with Clerk proves who someone is, but Helixon data hangs off an
// agency, and the agency + profile rows are only created when an account is
// set up through checkout (the Clerk webhook, or /api/complete-signup). A
// signed-in person without one gets a 403 from every agency-scoped API
// (candidates, jobs, team, analytics...), so each tab used to read "Unable to
// load ..." with no hint why - while the Overview quietly showed a false
// "No candidates yet".
//
// This asks once, up front, and if the account genuinely has no agency it
// shows what's wrong and what to do about it, instead of five broken tabs.
// If the check itself fails (offline, 5xx) it steps aside and the pages behave
// as they always did.

const CARD = {
  background: "white",
  border: "1px solid var(--border)",
  borderRadius: 18,
  boxShadow: "0 18px 40px -24px rgba(19,32,27,0.25)",
};

function SetupNeeded({ email }) {
  return (
    <main style={{ minHeight: "100vh", background: "var(--mist)" }}>
      <DashboardNav />
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px" }}>
        <div style={{ ...CARD, padding: "36px 36px 32px" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "4px 11px",
              borderRadius: 999,
              background: "var(--mint)",
              color: "var(--forest)",
              marginBottom: 16,
            }}
          >
            Account setup
          </span>

          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(24px, 4vw, 30px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
              margin: "0 0 10px",
            }}
          >
            Let&apos;s finish setting up your account
          </h1>

          <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink-soft)", margin: "0 0 22px" }}>
            {email ? (
              <>
                You&apos;re signed in as <strong style={{ color: "var(--ink)" }}>{email}</strong>, but this account isn&apos;t
                connected to an agency or a plan yet, so there&apos;s no candidate, job or team data to show.
              </>
            ) : (
              <>This account isn&apos;t connected to an agency or a plan yet, so there&apos;s no candidate, job or team data to show.</>
            )}
          </p>

          <div style={{ display: "grid", gap: 12, marginBottom: 22 }}>
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>New to Helixon?</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-soft)", margin: "0 0 12px" }}>
                Pick a plan and your workspace is created as part of checkout.
              </p>
              <Link
                href="/pricing"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: 40,
                  padding: "0 18px",
                  borderRadius: 10,
                  background: "var(--forest)",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Choose a plan
              </Link>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>Already paid or signed up?</div>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink-soft)", margin: "0 0 12px" }}>
                Linking a new subscription can take a minute. Refresh in a moment - and if it still isn&apos;t connected,
                tell us the email you used and we&apos;ll link it for you.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  style={{
                    minHeight: 40,
                    padding: "0 18px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "white",
                    color: "var(--ink)",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Refresh
                </button>
                <Link
                  href="/contact"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    minHeight: 40,
                    padding: "0 18px",
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "white",
                    color: "var(--ink)",
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Contact support
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function AccountSetupGate({ children }) {
  // "checking" -> "ready" | "needs-setup"
  const [status, setStatus] = useState("checking");
  const [email, setEmail] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        // Only an explicit `false` means "no agency". null/undefined = couldn't
        // tell, so let the pages load and cope as they always did.
        if (data?.user?.hasAgency === false) {
          setEmail(data.user.email || null);
          setStatus("needs-setup");
        } else {
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("ready");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "needs-setup") return <SetupNeeded email={email} />;

  // While checking, show nothing rather than mounting the pages: they'd fire
  // their own requests, get 403s, and flash "Unable to load" before the answer
  // arrives. The check is a single fast request.
  if (status === "checking") {
    return <main style={{ minHeight: "100vh", background: "var(--mist)" }} aria-busy="true" />;
  }

  return children;
}
