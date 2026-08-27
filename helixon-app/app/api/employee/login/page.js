"use client";
// app/employee/login/page.js

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EmployeeLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/employee/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      router.replace("/employee/dashboard");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">H</span>
          </div>
          <span className="text-lg font-bold">Helixon</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h1 className="text-lg font-semibold mb-1">Employee sign in</h1>
          <p className="text-sm text-slate-500 mb-5">Use your Helixon employee account.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@helixon.dev"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-xs text-slate-600 mt-5 text-center">
            Demo login: alex@helixon.dev / password123
          </p>
        </div>
      </div>
    </main>
  );
}
