"use client";
// app/employee/goals/page.js
// Shared team goals: a status (not started / in progress / blocked /
// done), an optional deadline, notes, and a "micro-goal" tick list under
// each one. Visible to every active employee - see lib/employee-goals.js
// for exactly who can edit vs. just view.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useHeartbeat } from "../_shared/useHeartbeat";

const STATUS_META = {
  not_started: { label: "Not started", dot: "#94a3b8", bg: "#f4f4f5", color: "#475569" },
  in_progress: { label: "In progress", dot: "#d99a3a", bg: "#fdf5e9", color: "#b8791f" },
  blocked: { label: "Blocked", dot: "#e0554f", bg: "#fdf1f0", color: "#c0392b" },
  done: { label: "Done", dot: "#0b6e4f", bg: "var(--mint)", color: "var(--forest)" },
};
const STATUS_ORDER = ["not_started", "in_progress", "blocked", "done"];

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(deadline, status) {
  if (!deadline || status === "done") return false;
  return new Date(deadline) < new Date(new Date().toDateString());
}

export default function EmployeeGoalsPage() {
  const router = useRouter();
  useHeartbeat();

  const [checking, setChecking] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [goals, setGoals] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ title: "", notes: "", deadline: "", assigned_to: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [newItemDrafts, setNewItemDrafts] = useState({}); // goalId -> text

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
    try {
      const [goalsRes, teamRes] = await Promise.all([
        fetch("/api/employee/goals", { cache: "no-store" }),
        fetch("/api/employee/team"),
      ]);
      const goalsData = await goalsRes.json();
      const teamData = await teamRes.json();
      if (goalsData.ok) setGoals(goalsData.goals);
      if (teamData.ok) setTeam(teamData.team);
      if (!goalsData.ok) setError(goalsData.error || "Could not load goals.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!checking) fetchAll();
  }, [checking]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/employee/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...form, assigned_to: form.assigned_to || null }),
      });
      const data = await res.json();
      if (!data.ok) { setFormError(data.error || "Failed to save."); return; }
      setForm({ title: "", notes: "", deadline: "", assigned_to: "" });
      setShowAddForm(false);
      fetchAll();
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(goal, status) {
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status } : g)));
    try {
      const res = await fetch("/api/employee/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: goal.id, status }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to update goal.");
    } catch (err) {
      alert(err.message || "Failed to update goal.");
      fetchAll();
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this goal, including its micro-goals?")) return;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      const res = await fetch("/api/employee/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to delete goal.");
    } catch (err) {
      alert(err.message || "Failed to delete goal.");
      fetchAll();
    }
  }

  async function toggleItem(goal, item) {
    setGoals((prev) =>
      prev.map((g) =>
        g.id !== goal.id ? g : { ...g, items: g.items.map((i) => (i.id === item.id ? { ...i, done: !item.done } : i)) },
      ),
    );
    try {
      const res = await fetch("/api/employee/goals/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", goalId: goal.id, id: item.id, done: !item.done }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to update micro-goal.");
    } catch (err) {
      alert(err.message || "Failed to update micro-goal.");
      fetchAll();
    }
  }

  async function deleteItem(goal, item) {
    setGoals((prev) => prev.map((g) => (g.id !== goal.id ? g : { ...g, items: g.items.filter((i) => i.id !== item.id) })));
    try {
      const res = await fetch("/api/employee/goals/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", goalId: goal.id, id: item.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to remove micro-goal.");
    } catch (err) {
      alert(err.message || "Failed to remove micro-goal.");
      fetchAll();
    }
  }

  async function addItem(goal) {
    const title = (newItemDrafts[goal.id] || "").trim();
    if (!title) return;
    setNewItemDrafts((d) => ({ ...d, [goal.id]: "" }));
    try {
      const res = await fetch("/api/employee/goals/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", goalId: goal.id, title }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to add micro-goal.");
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, items: [...g.items, data.item] } : g)));
    } catch (err) {
      alert(err.message || "Failed to add micro-goal.");
    }
  }

  const grouped = useMemo(() => {
    const map = new Map(STATUS_ORDER.map((s) => [s, []]));
    for (const g of goals) {
      if (!map.has(g.status)) map.set(g.status, []);
      map.get(g.status).push(g);
    }
    return map;
  }, [goals]);

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
            <Link href="/employee/cold-calls" className="nav-link text-xs font-medium px-2" style={{ color: "var(--ink-soft)" }}>Cold calls</Link>
            <Link href="/employee/dashboard" className="text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:bg-white" style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}>
              ← My dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              Goals
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
              Shared team goals, with a status, a deadline, notes, and a checklist of micro-goals under each one.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-lg transition hover:opacity-90 self-start"
            style={{ background: "var(--forest)", color: "white" }}
          >
            <span className="text-base leading-none">+</span> New goal
          </button>
        </div>

        {error && (
          <div className="rounded-[14px] px-4 py-3 text-sm mb-6" style={{ background: "#fdf1f0", border: "1px solid #f4d4d2", color: "#e0554f" }}>
            {error}
          </div>
        )}

        {showAddForm && (
          <div className="rounded-[16px] p-5 mb-8" style={{ background: "white", border: "1px solid var(--border)" }}>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Goal title *</label>
                  <input
                    autoFocus
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="What are we trying to achieve?"
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Context, success criteria, links…"
                    rows={2}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition resize-none"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Owner</label>
                  <select
                    value={form.assigned_to}
                    onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  >
                    <option value="">Unassigned (whole team)</option>
                    {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Deadline</label>
                  <input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
              </div>

              {formError && (
                <p className="text-xs rounded-lg px-3 py-2" style={{ color: "#e0554f", background: "#fdf1f0", border: "1px solid #f4d4d2" }}>{formError}</p>
              )}

              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 hover:opacity-90" style={{ background: "var(--forest)", color: "white" }}>
                  {saving ? "Saving…" : "Create goal"}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-sm px-4 py-2 rounded-lg transition hover:bg-white" style={{ color: "var(--ink-soft)" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "4px solid var(--border)", borderTopColor: "var(--forest)" }} />
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-[16px] px-6 py-16 text-center" style={{ background: "white", border: "1px solid var(--border)" }}>
            <p className="text-sm" style={{ color: "var(--ink-faint)" }}>No goals yet - add the first one above.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {STATUS_ORDER.map((status) => {
              const items = grouped.get(status) || [];
              if (items.length === 0) return null;
              const meta = STATUS_META[status];
              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />
                    <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                      {meta.label} · {items.length}
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {items.map((goal) => {
                      const canEdit = goal.created_by === employee?.id || goal.assigned_to === employee?.id;
                      const canDelete = goal.created_by === employee?.id;
                      const ownerName = goal.assignee?.full_name || goal.assignee?.display_name;
                      const creatorName = goal.creator?.full_name || goal.creator?.display_name;
                      const overdue = isOverdue(goal.deadline, goal.status);
                      const doneItems = goal.items.filter((i) => i.done).length;

                      return (
                        <div key={goal.id} className="rounded-[16px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{goal.title}</p>
                              <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                                {ownerName ? `Owned by ${ownerName}` : "Whole team"} · added by {creatorName || "—"}
                                {goal.deadline && (
                                  <span style={{ color: overdue ? "#e0554f" : "var(--ink-faint)" }}>
                                    {" "}· {overdue ? "Overdue " : "Due "}{formatDate(goal.deadline)}
                                  </span>
                                )}
                              </p>
                              {goal.notes && <p className="text-xs mt-2" style={{ color: "var(--ink-soft)" }}>{goal.notes}</p>}
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <select
                                value={goal.status}
                                onChange={(e) => setStatus(goal, e.target.value)}
                                disabled={!canEdit}
                                className="text-[11px] font-semibold px-2.5 py-1.5 rounded-full disabled:opacity-60"
                                style={{ background: meta.bg, color: meta.color, border: "none" }}
                              >
                                {STATUS_ORDER.map((s) => (
                                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                                ))}
                              </select>
                              {canDelete && (
                                <button onClick={() => handleDelete(goal.id)} className="text-xs px-2 py-1 rounded-md transition" style={{ color: "#e0554f" }}>
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Micro-goals */}
                          <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ink-faint)" }}>
                                Micro-goals {goal.items.length > 0 ? `· ${doneItems}/${goal.items.length}` : ""}
                              </p>
                            </div>

                            {goal.items.length > 0 && (
                              <div className="space-y-1.5 mb-2">
                                {goal.items.map((item) => (
                                  <div key={item.id} className="flex items-center gap-2.5 group">
                                    <button
                                      onClick={() => canEdit && toggleItem(goal, item)}
                                      disabled={!canEdit}
                                      className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition disabled:cursor-not-allowed"
                                      style={item.done ? { background: "var(--forest)", border: "1.5px solid var(--forest)" } : { border: "1.5px solid var(--border)" }}
                                      aria-label={item.done ? "Mark not done" : "Mark done"}
                                    >
                                      {item.done && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </button>
                                    <span className="text-xs flex-1" style={{ color: item.done ? "var(--ink-faint)" : "var(--ink)", textDecoration: item.done ? "line-through" : "none" }}>
                                      {item.title}
                                    </span>
                                    {canEdit && (
                                      <button
                                        onClick={() => deleteItem(goal, item)}
                                        className="text-[11px] opacity-0 group-hover:opacity-100 transition"
                                        style={{ color: "#e0554f" }}
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {canEdit && (
                              <form
                                onSubmit={(e) => { e.preventDefault(); addItem(goal); }}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={newItemDrafts[goal.id] || ""}
                                  onChange={(e) => setNewItemDrafts((d) => ({ ...d, [goal.id]: e.target.value }))}
                                  placeholder="Add a micro-goal…"
                                  className="flex-1 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 transition"
                                  style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                                />
                                <button type="submit" className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition" style={{ color: "var(--forest)" }}>
                                  Add
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
