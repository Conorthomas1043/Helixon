"use client";
// app/employee/dashboard/page.js
// Lower-privilege dashboard: personal to-do list + read-only platform stats.
// No access to: admin controls, security tab, traffic tab, agency management.

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const PRIORITY_META = {
  high: { label: "High", dot: "#e0554f", badge: "text-rose-700 border-rose-200", badgeBg: "#fdf1f0" },
  medium: { label: "Medium", dot: "#d99a3a", badge: "text-amber-700 border-amber-200", badgeBg: "#fdf5e9" },
  low: { label: "Low", dot: "#94a3b8", badge: "text-slate-600 border-slate-200", badgeBg: "#f4f4f5" },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function isDueSoon(dueDate) {
  if (!dueDate) return false;
  const diff = new Date(dueDate) - new Date();
  return diff > 0 && diff < 48 * 60 * 60 * 1000;
}

function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function EmployeeDashboard() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [todos, setTodos] = useState([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", notes: "", priority: "medium", due_date: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [filter, setFilter] = useState("all"); // all | active | done
  const [sortBy, setSortBy] = useState("priority"); // priority | due | newest
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState(null);

  // ── Session check ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        // Probe the todos endpoint to verify session
        const res = await fetch("/api/employee/todos");
        if (!res.ok) { router.replace("/employee/login"); return; }
        const data = await res.json();
        if (!data.ok) { router.replace("/employee/login"); return; }
        setTodos(data.todos);
      } catch {
        router.replace("/employee/login");
      } finally {
        setChecking(false);
      }
    })();
  }, [router]);

  // ── Fetch read-only platform stats (subset of admin stats) ────────────────
  useEffect(() => {
    fetch("/api/employee/stats")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setStats(d.stats); })
      .catch(() => {});
  }, []);

  // ── Todos CRUD ────────────────────────────────────────────────────────────

  async function fetchTodos() {
    setTodosLoading(true);
    try {
      const res = await fetch("/api/employee/todos");
      const data = await res.json();
      if (data.ok) setTodos(data.todos);
    } finally {
      setTodosLoading(false);
    }
  }

  function openAdd() {
    setForm({ title: "", notes: "", priority: "medium", due_date: "" });
    setFormError("");
    setEditingId(null);
    setShowAddForm(true);
  }

  function openEdit(todo) {
    setForm({
      title: todo.title,
      notes: todo.notes || "",
      priority: todo.priority || "medium",
      due_date: todo.due_date || "",
    });
    setFormError("");
    setEditingId(todo.id);
    setShowAddForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const action = editingId ? "update" : "create";
      const body = { action, ...form };
      if (editingId) body.id = editingId;
      const res = await fetch("/api/employee/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.ok) { setFormError(data.error || "Failed to save."); return; }
      setShowAddForm(false);
      fetchTodos();
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(todo) {
    // Optimistic update
    setTodos((prev) => prev.map((t) => t.id === todo.id ? { ...t, done: !todo.done } : t));
    await fetch("/api/employee/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id: todo.id, done: !todo.done }),
    });
  }

  async function handleDelete(id) {
    if (!confirm("Delete this task?")) return;
    setTodos((prev) => prev.filter((t) => t.id !== id));
    await fetch("/api/employee/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
  }

  async function handleLogout() {
    await fetch("/api/employee/logout", { method: "POST" });
    router.replace("/employee/login");
  }

  // ── Filtering / sorting / search ─────────────────────────────────────────
  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);
  const overdueTodos = activeTodos.filter((t) => isOverdue(t.due_date));
  const dueSoonTodos = activeTodos.filter((t) => isDueSoon(t.due_date));

  const priorityCounts = useMemo(() => ({
    high: activeTodos.filter((t) => (t.priority || "medium") === "high").length,
    medium: activeTodos.filter((t) => (t.priority || "medium") === "medium").length,
    low: activeTodos.filter((t) => (t.priority || "medium") === "low").length,
  }), [activeTodos]);

  const visibleTodos = useMemo(() => {
    let list = todos.filter((t) => {
      if (filter === "active" && t.done) return false;
      if (filter === "done" && !t.done) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hay = `${t.title} ${t.notes || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "priority") {
        return (PRIORITY_ORDER[a.priority || "medium"] ?? 1) - (PRIORITY_ORDER[b.priority || "medium"] ?? 1);
      }
      if (sortBy === "due") {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      }
      return 0; // newest = API order
    });

    return list;
  }, [todos, filter, query, sortBy]);

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--mist)" }}>
        <div
          className="w-8 h-8 rounded-full animate-spin"
          style={{ border: "4px solid var(--border)", borderTopColor: "var(--forest)" }}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur border-b"
        style={{ borderColor: "var(--border)" }}
        aria-label="Main"
      >
        <div className="max-w-[1100px] mx-auto px-6 h-[56px] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group" aria-label="Helixon home">
            <div
              className="w-8 h-8 rounded-[9px] flex items-center justify-center relative overflow-hidden transition-transform group-hover:scale-105"
              style={{ background: "var(--forest)" }}
            >
              <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="9" width="12" height="4.5" rx="2.25" fill="white" opacity="0.55" />
                <rect x="12" y="15.5" width="12" height="4.5" rx="2.25" fill="white" />
                <circle cx="22.5" cy="10.5" r="1.8" fill="var(--signal)" />
              </svg>
            </div>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Helixon
              </span>
              <span className="hidden sm:block text-[9px] font-medium mt-0.5" style={{ color: "var(--ink-faint)" }}>
                Employee portal
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <span
              className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "var(--mint)", color: "var(--forest)" }}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M4 6l1.5 1.5L8 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              Dashboard
            </span>
            <a href="/" className="nav-link text-xs font-medium px-2" style={{ color: "var(--ink-soft)" }}>
              Back to app
            </a>
            <button
              onClick={handleLogout}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:bg-white"
              style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tight"
            style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}
          >
            {getGreeting()}
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
            Here's your task list and a quick read of the platform.
          </p>
        </div>

        {/* ── Attention banner ──────────────────────────────────────────── */}
        {(overdueTodos.length > 0 || dueSoonTodos.length > 0) && (
          <div
            className="flex items-center gap-3 rounded-[14px] px-4 py-3 mb-6"
            style={{
              background: overdueTodos.length > 0 ? "#fdf1f0" : "var(--mint)",
              border: `1px solid ${overdueTodos.length > 0 ? "#f4d4d2" : "var(--border)"}`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: overdueTodos.length > 0 ? "#e0554f" : "var(--forest)" }}
            />
            <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>
              {overdueTodos.length > 0
                ? `${overdueTodos.length} task${overdueTodos.length === 1 ? "" : "s"} overdue`
                : `${dueSoonTodos.length} task${dueSoonTodos.length === 1 ? "" : "s"} due within 48 hours`}
              {overdueTodos.length > 0 && dueSoonTodos.length > 0 && ` · ${dueSoonTodos.length} due soon`}
            </p>
          </div>
        )}

        {/* ── Summary cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: "Active tasks", value: activeTodos.length },
            { label: "Completed", value: doneTodos.length },
            { label: "Overdue", value: overdueTodos.length, warn: overdueTodos.length > 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-[14px] p-4" style={{ background: "white", border: "1px solid var(--border)" }}>
              <p
                className="text-xl font-semibold"
                style={{ color: s.warn ? "#e0554f" : "var(--ink)", fontFamily: "var(--font-display)" }}
              >
                {s.value}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{s.label}</p>
            </div>
          ))}
          {stats && [
            { label: "Total users", value: stats.totalUsers },
            { label: "Active today", value: stats.activeToday },
            { label: "Uptime", value: `${stats.uptimePct}%` },
            { label: "Open tickets", value: stats.openTickets },
          ].map((s) => (
            <div key={s.label} className="rounded-[14px] p-4" style={{ background: "white", border: "1px solid var(--border)" }}>
              <p className="text-xl font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Priority breakdown ────────────────────────────────────────── */}
        {activeTodos.length > 0 && (
          <div className="rounded-[14px] p-4 mb-8" style={{ background: "white", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-xs font-semibold" style={{ color: "var(--ink)" }}>Active tasks by priority</p>
              <p className="text-[11px]" style={{ color: "var(--ink-faint)" }}>{activeTodos.length} total</p>
            </div>
            <div className="flex w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--mist)" }}>
              {["high", "medium", "low"].map((p) => {
                const pct = activeTodos.length ? (priorityCounts[p] / activeTodos.length) * 100 : 0;
                if (pct === 0) return null;
                return <div key={p} style={{ width: `${pct}%`, background: PRIORITY_META[p].dot }} />;
              })}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
              {["high", "medium", "low"].map((p) => (
                <span key={p} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--ink-soft)" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_META[p].dot }} />
                  {PRIORITY_META[p].label} · {priorityCounts[p]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── To-do panel ───────────────────────────────────────────────── */}
        <div className="rounded-[16px] overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }}>

          {/* Panel header */}
          <div
            className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                My Tasks
              </h2>
              {todosLoading && (
                <div
                  className="w-3.5 h-3.5 rounded-full animate-spin"
                  style={{ border: "2px solid var(--border)", borderTopColor: "var(--forest)" }}
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tasks…"
                className="text-xs rounded-lg px-3 py-1.5 w-36 sm:w-44 focus:outline-none focus:ring-2 transition"
                style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
              />

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 transition"
                style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }}
              >
                <option value="priority">Sort: Priority</option>
                <option value="due">Sort: Due date</option>
                <option value="newest">Sort: Newest</option>
              </select>

              {/* Filter pills */}
              <div className="flex rounded-lg p-0.5 gap-0.5" style={{ background: "var(--mist)" }}>
                {["all", "active", "done"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="text-xs px-3 py-1 rounded-md font-medium capitalize transition"
                    style={filter === f
                      ? { background: "var(--forest)", color: "white" }
                      : { color: "var(--ink-soft)" }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-90"
                style={{ background: "var(--forest)", color: "white" }}
              >
                <span className="text-base leading-none">+</span> Add task
              </button>
            </div>
          </div>

          {/* Add / Edit form */}
          {showAddForm && (
            <div className="border-b px-6 py-5" style={{ borderColor: "var(--border)", background: "var(--mist)" }}>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Task title *</label>
                    <input
                      autoFocus
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="What needs doing?"
                      className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                      style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Optional details…"
                      rows={2}
                      className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition resize-none"
                      style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                      className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                      style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Due date</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                      className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                      style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                    />
                  </div>
                </div>

                {formError && (
                  <p className="text-xs rounded-lg px-3 py-2" style={{ color: "#e0554f", background: "#fdf1f0", border: "1px solid #f4d4d2" }}>
                    {formError}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 hover:opacity-90"
                    style={{ background: "var(--forest)", color: "white" }}
                  >
                    {saving ? "Saving…" : editingId ? "Save changes" : "Add task"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-sm px-4 py-2 rounded-lg transition hover:bg-white"
                    style={{ color: "var(--ink-soft)" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Todo list */}
          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {visibleTodos.length === 0 && (
              <div className="px-6 py-14 text-center">
                <div
                  className="w-11 h-11 rounded-[12px] flex items-center justify-center mx-auto mb-3"
                  style={{ background: "var(--mint)" }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
                  {query.trim()
                    ? "No tasks match your search."
                    : filter === "done" ? "No completed tasks yet." : "No tasks yet — add one above."}
                </p>
              </div>
            )}

            {visibleTodos.map((todo) => {
              const pm = PRIORITY_META[todo.priority] || PRIORITY_META.medium;
              const overdue = isOverdue(todo.due_date) && !todo.done;
              const dueSoon = isDueSoon(todo.due_date) && !todo.done;

              return (
                <div
                  key={todo.id}
                  className={`px-6 py-4 flex items-start gap-4 group transition ${todo.done ? "opacity-50" : ""}`}
                >
                  {/* Priority dot */}
                  <span className="mt-2.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: pm.dot }} />

                  {/* Checkbox */}
                  <button
                    onClick={() => toggleDone(todo)}
                    className="mt-0.5 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition"
                    style={todo.done
                      ? { background: "var(--forest)", border: "2px solid var(--forest)" }
                      : { border: "2px solid var(--border)" }}
                    aria-label={todo.done ? "Mark incomplete" : "Mark complete"}
                  >
                    {todo.done && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p
                        className={`text-sm font-medium ${todo.done ? "line-through" : ""}`}
                        style={{ color: todo.done ? "var(--ink-faint)" : "var(--ink)" }}
                      >
                        {todo.title}
                      </p>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${pm.badge}`}
                        style={{ background: pm.badgeBg }}
                      >
                        {pm.label}
                      </span>
                    </div>

                    {todo.notes && (
                      <p className="text-xs mt-1 truncate" style={{ color: "var(--ink-faint)" }}>{todo.notes}</p>
                    )}

                    {todo.due_date && (
                      <p
                        className="text-xs mt-1 font-medium"
                        style={{ color: overdue ? "#e0554f" : dueSoon ? "#d99a3a" : "var(--ink-faint)" }}
                      >
                        {overdue ? "Overdue · " : dueSoon ? "Due soon · " : "Due "}
                        {formatDate(todo.due_date)}
                      </p>
                    )}
                  </div>

                  {/* Actions (visible on hover) */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      onClick={() => openEdit(todo)}
                      className="text-xs px-2 py-1 rounded-md transition hover:bg-white"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(todo.id)}
                      className="text-xs px-2 py-1 rounded-md transition"
                      style={{ color: "#e0554f" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {todos.length > 0 && (
            <div className="px-6 py-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                {activeTodos.length} active · {doneTodos.length} completed
              </p>
              {doneTodos.length > 0 && (
                <button
                  onClick={async () => {
                    if (!confirm("Clear all completed tasks?")) return;
                    const ids = doneTodos.map((t) => t.id);
                    await Promise.all(ids.map((id) =>
                      fetch("/api/employee/todos", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "delete", id }),
                      })
                    ));
                    fetchTodos();
                  }}
                  className="text-xs transition"
                  style={{ color: "var(--ink-faint)" }}
                >
                  Clear completed
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}