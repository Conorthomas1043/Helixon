"use client";
// app/employee/cold-calls/page.js
// Cold call log for the sales team - every active employee sees every
// call (it doubles as a team leaderboard), but only the person who made
// a call can edit or delete it. See lib/employee-cold-calls.js.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useHeartbeat } from "../_shared/useHeartbeat";

const OUTCOME_META = {
  no_answer: { label: "No answer", dot: "#94a3b8", bg: "#f4f4f5", color: "#475569" },
  voicemail: { label: "Left voicemail", dot: "#94a3b8", bg: "#f4f4f5", color: "#475569" },
  gatekeeper: { label: "Gatekeeper", dot: "#94a3b8", bg: "#f4f4f5", color: "#475569" },
  not_interested: { label: "Not interested", dot: "#e0554f", bg: "#fdf1f0", color: "#c0392b" },
  wrong_number: { label: "Wrong number", dot: "#e0554f", bg: "#fdf1f0", color: "#c0392b" },
  callback_requested: { label: "Callback requested", dot: "#d99a3a", bg: "#fdf5e9", color: "#b8791f" },
  interested: { label: "Interested", dot: "#0b6e4f", bg: "var(--mint)", color: "var(--forest)" },
  meeting_booked: { label: "Meeting booked", dot: "#0b6e4f", bg: "var(--mint)", color: "var(--forest)" },
};

function metaFor(outcome) {
  return OUTCOME_META[outcome] || { label: outcome, dot: "#94a3b8", bg: "#f4f4f5", color: "#475569" };
}

function formatDayHeading(iso) {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.setHours(0, 0, 0, 0) - today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const EMPTY_FORM = { contact_name: "", company: "", phone: "", outcome: "no_answer", notes: "", follow_up_at: "", called_at: "" };

export default function ColdCallsPage() {
  const router = useRouter();
  useHeartbeat();

  const [checking, setChecking] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scope, setScope] = useState("team"); // "team" | "mine"

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/employee/me");
        if (!res.ok) { router.replace("/employee/login"); return; }
        const data = await res.json();
        if (!data.ok) { router.replace("/employee/login"); return; }
        setEmployee(data.employee);
      } catch {
        router.replace("/employee/login");
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  async function fetchAll() {
    setLoading(true);
    setError("");
    try {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const params = new URLSearchParams({ from: from.toISOString(), stats: "1" });
      if (scope === "mine") params.set("mine", "1");
      const res = await fetch(`/api/employee/cold-calls?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Could not load calls."); return; }
      setCalls(data.calls || []);
      setStats(data.stats);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!checking) fetchAll();
  }, [checking, scope]);

  function openAdd() {
    setForm({ ...EMPTY_FORM, called_at: toLocalInputValue(new Date()) });
    setFormError("");
    setEditingId(null);
    setShowAddForm(true);
  }

  function openEdit(call) {
    setForm({
      contact_name: call.contact_name || "",
      company: call.company || "",
      phone: call.phone || "",
      outcome: call.outcome,
      notes: call.notes || "",
      follow_up_at: call.follow_up_at ? call.follow_up_at.slice(0, 10) : "",
      called_at: toLocalInputValue(new Date(call.called_at)),
    });
    setFormError("");
    setEditingId(call.id);
    setShowAddForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        action: editingId ? "update" : "create",
        contact_name: form.contact_name.trim(),
        company: form.company.trim(),
        phone: form.phone.trim(),
        outcome: form.outcome,
        notes: form.notes.trim(),
        follow_up_at: form.follow_up_at ? new Date(`${form.follow_up_at}T09:00:00`).toISOString() : null,
        called_at: form.called_at ? new Date(form.called_at).toISOString() : new Date().toISOString(),
      };
      if (editingId) payload.id = editingId;

      const res = await fetch("/api/employee/cold-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) { setFormError(data.error || "Failed to save."); return; }
      setShowAddForm(false);
      fetchAll();
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function setOutcome(call, outcome) {
    setCalls((prev) => prev.map((c) => (c.id === call.id ? { ...c, outcome } : c)));
    try {
      const res = await fetch("/api/employee/cold-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: call.id, outcome }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to update outcome.");
    } catch (err) {
      alert(err.message || "Failed to update outcome.");
      fetchAll();
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this call log entry?")) return;
    setCalls((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch("/api/employee/cold-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to delete.");
    } catch (err) {
      alert(err.message || "Failed to delete.");
      fetchAll();
    }
  }

  const grouped = useMemo(() => {
    const map = new Map();
    for (const call of calls) {
      const key = new Date(call.called_at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(call);
    }
    return [...map.entries()].sort((a, b) => new Date(b[0]) - new Date(a[0]));
  }, [calls]);

  const todayTotal = calls.filter((c) => new Date(c.called_at).toDateString() === new Date().toDateString()).length;

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--mist)" }}>
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "4px solid var(--border)", borderTopColor: "var(--forest)" }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b" style={{ borderColor: "var(--border)" }} aria-label="Main">
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link href="/employee/dashboard" className="flex items-center gap-3 group" aria-label="Employee dashboard">
            <div className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105" style={{ background: "var(--forest)" }}>
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>Helixon</span>
              <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "var(--ink-faint)" }}>Employee portal</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/employee/calendar" className="nav-link text-xs font-medium px-2" style={{ color: "var(--ink-soft)" }}>Calendar</Link>
            <Link href="/employee/goals" className="nav-link text-xs font-medium px-2" style={{ color: "var(--ink-soft)" }}>Goals</Link>
            <Link href="/employee/dashboard" className="text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:bg-white" style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}>
              ← My dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              Cold calls
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
              Log outbound calls and track outcomes across the sales team. You logged <b>{todayTotal}</b> today.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-lg transition hover:opacity-90 self-start"
            style={{ background: "var(--forest)", color: "white" }}
          >
            <span className="text-base leading-none">+</span> Log call
          </button>
        </div>

        {error && (
          <div className="rounded-[14px] px-4 py-3 text-sm mb-6" style={{ background: "#fdf1f0", border: "1px solid #f4d4d2", color: "#e0554f" }}>
            {error}
          </div>
        )}

        {showAddForm && (
          <div className="rounded-[16px] p-5 mb-6" style={{ background: "white", border: "1px solid var(--border)" }}>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Contact name</label>
                  <input
                    autoFocus
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Company</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Outcome</label>
                  <select
                    value={form.outcome}
                    onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  >
                    {Object.entries(OUTCOME_META).map(([value, meta]) => (
                      <option key={value} value={value}>{meta.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Called at</label>
                  <input
                    type="datetime-local"
                    value={form.called_at}
                    onChange={(e) => setForm((f) => ({ ...f, called_at: e.target.value }))}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Follow up on</label>
                  <input
                    type="date"
                    value={form.follow_up_at}
                    onChange={(e) => setForm((f) => ({ ...f, follow_up_at: e.target.value }))}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    placeholder="What came up, objections, next step…"
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition resize-none"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
              </div>

              {formError && (
                <p className="text-xs rounded-lg px-3 py-2" style={{ color: "#e0554f", background: "#fdf1f0", border: "1px solid #f4d4d2" }}>{formError}</p>
              )}

              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 hover:opacity-90" style={{ background: "var(--forest)", color: "white" }}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Log call"}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-sm px-4 py-2 rounded-lg transition hover:bg-white" style={{ color: "var(--ink-soft)" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* ── Call log ────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              {["team", "mine"].map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition"
                  style={scope === s ? { background: "var(--forest)", color: "white" } : { background: "white", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
                >
                  {s === "team" ? "Whole team" : "Just me"}
                </button>
              ))}
            </div>

            <div className="rounded-[16px] overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }}>
              {loading ? (
                <div className="px-6 py-14 text-center text-sm" style={{ color: "var(--ink-faint)" }}>Loading…</div>
              ) : grouped.length === 0 ? (
                <div className="px-6 py-14 text-center text-sm" style={{ color: "var(--ink-faint)" }}>No calls logged in the last 30 days - log one above.</div>
              ) : (
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {grouped.map(([dayKey, dayCalls]) => (
                    <div key={dayKey} className="px-6 py-4">
                      <p className="text-xs font-semibold mb-2.5" style={{ color: "var(--ink-faint)" }}>
                        {formatDayHeading(dayCalls[0].called_at)} · {dayCalls.length} call{dayCalls.length === 1 ? "" : "s"}
                      </p>
                      <div className="space-y-2.5">
                        {dayCalls.map((call) => {
                          const canEdit = call.employee_id === employee?.id;
                          const caller = call.caller?.full_name || call.caller?.display_name;
                          const meta = metaFor(call.outcome);
                          return (
                            <div key={call.id} className="flex items-start gap-3 group">
                              <span className="text-xs font-medium tabular-nums w-12 shrink-0 mt-0.5" style={{ color: "var(--ink-faint)" }}>
                                {formatTime(call.called_at)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                                    {call.contact_name || call.company || "Unnamed contact"}
                                  </p>
                                  {canEdit ? (
                                    <select
                                      value={call.outcome}
                                      onChange={(e) => setOutcome(call, e.target.value)}
                                      className="text-[10px] font-semibold pl-2 pr-1 py-0.5 rounded-full"
                                      style={{ background: meta.bg, color: meta.color, border: "none" }}
                                    >
                                      {Object.entries(OUTCOME_META).map(([value, m]) => (
                                        <option key={value} value={value}>{m.label}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                                      {meta.label}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                                  {call.company && call.contact_name ? `${call.company} · ` : ""}
                                  {call.phone ? `${call.phone} · ` : ""}
                                  {scope === "team" && caller ? `Called by ${caller}` : ""}
                                  {call.follow_up_at ? ` · Follow up ${formatDate(call.follow_up_at)}` : ""}
                                </p>
                                {call.notes && <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>{call.notes}</p>}
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                  <button onClick={() => openEdit(call)} className="text-xs px-2 py-1 rounded-md transition hover:bg-white" style={{ color: "var(--ink-soft)" }}>Edit</button>
                                  <button onClick={() => handleDelete(call.id)} className="text-xs px-2 py-1 rounded-md transition" style={{ color: "#e0554f" }}>Delete</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Leaderboard ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="rounded-[16px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                This week
              </h2>
              {!stats || stats.byEmployee.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--ink-faint)" }}>No calls logged this week yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.byEmployee.map((row) => (
                    <div key={row.employeeId} className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium truncate" style={{ color: row.employeeId === employee?.id ? "var(--forest)" : "var(--ink)" }}>
                        {row.name}
                      </span>
                      <span className="text-xs shrink-0 tabular-nums" style={{ color: "var(--ink-faint)" }}>
                        {row.today} today · {row.thisWeek} this week
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {stats && Object.keys(stats.byOutcomeThisWeek).length > 0 && (
              <div className="rounded-[16px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
                <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                  Outcomes this week
                </h2>
                <div className="space-y-2">
                  {Object.entries(stats.byOutcomeThisWeek)
                    .sort((a, b) => b[1] - a[1])
                    .map(([outcome, count]) => {
                      const meta = metaFor(outcome);
                      return (
                        <div key={outcome} className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--ink-soft)" }}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
                            {meta.label}
                          </span>
                          <span className="text-xs tabular-nums" style={{ color: "var(--ink-faint)" }}>{count}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
