"use client";
import { useState } from "react";
export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  async function handleSignup(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.ok) setDone(true);
      else setError(data.error || "Signup failed. Try a different email.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  if (done) return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm
        border border-stone-200 p-8 text-center">
        <div className="text-4xl mb-4">n</div>
        <h2 className="text-xl font-bold text-stone-900 mb-2">Check your email</h2>
        <p className="text-stone-500 text-sm">
          We sent a confirmation link to <strong>{email}</strong>.
          Click it then come back to sign in.
        </p>
        <a href="/login"
          className="mt-6 block text-center bg-emerald-700 text-white
            font-medium py-3 rounded-lg hover:bg-emerald-800">
          Go to login
        </a>
      </div>
    </main>
  );
  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm
        border border-stone-200 p-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">
          Start your free trial
        </h1>
        <p className="text-stone-500 text-sm mb-6">
          3 analyses free. No card required.{" "}
          <a href="/login" className="text-emerald-700 hover:underline">
            Already have an account?
          </a>
        </p>
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Work email
            </label>
            <input type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              required placeholder="you@agency.com"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Password
            </label>
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              required minLength={8} placeholder="at least 8 characters"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200
              rounded-lg px-3 py-2">{error}</p>
          )}
          <button type="submit" disabled={loading}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white
              font-medium py-3 rounded-lg disabled:opacity-50">
            {loading ? "Creating account..." : "Create free account"}
          </button>
        </form>
        <p className="text-xs text-stone-400 mt-4 text-center">
          By signing up you agree to our terms and privacy policy.
        </p>
            </div>

      {showUpgrade && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
            <div className="text-4xl mb-3">🎉</div>

            <h2 className="text-xl font-bold text-stone-900 mb-2">
              Free trial complete
            </h2>

            <p className="text-stone-500 text-sm mb-4">
              You've used your 3 free analyses. Upgrade to continue screening
              CVs — plans from £149/month.
            </p>

            <div className="space-y-3">
              <a
                href="YOUR-SOLO-STRIPE-LINK"
                className="block w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-3 rounded-lg"
              >
                Solo — £149/month
              </a>

              <a
                href="YOUR-TEAM-STRIPE-LINK"
                className="block w-full border border-stone-300 text-stone-700 font-medium py-3 rounded-lg hover:bg-stone-50"
              >
                Team (up to 5) — £349/month
              </a>
            </div>

            <button
              onClick={() => setShowUpgrade(false)}
              className="mt-3 text-sm text-stone-400 hover:text-stone-600"
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

    </main>
  );
}