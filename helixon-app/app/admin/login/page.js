"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INK = "#13201b";
const INK_SOFT = "#5a7a6a";
const INK_FAINT = "#8aaa9a";
const DANGER = "#dc2626";
const DANGER_BG = "#fef2f2";
const DANGER_BORDER = "#fecaca";

const CARD = {
  background: "white",
  border: "1px solid var(--border)",
  borderRadius: 14,
  boxShadow: "var(--shadow-card)",
};

function FieldLabel({ children }) {
  return (
    <label className="block text-xs font-semibold mb-1.5" style={{ color: INK }}>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full rounded-[10px] border px-3.5 py-2.5 text-sm outline-none transition-shadow focus:shadow-[0_0_0_3px_var(--mint)] focus:border-[var(--forest)] mb-3.5"
      style={{ borderColor: "var(--border)", color: INK, background: "white" }}
    />
  );
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }

      // Full navigation (not router.push) so the new httpOnly session
      // cookie is present on the very first request proxy.ts sees for
      // /admin — avoids a client-side nav racing the cookie write.
      window.location.href = "/admin";
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--mist)" }}
    >
      <form onSubmit={handleSubmit} className="w-full max-w-[360px] p-7" style={CARD}>
        <div className="mb-6">
          <h1
            className="text-lg font-semibold"
            style={{ fontFamily: "var(--font-display)", color: INK }}
          >
            Helixon admin
          </h1>
          <p className="text-sm mt-1" style={{ color: INK_FAINT }}>
            Sign in to continue.
          </p>
        </div>

        {error && (
          <div
            className="mb-4 px-3.5 py-2.5 rounded-[10px] text-sm"
            style={{ background: DANGER_BG, border: `1px solid ${DANGER_BORDER}`, color: DANGER }}
            role="alert"
          >
            {error}
          </div>
        )}

        <FieldLabel>Username</FieldLabel>
        <Input
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />

        <FieldLabel>Password</FieldLabel>
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button
          type="submit"
          disabled={submitting || !username || !password}
          className="w-full mt-1 inline-flex items-center justify-center text-sm font-semibold px-4 py-2.5 rounded-[10px] transition-colors bg-[var(--forest)] text-white hover:bg-[var(--forest-deep)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}