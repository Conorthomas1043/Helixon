"use client";
// app/employee/dashboard/page.js
// Lower-privilege dashboard: personal to-do list + read-only platform stats.
// No access to: admin controls, security tab, traffic tab, agency management.

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const PRIORITY_META = {
  high:   { label: "High",   dot: "bg-red-500",    badge: "bg-red-950 text-red-300 border-red-800" },
  medium: { label: "Medium", dot: "bg-amber-400",  badge: "bg-amber-950 text-amber-300 border-amber-800" },
  low:    { label: "Low",    dot: "bg-slate-500",  badge: "bg-slate-800 text-slate-400 border-slate-700" },
};

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

export default function EmployeeDashboard() {
  const router = useRouter();
  const [employee, setEmployee] = useState(null);
  const [checking, setChecking] = useState(true);
  const [todos, setTodos] = useState([]);
  const [todosLoading, setTodosLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", notes: "", priority: "medium", due_date: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [filter, setFilter] = useState("all"); // all | active | done
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

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filteredTodos = todos.filter((t) => {
    if (filter === "active") return !t.done;
    if (filter === "done") return t.done;
    return true;
  });

  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);
  const overdueTodos = activeTodos.filter((t) => isOverdue(t.due_date));

  if (checking) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-emerald-500 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-emerald-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xs font-bold">H</span>
          </div>
          <span className="text-base font-bold text-white">Helixon</span>
          <span className="text-xs text-emerald-400 border border-emerald-800 bg-emerald-950 px-2 py-0.5 rounded-full font-medium">
            Employee
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" className="text-sm text-slate-400 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition">
            Back to app
          </a>
          <button
            onClick={handleLogout}
            className="text-sm bg-red-950 border border-red-900 text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-900 transition"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Your tasks and platform overview</p>
        </div>

        {/* Summary chips */}
        <div className="flex gap-3 flex-wrap mb-8">
          {[
            { label: "Active tasks", value: activeTodos.length, color: "text-white" },
            { label: "Completed", value: doneTodos.length, color: "text-emerald-400" },
            { label: "Overdue", value: overdueTodos.length, color: overdueTodos.length > 0 ? "text-red-400" : "text-slate-500" },
          ].map((s) => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 flex items-center gap-3">
              <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-slate-500">{s.label}</span>
            </div>
          ))}
          {stats && (
            <>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 flex items-center gap-3">
                <span className="text-xl font-bold text-slate-300">{stats.totalCandidates}</span>
                <span className="text-xs text-slate-500">Platform candidates</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 flex items-center gap-3">
                <span className="text-xl font-bold text-slate-300">{stats.avgScore}</span>
                <span className="text-xs text-slate-500">Avg match score</span>
              </div>
            </>
          )}
        </div>

        {/* To-do panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

          {/* Panel header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white">My Tasks</h2>
              {todosLoading && (
                <div className="w-4 h-4 rounded-full border-2 border-slate-700 border-t-emerald-500 animate-spin" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Filter pills */}
              <div className="flex bg-slate-800 rounded-lg p-0.5 gap-0.5">
                {["all", "active", "done"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-xs px-3 py-1 rounded-md font-medium capitalize transition ${
                      filter === f ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                onClick={openAdd}
                className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <span className="text-base leading-none">+</span> Add task
              </button>
            </div>
          </div>

          {/* Add / Edit form */}
          {showAddForm && (
            <div className="border-b border-slate-800 px-6 py-5 bg-slate-950">
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Task title *</label>
                    <input
                      autoFocus
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="What needs doing?"
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Notes</label>
                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Optional details…"
                      rows={2}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Priority</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Due date</label>
                    <input
                      type="date"
                      value={form.due_date}
                      onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {formError && (
                  <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">{formError}</p>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                  >
                    {saving ? "Saving…" : editingId ? "Save changes" : "Add task"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-sm text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Todo list */}
          <div className="divide-y divide-slate-800/50">
            {filteredTodos.length === 0 && (
              <div className="px-6 py-12 text-center">
                <p className="text-slate-500 text-sm">
                  {filter === "done" ? "No completed tasks yet." : "No tasks yet - add one above."}
                </p>
              </div>
            )}

            {filteredTodos.map((todo) => {
              const pm = PRIORITY_META[todo.priority] || PRIORITY_META.medium;
              const overdue = isOverdue(todo.due_date) && !todo.done;
              const dueSoon = isDueSoon(todo.due_date) && !todo.done;

              return (
                <div
                  key={todo.id}
                  className={`px-6 py-4 flex items-start gap-4 group transition ${
                    todo.done ? "opacity-50" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleDone(todo)}
                    className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition ${
                      todo.done
                        ? "bg-emerald-600 border-emerald-600"
                        : "border-slate-600 hover:border-emerald-500"
                    }`}
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
                      <p className={`text-sm font-medium ${todo.done ? "line-through text-slate-500" : "text-white"}`}>
                        {todo.title}
                      </p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${pm.badge}`}>
                        {pm.label}
                      </span>
                    </div>

                    {todo.notes && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{todo.notes}</p>
                    )}

                    {todo.due_date && (
                      <p className={`text-xs mt-1 font-medium ${
                        overdue ? "text-red-400" : dueSoon ? "text-amber-400" : "text-slate-500"
                      }`}>
                        {overdue ? "Overdue · " : dueSoon ? "Due soon · " : "Due "}
                        {formatDate(todo.due_date)}
                      </p>
                    )}
                  </div>

                  {/* Actions (visible on hover) */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                    <button
                      onClick={() => openEdit(todo)}
                      className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-md hover:bg-slate-800 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(todo.id)}
                      className="text-xs text-red-500 hover:text-red-300 px-2 py-1 rounded-md hover:bg-red-950 transition"
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
            <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between">
              <p className="text-xs text-slate-600">
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
                  className="text-xs text-slate-500 hover:text-red-400 transition"
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