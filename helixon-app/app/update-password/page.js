"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Adjust if your real verifyOtp route lives at a different path.
const VERIFY_ENDPOINT = "/api/auth/verify-email";

function isStrongPassword(pw) {
  return (
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[!@#$%^&*()\-_=+\[\]{};':",.<>?]/.test(pw)
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // "verifying" | "ready" | "invalid" - gates the form: we don't show a
  // password field until the token_hash from the email link has actually
  // been exchanged for a session via verifyOtp.
  const [tokenStatus, setTokenStatus] = useState("verifying");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const token_hash = searchParams.get("token_hash");
    if (!token_hash) {
      setTokenStatus("invalid");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(VERIFY_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token_hash, type: "recovery" }),
        });
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        setTokenStatus(res.ok && data?.ok ? "ready" : "invalid");
      } catch {
        if (!cancelled) setTokenStatus("invalid");
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!isStrongPassword(password)) {
      setError("Password must be at least 8 characters, with an uppercase letter, a number, and a symbol.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/update-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col justify-center items-center px-6 py-12" style={{ background: "linear-gradient(135deg, #eef4f0 0%, #e7f0ea 45%, #dcebe0 100%)" }}>
      <div
        className="w-full max-w-sm rounded-[22px] p-7 sm:p-9"
        style={{
          background: "rgba(255,255,255,0.68)",
          backdropFilter: "blur(26px)",
          WebkitBackdropFilter: "blur(26px)",
          border: "1px solid rgba(255,255,255,0.65)",
          boxShadow: "0 40px 80px -32px rgba(19,32,27,0.28)",
        }}
      >
        {!done ? (
          <>
            <h1 className="text-[1.5rem] font-semibold tracking-tight mb-1" style={{ color: "#13201b" }}>
              Choose a new password
            </h1>
            <p className="text-[13px] mb-7" style={{ color: "#5a7a6a" }}>
              Enter a new password for your Helixon account.
            </p>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-5 p-3.5 rounded-[10px]"
                style={{ background: "rgba(254,242,242,0.9)", border: "1px solid #fecaca" }}
              >
                <p className="text-[13px]" style={{ color: "#b91c1c" }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="password" className="block text-xs font-semibold mb-1.5" style={{ color: "#5a7a6a" }}>
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                  className="w-full rounded-[12px] px-3.5 py-3 text-sm outline-none"
                  style={{ border: "1.5px solid var(--border, #d7e4dc)", background: "rgba(255,255,255,0.6)", color: "#13201b" }}
                />
              </div>

              <div>
                <label htmlFor="confirm" className="block text-xs font-semibold mb-1.5" style={{ color: "#5a7a6a" }}>
                  Confirm password
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="w-full rounded-[12px] px-3.5 py-3 text-sm outline-none"
                  style={{ border: "1.5px solid var(--border, #d7e4dc)", background: "rgba(255,255,255,0.6)", color: "#13201b" }}
                />
              </div>

              <p className="text-[11.5px]" style={{ color: "#8aaa9a" }}>
                At least 8 characters, with an uppercase letter, a number, and a symbol.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white font-semibold py-3 rounded-[12px] text-sm"
                style={{ background: loading ? "#b0c4ba" : "var(--forest, #0b3a2a)", cursor: loading ? "not-allowed" : "pointer" }}
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <h2 className="text-[1.4rem] font-semibold mb-1.5" style={{ color: "#13201b" }}>
              Password updated
            </h2>
            <p className="text-[13px]" style={{ color: "#5a7a6a" }}>
              Redirecting you to sign in…
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

// ── Default export - wraps the content in Suspense, required by Next.js
//    App Router whenever a page reads useSearchParams(). Without this the
//    route bails out of static rendering / fails the build, exactly the
//    same issue verify-email/page.js already guards against. ─────────────
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}