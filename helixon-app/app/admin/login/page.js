"use client";

import { useState } from "react";
import { Icon } from "../_shared/icons";

// Sign-in form. Rendered on its own (the console chrome only appears once you're
// signed in - see app/admin/layout.js), using the console's dark styling.
export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, code }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Sign-in failed.");
      }

      // Full navigation (not router.push) so the new httpOnly session
      // cookie is present on the very first request proxy.ts sees for
      // /admin - avoids a client-side nav racing the cookie write.
      window.location.href = "/admin";
    } catch (err) {
      setError(err.message);
      setPassword("");
      setCode("");
      setSubmitting(false);
    }
  }

  return (
    <main className="login-wrap">
      <form onSubmit={handleSubmit} className="login-card" noValidate>
        <div className="login-brand">
          <div className="brand-mark">H</div>
          <div>
            <h1>Helixon admin</h1>
            <p>Sign in to continue.</p>
          </div>
        </div>

        {error && (
          <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="admin-username">Username</label>
          <input
            id="admin-username"
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <div className="field" style={{ marginBottom: 14 }}>
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <div className="field" style={{ marginBottom: 20 }}>
          <label htmlFor="admin-code">
            Authentication code <span className="faint">(if you&apos;ve set up two-factor)</span>
          </label>
          <input
            id="admin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="123 456"
            className="mono"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, ""))}
          />
        </div>

        <button
          type="submit"
          className="btn primary"
          style={{ width: "100%", padding: "11px 14px" }}
          disabled={submitting || !username || !password}
        >
          <Icon name="lock" />
          {submitting ? "Signing in..." : "Sign in"}
        </button>

        <p className="login-foot">
          Access is logged. Sessions end after 30 minutes without activity.
        </p>
      </form>
    </main>
  );
}
