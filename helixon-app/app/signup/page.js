"use client";
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
    setTimeout(() => {
      setDone(true);
      setLoading(false);
    }, 800);
  }

  if (done) return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-8 text-center">
        <div className="text-4xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-stone-900 mb-2">Check your email</h2>
        <p className="text-stone-500 text-sm">We sent a confirmation link to <strong>{email}</strong>.</p>
        <a href="/" className="mt-6 block text-center bg-emerald-700 text-white font-medium py-3 rounded-lg hover:bg-emerald-800">
          Back to Helixon
        </a>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">Start free trial</h1>
        <p className="text-stone-500 text-sm mb-6">
          3 analyses free. No card required.{" "}
          <a href="/" className="text-emerald-700 hover:underline">Already have an account?</a>
        </p>
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Work email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="you@agency.com"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
              placeholder="at least 8 characters"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <button type="submit" disabled={loading}
            className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-medium py-3 rounded-lg disabled:opacity-50">
            {loading ? "Creating account..." : "Create free account"}
          </button>
        </form>
      </div>
    </main>
  );
}