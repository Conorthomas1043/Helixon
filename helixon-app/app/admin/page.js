"use client";
// app/admin/page.js  — Full admin dashboard, restyled to match the Helixon marketing/product design system
// Tabs: overview | agencies | analyses | candidates | subscriptions | traffic | security | employees

import { useState, useEffect, useCallback } from "react";
import EmployeesTab from "@/components/admin/EmployeesTab";

// ─── Design tokens (shared with landing page) ──────────────────────────────
// --forest #0b6e4f · --forest-deep #085a41 · --mint #e3f0e9 · --mist #f6f8f6
// --border #dde6e1 · --signal #f59e0b · --font-display Fraunces · --font-mono IBM Plex Mono
const ink = "#13201b";
const inkSoft = "#5a7a6a";
const inkFaint = "#8aaa9a";
const alertRed = "#dc2626";
const alertRedBg = "#fdecec";
const alertAmber = "#b45309";
const alertAmberBg = "#fdf3e0";
const violet = "#6d4fc7";
const violetBg = "#eee9fb";
const cardBorder = { borderColor: "var(--border)" };

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function recommendationStyle(rec) {
  if (rec === "Strong match") return { background: "var(--mint)", color: "var(--forest)" };
  if (rec === "Worth reviewing") return { background: alertAmberBg, color: alertAmber };
  return { background: alertRedBg, color: alertRed };
}

function scoreColour(score) {
  if (score >= 80) return "var(--forest)";
  if (score >= 60) return alertAmber;
  return alertRed;
}

function severityStyle(s) {
  if (s === "critical") return { background: alertRedBg, color: alertRed, border: `1px solid ${alertRed}33` };
  if (s === "high") return { background: "#fdf0e6", color: "#c2540f", border: "1px solid #c2540f33" };
  if (s === "medium") return { background: alertAmberBg, color: alertAmber, border: `1px solid ${alertAmber}33` };
  return { background: "var(--mist)", color: inkSoft, border: "1px solid var(--border)" };
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

function downloadCSV(filename, rows, headers) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Buckets timestamped logs into N evenly-spaced windows across the given
// time range, for a lightweight client-side requests-over-time chart —
// no backend changes needed since recentLogs already carries timestamps.
function bucketByTime(logs, hours, bucketCount = 24) {
  const now = Date.now();
  const startTime = now - hours * 3600 * 1000;
  const bucketMs = (now - startTime) / bucketCount;
  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    t: startTime + i * bucketMs,
    total: 0,
    blocked: 0,
  }));
  for (const log of logs) {
    const ts = new Date(log.ts).getTime();
    if (Number.isNaN(ts) || ts < startTime) continue;
    const idx = Math.min(bucketCount - 1, Math.floor((ts - startTime) / bucketMs));
    if (buckets[idx]) {
      buckets[idx].total += 1;
      if (log.blocked) buckets[idx].blocked += 1;
    }
  }
  return buckets;
}

const ALL_TABS = ["overview", "agencies", "analyses", "candidates", "subscriptions", "traffic", "security", "users", "employees"];

// ─── Small shared UI pieces ─────────────────────────────────────────────────

function Card({ children, className = "", alert = false }) {
  return (
    <div
      className={`bg-white rounded-[16px] border overflow-hidden transition-shadow ${className}`}
      style={{ borderColor: alert ? `${alertRed}55` : "var(--border)", boxShadow: "0 1px 2px rgba(19,32,27,0.04)" }}
    >
      {children}
    </div>
  );
}

function CardHeader({ children, action }) {
  return (
    <div className="px-6 py-4 border-b flex items-center justify-between gap-3" style={cardBorder}>
      <h2 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: inkFaint }}>{children}</h2>
      {action}
    </div>
  );
}

function Spinner() {
  return <div className="w-8 h-8 rounded-full border-4 animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--forest)" }} />;
}

function Pill({ children, style }) {
  return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0" style={style}>{children}</span>;
}

// Icon badge used on stat cards — replaces the old emoji icons with something
// that matches the rest of the site's stroke-icon language (nav logo, hero
// scan checklist icons, etc.) instead of relying on OS emoji rendering.
function StatIcon({ path, tone = "forest" }) {
  const tones = {
    forest: { bg: "var(--mint)", color: "var(--forest)" },
    amber: { bg: alertAmberBg, color: alertAmber },
    red: { bg: alertRedBg, color: alertRed },
    violet: { bg: violetBg, color: violet },
  };
  const t = tones[tone] || tones.forest;
  return (
    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center mb-3" style={{ background: t.bg }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </div>
  );
}

const ICONS = {
  agencies: "M3 21h18M5 21V7l7-4 7 4v14M9 9h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1",
  analyses: "M4 19V9m6 10V5m6 14v-7",
  candidates: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm11 9v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-6a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-2.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  billing: "M2 8h20M2 6h20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm4 9h4",
  requests: "M4 11a9 9 0 0 1 9-9m0 0a9 9 0 0 1 9 9m-9-9v18m0 0a9 9 0 0 0 9-9m-9 9a9 9 0 0 1-9-9",
  unique: "M12 21c-4-3.5-8-7.5-8-12a8 8 0 0 1 16 0c0 4.5-4 8.5-8 12Zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  blocked: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM5.5 5.5l13 13",
  bot: "M12 8V4H8m8 0h-4M6 12h12v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6Zm-2 0h16M9 16h.01M15 16h.01",
  warn: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4m0 4h.01",
};

// ─── Main Component ───────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [currentUser, setCurrentUser] = useState("");

  // Core data
  const [stats, setStats] = useState(null);
  const [scores, setScores] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Traffic data
  const [traffic, setTraffic] = useState(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficHours, setTrafficHours] = useState(24);
  const [trafficAutoRefresh, setTrafficAutoRefresh] = useState(false);
  const [trafficSearch, setTrafficSearch] = useState("");
  const [trafficMethodFilter, setTrafficMethodFilter] = useState("all");
  const [trafficOnlyBlocked, setTrafficOnlyBlocked] = useState(false);

  // Security data
  const [security, setSecurity] = useState(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [blockingIP, setBlockingIP] = useState(null);
  const [manualBlockIP, setManualBlockIP] = useState("");
  const [manualBlockReason, setManualBlockReason] = useState("");

  // Users (test accounts) data
  const [testUsers, setTestUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserAgency, setNewUserAgency] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [userActionId, setUserActionId] = useState(null); // id currently being suspended/deleted/reset
  const [resetPasswordFor, setResetPasswordFor] = useState(null); // user id with reset form open
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [usersSearch, setUsersSearch] = useState("");

  // UI state
  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [selectedAgency, setSelectedAgency] = useState("all");
  const [togglingAdmin, setTogglingAdmin] = useState(null);

  // ── Session ───────────────────────────────────────────────────────────────

  useEffect(() => { checkSession(); }, []);

  async function checkSession() {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        if (data.ok) { setAuthed(true); applyData(data); }
      }
    } catch { /* fall through to login */ }
    finally { setCheckingSession(false); }
  }

  function applyData(data) {
    setStats(data.stats);
    setScores(data.scores);
    setCandidates(data.candidates);
    setSubscriptions(data.subscriptions);
    setAgencies(data.agencies);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    setLoggingIn(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.ok) { setLoginError(data.error || "Login failed."); setPassword(""); return; }
      setCurrentUser(data.username);
      setAuthed(true);
      fetchAll();
    } catch { setLoginError("Network error. Please try again."); }
    finally { setLoggingIn(false); }
  }

  async function handleLogout() {
    try { await fetch("/api/admin/logout", { method: "POST" }); } catch { }
    setAuthed(false);
    setUsername("");
    setPassword("");
    setCurrentUser("");
    setStats(null);
  }

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      applyData(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  // ── Traffic ───────────────────────────────────────────────────────────────

  const fetchTraffic = useCallback(async (hours = trafficHours) => {
    setTrafficLoading(true);
    try {
      const res = await fetch(`/api/admin/traffic?hours=${hours}`);
      const data = await res.json();
      if (data.ok) setTraffic(data);
    } catch { }
    finally { setTrafficLoading(false); }
  }, [trafficHours]);

  useEffect(() => {
    if (tab === "traffic" && authed) fetchTraffic(trafficHours);
  }, [tab, trafficHours, authed, fetchTraffic]);

  useEffect(() => {
    if (!(tab === "traffic" && authed && trafficAutoRefresh)) return;
    const id = setInterval(() => fetchTraffic(trafficHours), 30000);
    return () => clearInterval(id);
  }, [tab, authed, trafficAutoRefresh, trafficHours, fetchTraffic]);

  // ── Security ──────────────────────────────────────────────────────────────

  const fetchSecurity = useCallback(async () => {
    setSecurityLoading(true);
    try {
      const res = await fetch("/api/admin/security");
      const data = await res.json();
      if (data.ok) setSecurity(data);
    } catch { }
    finally { setSecurityLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "security" && authed) fetchSecurity();
  }, [tab, authed, fetchSecurity]);

  async function blockIP(ip, reason) {
    setBlockingIP(ip);
    try {
      await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "block_ip", ip, reason }),
      });
      fetchSecurity();
    } finally { setBlockingIP(null); }
  }

  async function unblockIP(ip) {
    setBlockingIP(ip);
    try {
      await fetch("/api/admin/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unblock_ip", ip }),
      });
      fetchSecurity();
    } finally { setBlockingIP(null); }
  }

  async function resolveEvent(eventId) {
    await fetch("/api/admin/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve_event", eventId }),
    });
    setSecurity((prev) => prev ? {
      ...prev,
      events: prev.events.map((e) => e.id === eventId ? { ...e, resolved: true } : e),
    } : prev);
  }

  async function handleManualBlock(e) {
    e.preventDefault();
    if (!manualBlockIP.trim()) return;
    await blockIP(manualBlockIP.trim(), manualBlockReason.trim() || "Manually blocked by admin");
    setManualBlockIP("");
    setManualBlockReason("");
  }

  // ── Users (test accounts) ────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to load users");
      setTestUsers(data.users);
    } catch (err) {
      setUsersError(err.message);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "users" && authed) fetchUsers();
  }, [tab, authed, fetchUsers]);

  async function handleCreateTestUser(e) {
    e.preventDefault();
    if (!newUserUsername.trim() || !newUserPassword.trim()) return;
    setCreatingUser(true);
    setUsersError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUserUsername.trim(),
          password: newUserPassword,
          agencyId: newUserAgency || null,
          isTestUser: true,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to create user");
      setNewUserUsername("");
      setNewUserPassword("");
      setNewUserAgency("");
      fetchUsers();
    } catch (err) {
      setUsersError(err.message);
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleSuspendUser(userId, suspend) {
    setUserActionId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: suspend ? "suspend" : "unsuspend", userId }),
      });
      const data = await res.json();
      if (data.ok) {
        setTestUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, suspended: suspend } : u)));
      }
    } finally {
      setUserActionId(null);
    }
  }

  async function handleResetPassword(userId) {
    if (!resetPasswordValue.trim()) return;
    setUserActionId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password", userId, newPassword: resetPasswordValue }),
      });
      const data = await res.json();
      if (data.ok) {
        setResetPasswordFor(null);
        setResetPasswordValue("");
      }
    } finally {
      setUserActionId(null);
    }
  }

  async function handleDeleteUser(userId) {
    if (!confirm("Delete this user permanently? This cannot be undone.")) return;
    setUserActionId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.ok) setTestUsers((prev) => prev.filter((u) => u.id !== userId));
    } finally {
      setUserActionId(null);
    }
  }

  // ── Filters ───────────────────────────────────────────────────────────────

  function agencyName(agencyId) {
    return agencies.find((a) => a.id === agencyId)?.name || "Unknown agency";
  }

  const filteredScores = scores.filter((s) => {
    const agencyMatch = selectedAgency === "all" || s.candidates?.agency_id === selectedAgency || s.jobs?.agency_id === selectedAgency;
    const q = search.toLowerCase();
    return agencyMatch && (s.candidates?.name?.toLowerCase().includes(q) || s.jobs?.title?.toLowerCase().includes(q) || s.recommendation?.toLowerCase().includes(q));
  });

  const filteredCandidates = candidates.filter((c) => {
    const agencyMatch = selectedAgency === "all" || c.agency_id === selectedAgency;
    return agencyMatch && c.name?.toLowerCase().includes(search.toLowerCase());
  });

  function agencyStats(agencyId) {
    const ac = candidates.filter((c) => c.agency_id === agencyId);
    const as = scores.filter((s) => s.candidates?.agency_id === agencyId || s.jobs?.agency_id === agencyId);
    const avg = as.length > 0 ? Math.round(as.reduce((a, b) => a + (b.match_score || 0), 0) / as.length) : 0;
    return { candidates: ac.length, analyses: as.length, avgScore: avg, strongMatches: as.filter((s) => s.recommendation === "Strong match").length };
  }

  // ── Traffic analytics (derived client-side from recentLogs, no API changes needed) ──

  const trafficBuckets = traffic ? bucketByTime(traffic.recentLogs, trafficHours, trafficHours <= 6 ? 12 : 24) : [];
  const trafficPeakBucket = trafficBuckets.reduce((max, b) => (b.total > max ? b.total : max), 0);
  const trafficErrorRate = traffic && traffic.summary.total > 0
    ? Math.round((traffic.summary.blocked / traffic.summary.total) * 1000) / 10
    : 0;

  const filteredTrafficLogs = (traffic?.recentLogs || []).filter((log) => {
    if (trafficOnlyBlocked && !log.blocked) return false;
    if (trafficMethodFilter !== "all" && log.method !== trafficMethodFilter) return false;
    const q = trafficSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      log.path?.toLowerCase().includes(q) ||
      log.ip?.toLowerCase().includes(q) ||
      log.country?.toLowerCase().includes(q)
    );
  });

  const trafficMethods = traffic ? Object.keys(traffic.methodCount) : [];

  const filteredUsers = testUsers.filter((u) => {
    const q = usersSearch.trim().toLowerCase();
    if (!q) return true;
    return (u.username || u.email || "").toLowerCase().includes(q);
  });

  // ── Loading / Login screens ───────────────────────────────────────────────

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--mist)" }}>
        <Spinner />
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2" style={{ background: "var(--mist)" }}>
        {/* Branded panel — forest, only on larger screens, echoes the landing hero's final CTA block */}
        <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden" style={{ background: "var(--forest)" }}>
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)",
            backgroundSize: "28px 28px",
          }} />
          <div className="relative flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: "rgba(255,255,255,0.14)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.65" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="text-base font-semibold tracking-tight text-white" style={{ fontFamily: "var(--font-display)" }}>Helixon</span>
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>Admin console</p>
            <h1 className="text-3xl font-semibold tracking-tight leading-[1.15] text-white mb-4" style={{ fontFamily: "var(--font-display)" }}>
              Every agency, analysis, and account — in one place.
            </h1>
            <p className="text-sm leading-relaxed max-w-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
              Session-scoped access, signed and short-lived. Nothing here is stored in the browser beyond your 8-hour session.
            </p>
          </div>
          <p className="relative text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>Helixon internal tools · not for candidate-facing use</p>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-sm">
            <div className="lg:hidden flex items-center gap-3 mb-8">
              <div className="w-8 h-8 rounded-[9px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
                <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                  <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                  <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                  <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
                </svg>
              </div>
              <span className="text-sm font-semibold tracking-tight" style={{ color: ink, fontFamily: "var(--font-display)" }}>Helixon Admin</span>
            </div>

            <h2 className="text-xl font-semibold tracking-tight mb-1" style={{ color: ink, fontFamily: "var(--font-display)" }}>Sign in</h2>
            <p className="text-[13px] mb-7" style={{ color: inkFaint }}>Restricted to Helixon administrators.</p>

            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5" style={{ color: inkSoft }}>Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username" autoFocus required
                  className="w-full rounded-[10px] px-3.5 py-2.5 text-sm outline-none transition-shadow"
                  style={{ border: "1px solid var(--border)", color: ink }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px var(--mint)")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")} />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-medium mb-1.5" style={{ color: inkSoft }}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required
                  className="w-full rounded-[10px] px-3.5 py-2.5 text-sm outline-none transition-shadow"
                  style={{ border: "1px solid var(--border)", color: ink }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px var(--mint)")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")} />
              </div>
              {loginError && (
                <div className="mb-4 p-3 rounded-[10px] text-xs flex items-start gap-2" style={{ background: alertRedBg, color: alertRed, border: `1px solid ${alertRed}33` }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" /></svg>
                  {loginError}
                </div>
              )}
              <button type="submit" disabled={loggingIn} className="w-full text-white font-semibold py-2.5 rounded-[10px] text-sm transition-all"
                style={{ background: loggingIn ? "#5aa383" : "var(--forest)", boxShadow: "0 8px 20px -10px rgba(11,110,79,0.5)" }}
                onMouseEnter={(e) => !loggingIn && (e.currentTarget.style.background = "var(--forest-deep)")}
                onMouseLeave={(e) => !loggingIn && (e.currentTarget.style.background = "var(--forest)")}>
                {loggingIn ? "Signing in…" : "Sign in"}
              </button>
            </form>
            <a href="/" className="block text-center text-[11px] mt-6 hover:underline" style={{ color: inkFaint }}>← Back to helixon.io</a>
          </div>
        </div>
      </main>
    );
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>

      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b px-6 py-3 flex items-center justify-between" style={cardBorder}>
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
            <svg width="15" height="15" viewBox="0 0 28 28" fill="none">
              <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
              <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
              <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: ink, fontFamily: "var(--font-display)" }}>Helixon</span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: alertRed, border: `1px solid ${alertRed}33`, background: alertRedBg }}>Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] hidden sm:inline" style={{ color: inkFaint }}>Signed in as <span className="font-semibold" style={{ color: inkSoft }}>{currentUser || "Admin"}</span></span>
          <a href="/" className="text-xs px-3 py-1.5 rounded-[8px] transition-colors" style={{ color: inkSoft }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mint)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>Back to app</a>
          <button onClick={fetchAll} className="text-xs px-3 py-1.5 rounded-[8px]" style={{ border: "1px solid var(--border)", color: inkSoft }}>Refresh</button>
          <button onClick={handleLogout} className="text-xs font-semibold px-3 py-1.5 rounded-[8px]" style={{ background: alertRedBg, border: `1px solid ${alertRed}33`, color: alertRed }}>Sign out</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: ink, fontFamily: "var(--font-display)" }}>Admin Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: inkSoft }}>All activity across Helixon</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-[10px] text-sm" style={{ background: alertRedBg, border: `1px solid ${alertRed}33`, color: alertRed }}>{error}</div>
        )}

        {loading && <div className="flex items-center justify-center py-24"><Spinner /></div>}

        {!loading && stats && (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              {[
                { label: "Agencies", value: stats.totalAgencies, icon: "🏢" },
                { label: "Total analyses", value: stats.totalScores, icon: "📊" },
                { label: "Candidates", value: stats.totalCandidates, icon: "👤" },
                { label: "Avg match score", value: stats.avgScore, icon: "🎯" },
                { label: "Active subscriptions", value: stats.activeSubscriptions, icon: "💳" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-[16px] border p-5" style={cardBorder}>
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className="text-2xl font-semibold" style={{ color: ink, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: inkFaint }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recommendation breakdown */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: "Strong matches", value: stats.strongMatches, style: { background: "var(--mint)", color: "var(--forest)" } },
                { label: "Worth reviewing", value: stats.worthReviewing, style: { background: alertAmberBg, color: alertAmber } },
                { label: "Not a fit", value: stats.notAFit, style: { background: alertRedBg, color: alertRed } },
              ].map((s) => (
                <div key={s.label} className="rounded-[16px] p-5" style={s.style}>
                  <div className="text-2xl font-semibold" style={{ fontFamily: "var(--font-mono)" }}>{s.value}</div>
                  <div className="text-xs mt-0.5 font-medium">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 mb-6 p-1 rounded-[12px] flex-wrap" style={{ background: "var(--mint)" }}>
              {ALL_TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="px-4 py-1.5 rounded-[9px] text-xs font-semibold capitalize transition-all"
                  style={tab === t
                    ? { background: "var(--forest)", color: "white" }
                    : { color: inkSoft, background: "transparent" }}
                >
                  {t}
                  {t === "security" && security?.summary?.unresolvedCount > 0 && (
                    <span className="ml-1.5 text-[10px] text-white rounded-full px-1.5 py-0.5" style={{ background: alertRed }}>
                      {security.summary.unresolvedCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Agency / search filter */}
            {(tab === "analyses" || tab === "candidates") && (
              <div className="flex gap-3 mb-4 flex-wrap">
                <select value={selectedAgency} onChange={(e) => setSelectedAgency(e.target.value)}
                  className="rounded-[10px] px-3 py-2 text-sm bg-white outline-none" style={{ border: "1px solid var(--border)", color: ink }}>
                  <option value="all">All agencies</option>
                  {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="rounded-[10px] px-3 py-2 text-sm flex-1 max-w-sm outline-none" style={{ border: "1px solid var(--border)", color: ink }} />
              </div>
            )}

            {/* ── OVERVIEW TAB ─────────────────────────────────────────────── */}
            {tab === "overview" && (
              <Card>
                <CardHeader>Recent analyses</CardHeader>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {scores.slice(0, 10).map((s) => (
                    <div key={s.id} className="px-6 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 font-bold text-xs" style={{ borderColor: scoreColour(s.match_score), color: scoreColour(s.match_score), fontFamily: "var(--font-mono)" }}>
                        {s.match_score}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: ink }}>{s.candidates?.name || "Unknown"}</p>
                        <p className="text-xs truncate" style={{ color: inkFaint }}>{s.jobs?.title || "Unknown role"} · {formatDate(s.created_at)}</p>
                        <p className="text-xs truncate" style={{ color: "#b0c4ba" }}>{agencyName(s.candidates?.agency_id || s.jobs?.agency_id)}</p>
                      </div>
                      <Pill style={recommendationStyle(s.recommendation)}>{s.recommendation}</Pill>
                    </div>
                  ))}
                  {scores.length === 0 && <p className="px-6 py-8 text-sm text-center" style={{ color: inkFaint }}>No analyses yet</p>}
                </div>
              </Card>
            )}

            {/* ── AGENCIES TAB ─────────────────────────────────────────────── */}
            {tab === "agencies" && (
              <div className="space-y-4">
                {agencies.length === 0 && <Card><p className="p-10 text-center text-sm" style={{ color: inkFaint }}>No agencies yet</p></Card>}
                {agencies.map((agency) => {
                  const as = agencyStats(agency.id);
                  const usageCount = agency.usage_count ?? 0;
                  const usageLimit = agency.usage_limit ?? 50;
                  const usagePct = Math.min(100, Math.round((usageCount / usageLimit) * 100));
                  const isToggling = togglingAdmin === agency.id;
                  return (
                    <Card key={agency.id}>
                      <div className="px-6 py-5 border-b flex items-start justify-between gap-4" style={cardBorder}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-6 h-6 rounded-[6px] flex items-center justify-center" style={{ background: "var(--forest)" }}><span className="text-white text-xs font-bold">{agency.name?.charAt(0) || "A"}</span></div>
                            <h3 className="text-base font-semibold" style={{ color: ink }}>{agency.name}</h3>
                            {agency.is_admin && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: violetBg, color: violet, border: `1px solid ${violet}33` }}>Admin — no limit</span>}
                          </div>
                          <p className="text-xs" style={{ color: inkFaint }}>{agency.intake_email}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#b0c4ba" }}>Since {formatDate(agency.created_at)}</p>
                          <div className="mt-3 w-56">
                            <div className="flex justify-between text-xs mb-1">
                              <span style={{ color: inkFaint }}>Usage</span>
                              {agency.is_admin ? <span style={{ color: violet, fontWeight: 600 }}>Unlimited</span> : <span style={{ fontWeight: 600, color: usagePct >= 90 ? alertRed : usagePct >= 70 ? alertAmber : inkSoft }}>{usageCount} / {usageLimit}</span>}
                            </div>
                            {!agency.is_admin && <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}><div className="h-full rounded-full transition-all duration-500" style={{ width: `${usagePct}%`, background: usagePct >= 90 ? alertRed : usagePct >= 70 ? alertAmber : "var(--forest)" }} /></div>}
                            {agency.is_admin && <div className="h-1.5 rounded-full overflow-hidden" style={{ background: violetBg }}><div className="h-full w-full rounded-full" style={{ background: `${violet}88` }} /></div>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-4">
                          <button
                            onClick={async () => {
                              setTogglingAdmin(agency.id);
                              try {
                                const res = await fetch("/api/admin/set-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agencyId: agency.id, isAdmin: !agency.is_admin }) });
                                const data = await res.json();
                                if (data.ok) setAgencies((prev) => prev.map((a) => a.id === agency.id ? { ...a, is_admin: !agency.is_admin } : a));
                              } finally { setTogglingAdmin(null); }
                            }}
                            disabled={isToggling}
                            className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-[8px] transition-colors"
                            style={{
                              background: agency.is_admin ? violetBg : "var(--mist)",
                              border: agency.is_admin ? `1px solid ${violet}33` : "1px solid var(--border)",
                              color: agency.is_admin ? violet : inkFaint,
                              opacity: isToggling ? 0.5 : 1,
                              cursor: isToggling ? "not-allowed" : "pointer",
                            }}
                          >
                            <span className="w-7 h-4 rounded-full relative inline-block transition-colors" style={{ background: agency.is_admin ? violet : "var(--border)" }}>
                              <span className="absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-transform" style={{ transform: agency.is_admin ? "translateX(14px)" : "translateX(2px)" }} />
                            </span>
                            {isToggling ? "Saving…" : agency.is_admin ? "Admin on" : "Admin off"}
                          </button>
                          <div className="grid grid-cols-4 gap-4 text-center">
                            {[{ label: "Candidates", value: as.candidates }, { label: "Analyses", value: as.analyses }, { label: "Avg score", value: as.avgScore }, { label: "Strong matches", value: as.strongMatches }].map((stat) => (
                              <div key={stat.label}><p className="text-lg font-semibold" style={{ color: ink, fontFamily: "var(--font-mono)" }}>{stat.value}</p><p className="text-xs" style={{ color: inkFaint }}>{stat.label}</p></div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="px-6 py-3 border-b" style={{ background: "var(--mist)", borderColor: "var(--border)" }}><p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: inkFaint }}>Candidates</p></div>
                        {candidates.filter((c) => c.agency_id === agency.id).length === 0 && <p className="px-6 py-4 text-xs" style={{ color: inkFaint }}>No candidates yet</p>}
                        {candidates.filter((c) => c.agency_id === agency.id).slice(0, 5).map((c) => {
                          const cs = scores.find((s) => s.candidates?.name === c.name);
                          return (
                            <div key={c.id} className="px-6 py-3 flex items-center gap-4 border-b" style={{ borderColor: "var(--mist)" }}>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: ink }}>{c.name}</p>
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {c.extracted?.skills?.slice(0, 4).map((skill, i) => <span key={i} className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--mist)", color: inkSoft }}>{skill}</span>)}
                                </div>
                              </div>
                              {cs && (
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 font-bold text-xs" style={{ borderColor: scoreColour(cs.match_score), color: scoreColour(cs.match_score) }}>{cs.match_score}</div>
                                  <Pill style={recommendationStyle(cs.recommendation)}>{cs.recommendation}</Pill>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {candidates.filter((c) => c.agency_id === agency.id).length > 5 && <p className="px-6 py-3 text-xs" style={{ color: inkFaint }}>+{candidates.filter((c) => c.agency_id === agency.id).length - 5} more candidates</p>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* ── ANALYSES TAB ─────────────────────────────────────────────── */}
            {tab === "analyses" && (
              <Card>
                <CardHeader>All analyses ({filteredScores.length})</CardHeader>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {filteredScores.map((s) => (
                    <div key={s.id} className="px-6 py-4 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 font-bold text-xs" style={{ borderColor: scoreColour(s.match_score), color: scoreColour(s.match_score) }}>{s.match_score}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: ink }}>{s.candidates?.name || "Unknown"}</p>
                        <p className="text-xs truncate" style={{ color: inkFaint }}>{s.jobs?.title || "Unknown role"} · {formatDate(s.created_at)}</p>
                        <p className="text-xs truncate" style={{ color: "#b0c4ba" }}>{agencyName(s.candidates?.agency_id || s.jobs?.agency_id)}</p>
                        {s.result?.summary && <p className="text-xs mt-0.5 truncate" style={{ color: inkSoft }}>{s.result.summary}</p>}
                      </div>
                      <Pill style={recommendationStyle(s.recommendation)}>{s.recommendation}</Pill>
                    </div>
                  ))}
                  {filteredScores.length === 0 && <p className="px-6 py-8 text-sm text-center" style={{ color: inkFaint }}>No results</p>}
                </div>
              </Card>
            )}

            {/* ── CANDIDATES TAB ───────────────────────────────────────────── */}
            {tab === "candidates" && (
              <Card>
                <CardHeader>All candidates ({filteredCandidates.length})</CardHeader>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {filteredCandidates.map((c) => (
                    <div key={c.id} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: ink }}>{c.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#b0c4ba" }}>{agencyName(c.agency_id)}</p>
                          <p className="text-xs mt-0.5" style={{ color: inkFaint }}>{formatDate(c.created_at)}</p>
                          {c.extracted?.skills?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {c.extracted.skills.slice(0, 5).map((skill, i) => <span key={i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--mist)", color: inkSoft }}>{skill}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="text-xs shrink-0" style={{ color: inkFaint }}>{c.extracted?.years_experience ? `${c.extracted.years_experience} yrs exp` : ""}</div>
                      </div>
                    </div>
                  ))}
                  {filteredCandidates.length === 0 && <p className="px-6 py-8 text-sm text-center" style={{ color: inkFaint }}>No candidates found</p>}
                </div>
              </Card>
            )}

            {/* ── SUBSCRIPTIONS TAB ───────────────────────────────────────── */}
            {tab === "subscriptions" && (
              <Card>
                <CardHeader>Subscriptions ({subscriptions.length})</CardHeader>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {subscriptions.map((s) => (
                    <div key={s.id} className="px-6 py-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: ink }}>{s.user_id || "Unknown user"}</p>
                        <p className="text-xs mt-0.5" style={{ color: inkFaint }}>Since {formatDate(s.created_at)}</p>
                      </div>
                      <Pill style={s.status === "active" ? { background: "var(--mint)", color: "var(--forest)" } : { background: "var(--mist)", color: inkSoft }}>{s.status}</Pill>
                    </div>
                  ))}
                  {subscriptions.length === 0 && <p className="px-6 py-8 text-sm text-center" style={{ color: inkFaint }}>No subscriptions yet</p>}
                </div>
              </Card>
            )}

            {/* ── TRAFFIC TAB ──────────────────────────────────────────────── */}
            {tab === "traffic" && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium" style={{ color: inkSoft }}>Window:</span>
                  {[
                    { label: "1h", value: 1 }, { label: "6h", value: 6 }, { label: "24h", value: 24 },
                    { label: "48h", value: 48 }, { label: "7d", value: 168 },
                  ].map(({ label, value }) => (
                    <button key={value} onClick={() => setTrafficHours(value)} className="text-xs px-3 py-1.5 rounded-[8px] font-medium transition-colors"
                      style={trafficHours === value ? { background: "var(--forest)", color: "white" } : { background: "white", border: "1px solid var(--border)", color: inkSoft }}>{label}</button>
                  ))}
                  <label className="flex items-center gap-1.5 text-xs font-medium ml-2 cursor-pointer select-none" style={{ color: inkSoft }}>
                    <input type="checkbox" checked={trafficAutoRefresh} onChange={(e) => setTrafficAutoRefresh(e.target.checked)} className="rounded" style={{ accentColor: "var(--forest)" }} />
                    Auto-refresh (30s)
                  </label>
                  <div className="ml-auto flex items-center gap-2">
                    {traffic && (
                      <button
                        onClick={() => downloadCSV(`traffic-${trafficHours}h.csv`, traffic.recentLogs, ["ts", "method", "path", "ip", "country", "blocked"])}
                        className="text-xs px-3 py-1.5 rounded-[8px]" style={{ background: "white", border: "1px solid var(--border)", color: inkSoft }}
                      >
                        Export CSV
                      </button>
                    )}
                    <button onClick={() => fetchTraffic(trafficHours)} className="text-xs px-3 py-1.5 rounded-[8px]" style={{ background: "white", border: "1px solid var(--border)", color: inkSoft }}>Refresh</button>
                  </div>
                </div>

                {trafficLoading && <div className="flex justify-center py-16"><Spinner /></div>}

                {!trafficLoading && traffic && (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      {[
                        { label: "Total requests", value: traffic.summary.total.toLocaleString(), icon: "📡" },
                        { label: "Unique IPs", value: traffic.summary.uniqueIPs.toLocaleString(), icon: "🌐" },
                        { label: "Blocked requests", value: traffic.summary.blocked.toLocaleString(), icon: "🚫", alert: traffic.summary.blocked > 0 },
                        { label: "Bot requests", value: traffic.summary.botRequests.toLocaleString(), icon: "🤖" },
                        { label: "Block rate", value: `${trafficErrorRate}%`, icon: "⚠️", alert: trafficErrorRate > 5 },
                      ].map((s) => (
                        <div key={s.label} className="bg-white rounded-[16px] border p-5 transition hover:shadow-sm" style={{ borderColor: s.alert ? `${alertRed}55` : "var(--border)" }}>
                          <div className="text-2xl mb-2">{s.icon}</div>
                          <div className="text-2xl font-semibold" style={{ color: s.alert ? alertRed : ink, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                          <div className="text-xs mt-0.5" style={{ color: inkFaint }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Requests-over-time chart */}
                    <Card>
                      <div className="px-6 py-4 border-b flex items-center justify-between" style={cardBorder}>
                        <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: inkFaint }}>Requests over time</h3>
                        <div className="flex items-center gap-3 text-xs" style={{ color: inkFaint }}>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "var(--forest)" }} /> Allowed</span>
                          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: `${alertRed}99` }} /> Blocked</span>
                        </div>
                      </div>
                      <div className="px-6 py-5">
                        {trafficPeakBucket === 0 ? (
                          <p className="text-sm text-center py-6" style={{ color: inkFaint }}>No requests in this window yet</p>
                        ) : (
                          <div className="flex items-end gap-1 h-32">
                            {trafficBuckets.map((b, i) => {
                              const total = Math.max(b.total, 1);
                              const blockedRatio = b.blocked / total;
                              const heightPct = trafficPeakBucket > 0 ? Math.max((b.total / trafficPeakBucket) * 100, b.total > 0 ? 4 : 0) : 0;
                              return (
                                <div key={i} className="flex-1 h-full flex flex-col justify-end group relative">
                                  <div
                                    className="w-full rounded-t-sm relative overflow-hidden transition-all"
                                    style={{ height: `${heightPct}%`, minHeight: b.total > 0 ? 2 : 0, background: "var(--forest)" }}
                                  >
                                    {b.blocked > 0 && (
                                      <div className="absolute bottom-0 left-0 w-full" style={{ height: `${blockedRatio * 100}%`, background: `${alertRed}99` }} />
                                    )}
                                  </div>
                                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 hidden group-hover:block text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap z-10" style={{ background: ink }}>
                                    {b.total} req{b.blocked > 0 ? ` · ${b.blocked} blocked` : ""}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="flex justify-between text-[10px] mt-2" style={{ color: "#b0c4ba", fontFamily: "var(--font-mono)" }}>
                          <span>{trafficHours}h ago</span>
                          <span>now</span>
                        </div>
                      </div>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>Top paths</CardHeader>
                        <div className="divide-y" style={{ borderColor: "var(--mist)" }}>
                          {traffic.topPaths.slice(0, 10).map(({ path, count }) => (
                            <div key={path} className="px-6 py-3 flex items-center gap-3">
                              <div className="flex-1 min-w-0"><p className="text-xs truncate" style={{ color: inkSoft, fontFamily: "var(--font-mono)" }}>{path}</p></div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--mist)" }}>
                                  <div className="h-full rounded-full" style={{ width: `${Math.round((count / traffic.topPaths[0].count) * 100)}%`, background: "var(--forest)" }} />
                                </div>
                                <span className="text-xs font-semibold w-8 text-right" style={{ color: inkFaint }}>{count}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </Card>

                      <Card>
                        <CardHeader>Top IPs</CardHeader>
                        <div className="divide-y" style={{ borderColor: "var(--mist)" }}>
                          {traffic.topIPs.map(({ ip, count }) => {
                            const isBlocked = security?.blocked?.some((b) => b.ip === ip);
                            return (
                              <div key={ip} className="px-6 py-3 flex items-center gap-3">
                                <p className="flex-1 text-xs" style={{ color: inkSoft, fontFamily: "var(--font-mono)" }}>{ip}</p>
                                {isBlocked && <span className="text-xs font-medium" style={{ color: alertRed }}>Blocked</span>}
                                <span className="text-xs font-semibold" style={{ color: inkFaint }}>{count} req</span>
                                {!isBlocked && (
                                  <button onClick={() => blockIP(ip, "Blocked from traffic tab")} disabled={blockingIP === ip} className="text-xs font-medium transition" style={{ color: alertRed }}>{blockingIP === ip ? "…" : "Block"}</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </Card>

                      <Card>
                        <CardHeader>By country</CardHeader>
                        <div className="divide-y" style={{ borderColor: "var(--mist)" }}>
                          {traffic.byCountry.map(({ country, count }) => (
                            <div key={country} className="px-6 py-3 flex items-center gap-3">
                              <p className="flex-1 text-xs" style={{ color: inkSoft }}>{country || "Unknown"}</p>
                              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--mist)" }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.round((count / traffic.byCountry[0].count) * 100)}%`, background: "#5b8def" }} />
                              </div>
                              <span className="text-xs font-semibold w-8 text-right" style={{ color: inkFaint }}>{count}</span>
                            </div>
                          ))}
                        </div>
                      </Card>

                      <Card>
                        <CardHeader>HTTP methods</CardHeader>
                        <div className="px-6 py-4 flex flex-wrap gap-3">
                          {Object.entries(traffic.methodCount).map(([method, count]) => (
                            <div key={method} className="rounded-[10px] px-4 py-3 text-center" style={{ background: "var(--mist)", border: "1px solid var(--border)" }}>
                              <p className="text-xs font-bold" style={{ color: inkSoft, fontFamily: "var(--font-mono)" }}>{method}</p>
                              <p className="text-lg font-semibold mt-0.5" style={{ color: ink, fontFamily: "var(--font-mono)" }}>{count}</p>
                            </div>
                          ))}
                        </div>
                      </Card>
                    </div>

                    <Card>
                      <div className="px-6 py-4 border-b flex items-center justify-between gap-3 flex-wrap" style={cardBorder}>
                        <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: inkFaint }}>
                          Recent requests ({filteredTrafficLogs.length}{filteredTrafficLogs.length !== traffic.recentLogs.length ? ` of ${traffic.recentLogs.length}` : ""})
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            placeholder="Filter by path, IP, country…"
                            value={trafficSearch}
                            onChange={(e) => setTrafficSearch(e.target.value)}
                            className="rounded-[8px] px-3 py-1.5 text-xs w-52 outline-none"
                            style={{ border: "1px solid var(--border)", color: ink }}
                          />
                          <select value={trafficMethodFilter} onChange={(e) => setTrafficMethodFilter(e.target.value)} className="rounded-[8px] px-2 py-1.5 text-xs bg-white outline-none" style={{ border: "1px solid var(--border)", color: ink }}>
                            <option value="all">All methods</option>
                            {trafficMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                          </select>
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none" style={{ color: inkSoft }}>
                            <input type="checkbox" checked={trafficOnlyBlocked} onChange={(e) => setTrafficOnlyBlocked(e.target.checked)} className="rounded" style={{ accentColor: alertRed }} />
                            Blocked only
                          </label>
                        </div>
                      </div>
                      <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0"><tr style={{ background: "var(--mist)" }} className="border-b" >
                            {["Time", "Method", "Path", "IP", "Country", "Status"].map((h) => <th key={h} className="px-4 py-2 text-left font-semibold whitespace-nowrap" style={{ color: inkFaint, borderColor: "var(--border)" }}>{h}</th>)}
                          </tr></thead>
                          <tbody className="divide-y" style={{ borderColor: "var(--mist)" }}>
                            {filteredTrafficLogs.map((log, i) => (
                              <tr key={i} style={log.blocked ? { background: alertRedBg } : {}}>
                                <td className="px-4 py-2 whitespace-nowrap" style={{ color: inkFaint, fontFamily: "var(--font-mono)" }}>{formatTime(log.ts)}</td>
                                <td className="px-4 py-2 font-semibold whitespace-nowrap" style={{ color: inkSoft, fontFamily: "var(--font-mono)" }}>{log.method}</td>
                                <td className="px-4 py-2 max-w-xs truncate" style={{ color: inkSoft, fontFamily: "var(--font-mono)" }}>{log.path}</td>
                                <td className="px-4 py-2 whitespace-nowrap" style={{ color: inkFaint, fontFamily: "var(--font-mono)" }}>{log.ip}</td>
                                <td className="px-4 py-2 whitespace-nowrap" style={{ color: inkFaint }}>{log.country || "—"}</td>
                                <td className="px-4 py-2 whitespace-nowrap">{log.blocked ? <span className="font-semibold" style={{ color: alertRed }}>Blocked</span> : <span style={{ color: "var(--forest)" }}>OK</span>}</td>
                              </tr>
                            ))}
                            {filteredTrafficLogs.length === 0 && (
                              <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: inkFaint }}>No requests match these filters</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </>
                )}

                {!trafficLoading && !traffic && (
                  <Card><p className="p-12 text-center text-sm" style={{ color: inkFaint }}>No traffic data yet. Traffic logging starts once middleware is deployed.</p></Card>
                )}
              </div>
            )}

            {/* ── SECURITY TAB ─────────────────────────────────────────────── */}
            {tab === "security" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button onClick={fetchSecurity} className="text-xs px-3 py-1.5 rounded-[8px]" style={{ background: "white", border: "1px solid var(--border)", color: inkSoft }}>Refresh</button>
                </div>

                {securityLoading && <div className="flex justify-center py-16"><Spinner /></div>}

                {!securityLoading && security && (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { label: "Unresolved events", value: security.summary.unresolvedCount, alert: security.summary.unresolvedCount > 0 },
                        { label: "Critical / High", value: (security.summary.severitySummary.critical || 0) + (security.summary.severitySummary.high || 0), alert: (security.summary.severitySummary.critical || 0) > 0 },
                        { label: "Blocked IPs", value: security.summary.blockedIPCount },
                        { label: "Medium events", value: security.summary.severitySummary.medium || 0 },
                      ].map((s) => (
                        <div key={s.label} className="bg-white rounded-[16px] border p-5" style={{ borderColor: s.alert ? `${alertRed}66` : "var(--border)" }}>
                          <div className="text-2xl font-semibold" style={{ color: s.alert ? alertRed : ink, fontFamily: "var(--font-mono)" }}>{s.value}</div>
                          <div className="text-xs mt-0.5" style={{ color: inkFaint }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    <Card>
                      <div className="p-6">
                        <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-4" style={{ color: inkFaint }}>Block an IP manually</h3>
                        <form onSubmit={handleManualBlock} className="flex gap-3 flex-wrap">
                          <input type="text" placeholder="IP address (e.g. 1.2.3.4)" value={manualBlockIP} onChange={(e) => setManualBlockIP(e.target.value)}
                            className="rounded-[10px] px-3 py-2 text-sm w-48 outline-none" style={{ border: "1px solid var(--border)", color: ink }} />
                          <input type="text" placeholder="Reason (optional)" value={manualBlockReason} onChange={(e) => setManualBlockReason(e.target.value)}
                            className="rounded-[10px] px-3 py-2 text-sm flex-1 min-w-32 outline-none" style={{ border: "1px solid var(--border)", color: ink }} />
                          <button type="submit" className="text-white text-sm font-semibold px-4 py-2 rounded-[10px] transition" style={{ background: alertRed }}>Block IP</button>
                        </form>
                      </div>
                    </Card>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>Blocked IPs ({security.blocked.length})</CardHeader>
                        {security.blocked.length === 0 && <p className="px-6 py-8 text-sm text-center" style={{ color: inkFaint }}>No blocked IPs</p>}
                        <div className="divide-y" style={{ borderColor: "var(--mist)" }}>
                          {security.blocked.map((b) => (
                            <div key={b.ip} className="px-6 py-4 flex items-center gap-4">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold" style={{ color: ink, fontFamily: "var(--font-mono)" }}>{b.ip}</p>
                                <p className="text-xs mt-0.5" style={{ color: inkFaint }}>{b.reason || "No reason given"}</p>
                                <p className="text-xs mt-0.5" style={{ color: "#b0c4ba" }}>Blocked by {b.blocked_by} · {formatDate(b.blocked_at)}</p>
                              </div>
                              <button onClick={() => unblockIP(b.ip)} disabled={blockingIP === b.ip} className="text-xs font-medium transition" style={{ color: "var(--forest)" }}>{blockingIP === b.ip ? "…" : "Unblock"}</button>
                            </div>
                          ))}
                        </div>
                      </Card>

                      <Card>
                        <CardHeader>Top failed logins (72h)</CardHeader>
                        {security.topFailedIPs.length === 0 && <p className="px-6 py-8 text-sm text-center" style={{ color: inkFaint }}>No failed login data</p>}
                        <div className="divide-y" style={{ borderColor: "var(--mist)" }}>
                          {security.topFailedIPs.map(({ ip, count }) => {
                            const isBlocked = security.blocked.some((b) => b.ip === ip);
                            return (
                              <div key={ip} className="px-6 py-3 flex items-center gap-3">
                                <p className="flex-1 text-xs" style={{ color: inkSoft, fontFamily: "var(--font-mono)" }}>{ip}</p>
                                <span className="text-xs font-semibold" style={{ color: alertRed }}>{count} fails</span>
                                {!isBlocked ? (
                                  <button onClick={() => blockIP(ip, `${count} failed logins in 72h`)} disabled={blockingIP === ip} className="text-xs font-medium transition" style={{ color: alertRed }}>{blockingIP === ip ? "…" : "Block"}</button>
                                ) : <span className="text-xs" style={{ color: inkFaint }}>Blocked</span>}
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>Security events ({security.events.length})</CardHeader>
                      {security.events.length === 0 && <p className="px-6 py-8 text-sm text-center" style={{ color: inkFaint }}>No security events logged yet</p>}
                      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                        {security.events.map((event) => (
                          <div key={event.id} className="px-6 py-4 flex items-start gap-4" style={{ opacity: event.resolved ? 0.4 : 1 }}>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 shrink-0" style={severityStyle(event.severity)}>{event.severity}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold" style={{ color: ink }}>{event.event_type.replace(/_/g, " ")}</p>
                              {event.ip && <p className="text-xs mt-0.5" style={{ color: inkFaint, fontFamily: "var(--font-mono)" }}>{event.ip}</p>}
                              {event.detail && <p className="text-xs mt-0.5 truncate" style={{ color: inkFaint }}>{JSON.stringify(event.detail)}</p>}
                              <p className="text-xs mt-0.5" style={{ color: "#b0c4ba" }}>{formatDate(event.ts)} {formatTime(event.ts)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!event.resolved && (
                                <>
                                  {event.ip && !security.blocked.some((b) => b.ip === event.ip) && (
                                    <button onClick={() => blockIP(event.ip, `From security event: ${event.event_type}`)} disabled={blockingIP === event.ip} className="text-xs font-medium transition" style={{ color: alertRed }}>{blockingIP === event.ip ? "…" : "Block IP"}</button>
                                  )}
                                  <button onClick={() => resolveEvent(event.id)} className="text-xs font-medium transition" style={{ color: "var(--forest)" }}>Resolve</button>
                                </>
                              )}
                              {event.resolved && <span className="text-xs" style={{ color: "#b0c4ba" }}>Resolved</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>

                    <Card>
                      <CardHeader>Recent login attempts (72h)</CardHeader>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead><tr style={{ background: "var(--mist)" }} className="border-b">
                            {["Time", "IP", "Username", "Type", "Result"].map((h) => <th key={h} className="px-4 py-2 text-left font-semibold whitespace-nowrap" style={{ color: inkFaint, borderColor: "var(--border)" }}>{h}</th>)}
                          </tr></thead>
                          <tbody className="divide-y" style={{ borderColor: "var(--mist)" }}>
                            {security.recentLogins.map((l, i) => (
                              <tr key={i} style={!l.success ? { background: `${alertRedBg}88` } : {}}>
                                <td className="px-4 py-2 whitespace-nowrap" style={{ color: inkFaint, fontFamily: "var(--font-mono)" }}>{formatTime(l.ts)}</td>
                                <td className="px-4 py-2 whitespace-nowrap" style={{ color: inkSoft, fontFamily: "var(--font-mono)" }}>{l.ip}</td>
                                <td className="px-4 py-2" style={{ color: ink }}>{l.username || "—"}</td>
                                <td className="px-4 py-2" style={{ color: inkFaint }}>{l.login_type || "—"}</td>
                                <td className="px-4 py-2 whitespace-nowrap">{l.success ? <span className="font-semibold" style={{ color: "var(--forest)" }}>Success</span> : <span className="font-semibold" style={{ color: alertRed }}>Failed</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </>
                )}

                {!securityLoading && !security && (
                  <Card><p className="p-12 text-center text-sm" style={{ color: inkFaint }}>Security tables not yet created. Run the SQL schema from lib/employee-auth.js in your Supabase editor.</p></Card>
                )}
              </div>
            )}

            {/* ── USERS TAB (test accounts) ────────────────────────────────── */}
            {tab === "users" && (
              <div className="space-y-6">
                <Card>
                  <div className="p-6">
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: inkFaint }}>Create test user</h3>
                    <p className="text-xs mb-4" style={{ color: inkFaint }}>Creates a username/password login with immediate access to the tool. Use for demos, QA, or trial accounts.</p>
                    <form onSubmit={handleCreateTestUser} className="flex gap-3 flex-wrap items-start">
                      <div>
                        <input type="text" required placeholder="username" value={newUserUsername}
                          onChange={(e) => setNewUserUsername(e.target.value)}
                          className="rounded-[10px] px-3 py-2 text-sm w-56 outline-none"
                          style={{ border: newUserUsername && !USERNAME_RE.test(newUserUsername) ? `1px solid ${alertRed}` : "1px solid var(--border)", color: ink }} />
                        {newUserUsername && !USERNAME_RE.test(newUserUsername) && (
                          <p className="text-[11px] mt-1" style={{ color: alertRed }}>3-32 chars: letters, numbers, _ . -</p>
                        )}
                      </div>
                      <input type="text" required placeholder="Temporary password" value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        className="rounded-[10px] px-3 py-2 text-sm w-48 outline-none" style={{ border: "1px solid var(--border)", color: ink }} />
                      <select value={newUserAgency} onChange={(e) => setNewUserAgency(e.target.value)}
                        className="rounded-[10px] px-3 py-2 text-sm bg-white w-56 outline-none" style={{ border: "1px solid var(--border)", color: ink }}>
                        <option value="">No agency (create new)</option>
                        {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <button type="submit" disabled={creatingUser || (newUserUsername && !USERNAME_RE.test(newUserUsername))}
                        className="text-white text-sm font-semibold px-4 py-2 rounded-[10px] transition"
                        style={{ background: creatingUser ? "#5aa383" : "var(--forest)" }}>
                        {creatingUser ? "Creating…" : "Create test user"}
                      </button>
                    </form>
                    {usersError && <p className="text-xs mt-3" style={{ color: alertRed }}>{usersError}</p>}
                  </div>
                </Card>

                <Card>
                  <div className="px-6 py-4 border-b flex items-center justify-between gap-3 flex-wrap" style={cardBorder}>
                    <h3 className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: inkFaint }}>All users ({testUsers.length})</h3>
                    <div className="flex items-center gap-2">
                      <input type="text" placeholder="Search username…" value={usersSearch} onChange={(e) => setUsersSearch(e.target.value)}
                        className="rounded-[8px] px-3 py-1.5 text-xs w-44 outline-none" style={{ border: "1px solid var(--border)", color: ink }} />
                      <button onClick={fetchUsers} className="text-xs px-3 py-1.5 rounded-[8px]" style={{ background: "white", border: "1px solid var(--border)", color: inkSoft }}>Refresh</button>
                    </div>
                  </div>

                  {usersLoading && <div className="flex justify-center py-16"><Spinner /></div>}

                  {!usersLoading && testUsers.length === 0 && (
                    <p className="px-6 py-8 text-sm text-center" style={{ color: inkFaint }}>No users yet</p>
                  )}

                  {!usersLoading && testUsers.length > 0 && filteredUsers.length === 0 && (
                    <p className="px-6 py-8 text-sm text-center" style={{ color: inkFaint }}>No users match "{usersSearch}"</p>
                  )}

                  {!usersLoading && filteredUsers.length > 0 && (
                    <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                      {filteredUsers.map((u) => {
                        const busy = userActionId === u.id;
                        return (
                          <div key={u.id} className="px-6 py-4">
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold truncate" style={{ color: ink }}>{u.username || u.email || "Unnamed user"}</p>
                                  {u.is_test_user && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#e6f0fd", color: "#2563a8", border: "1px solid #2563a833" }}>Test</span>}
                                  {u.suspended && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: alertRedBg, color: alertRed, border: `1px solid ${alertRed}33` }}>Suspended</span>}
                                </div>
                                <p className="text-xs mt-0.5" style={{ color: inkFaint }}>{agencyName(u.agency_id)} · Created {formatDate(u.created_at)}</p>
                                {u.last_sign_in_at && <p className="text-xs mt-0.5" style={{ color: "#b0c4ba" }}>Last sign-in {formatDate(u.last_sign_in_at)} {formatTime(u.last_sign_in_at)}</p>}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => { setResetPasswordFor(resetPasswordFor === u.id ? null : u.id); setResetPasswordValue(""); }}
                                  className="text-xs font-medium transition px-2 py-1 rounded-[8px]" style={{ color: inkSoft }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--mist)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                                  Reset password
                                </button>
                                <button onClick={() => handleSuspendUser(u.id, !u.suspended)} disabled={busy}
                                  className="text-xs font-medium transition px-2 py-1 rounded-[8px]" style={{ color: u.suspended ? "var(--forest)" : alertAmber }}>
                                  {busy ? "…" : u.suspended ? "Unsuspend" : "Suspend"}
                                </button>
                                <button onClick={() => handleDeleteUser(u.id)} disabled={busy}
                                  className="text-xs font-medium transition px-2 py-1 rounded-[8px]" style={{ color: alertRed }}>
                                  {busy ? "…" : "Delete"}
                                </button>
                              </div>
                            </div>
                            {resetPasswordFor === u.id && (
                              <div className="mt-3 flex gap-2 items-center">
                                <input type="text" placeholder="New password" value={resetPasswordValue}
                                  onChange={(e) => setResetPasswordValue(e.target.value)}
                                  className="rounded-[10px] px-3 py-2 text-sm w-56 outline-none" style={{ border: "1px solid var(--border)", color: ink }} />
                                <button onClick={() => handleResetPassword(u.id)} disabled={busy}
                                  className="text-white text-xs font-semibold px-3 py-2 rounded-[10px] transition" style={{ background: "var(--forest)" }}>
                                  {busy ? "Saving…" : "Save new password"}
                                </button>
                                <button onClick={() => setResetPasswordFor(null)} className="text-xs" style={{ color: inkFaint }}>Cancel</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ── EMPLOYEES TAB ────────────────────────────────────────────── */}
            {tab === "employees" && <EmployeesTab />}

          </>
        )}
      </div>
    </main>
  );
}