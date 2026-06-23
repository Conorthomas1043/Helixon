"use client";
import { useState } from "react";
export default function Login() {
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState(null);
 async function handleLogin(e) {
 e.preventDefault();
 setLoading(true);
 setError(null);
 try {
 const res = await fetch("/api/auth/login", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ email, password }),
 });
 const data = await res.json();
 if (data.ok) {
 window.location.href = "/"; // redirect to app after login
 } else {
 setError(data.error || "Login failed. Check your email and password.");
 }
 } catch {
 setError("Network error. Please try again.");
 } finally {
 setLoading(false);
 }
 }
 return (
 <main className="min-h-screen bg-stone-50 flex items-center
 justify-center p-6">
 <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm
 border border-stone-200 p-8">
 <h1 className="text-2xl font-bold text-stone-900 mb-1">
 Welcome back
 </h1>
 <p className="text-stone-500 text-sm mb-6">
 Don't have an account?{" "}
 <a href="/signup" className="text-emerald-700 hover:underline">
 Sign up free
 </a>
 </p>
 <form onSubmit={handleLogin} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-stone-700 mb-1">
 Email
 </label>
 <input type="email" value={email}
 onChange={e => setEmail(e.target.value)} required
 placeholder="you@agency.com"
 className="w-full border border-stone-300 rounded-lg px-3
 py-2 text-sm focus:outline-none focus:ring-2
 focus:ring-emerald-500" />
 </div>
 <div>
 <label className="block text-sm font-medium text-stone-700 mb-1">
 Password
 </label>
 <input type="password" value={password}
 onChange={e => setPassword(e.target.value)} required
 placeholder="••••••••"
 className="w-full border border-stone-300 rounded-lg px-3
 py-2 text-sm focus:outline-none focus:ring-2
 focus:ring-emerald-500" />
 </div>
 {error && (
 <p className="text-sm text-red-600 bg-red-50 border
 border-red-200 rounded-lg px-3 py-2">{error}</p>
 )}
 <button type="submit" disabled={loading}
 className="w-full bg-emerald-700 hover:bg-emerald-800 text-white
 font-medium py-3 rounded-lg disabled:opacity-50">
 {loading ? "Signing in..." : "Sign in"}
 </button>
 </form>
 </div>
 </main>
 );
}
