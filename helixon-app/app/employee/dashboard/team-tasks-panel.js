"use client";
// app/employee/dashboard/team-tasks-panel.js
// Team-visible task list: every active employee sees every task here.
// Only the creator or assignee can edit/complete a task; only the creator
// can delete it (enforced server-side in lib/employee-shared-todos.js —
// this component just doesn't render controls the API would reject).

import { useEffect, useMemo, useState } from "react";

const PRIORITY_DOT = { high: "#e0554f", medium: "#d99a3a", low: "#94a3b8" };

function formatDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function TeamTasksPanel({ currentEmployeeId }) {
  const [todos, setTodos] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ title: "", notes: "", priority: "medium", due_date: "", assigned_to: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);

  async function fetchAll() {
    setLoading(true);
    try {
      const [todosRes, teamRes] = await Promise.all([
        fetch("/api/employee/shared-todos"),
        fetch("/api/employee/team"),
      ]);
      const todosData = await todosRes.json();
      const teamData = await teamRes.json();
      if (todosData.ok) setTodos(todosData.todos);
      if (teamData.ok) setTeam(teamData.team);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/employee/shared-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...form, assigned_to: form.assigned_to || null }),
      });
      const data = await res.json();
      if (!data.ok) { setFormError(data.error || "Failed to save."); return; }
      setForm({ title: "", notes: "", priority: "medium", due_date: "", assigned_to: "" });
      setShowAddForm(false);
      fetchAll();
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(todo) {
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, done: !todo.done } : t)));
    await fetch("/api/employee/shared-todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id: todo.id, done: !todo.done }),
    });
  }

  async function handleDelete(id) {
    if (!confirm("Delete this team task?")) return;
    setTodos((prev) => prev.filter((t) => t.id !== id));
    await fetch("/api/employee/shared-todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
  }

  const visible = useMemo(() => {
    let list = todos;
    if (onlyMine) {
      list = list.filter((t) => t.created_by === currentEmployeeId || t.assigned_to === currentEmployeeId);
    }
    return list;
  }, [todos, onlyMine, currentEmployeeId]);

  return (
    <div className="rounded-[16px] overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }}>
      <div
        className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Team Tasks
          </h2>
          {loading && (
            <div className="w-3.5 h-3.5 rounded-full animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--forest)" }} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setOnlyMine((v) => !v)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition"
            style={onlyMine ? { background: "var(--forest)", color: "white" } : { border: "1px solid var(--border)", color: "var(--ink-soft)" }}
          >
            {onlyMine ? "Showing: mine" : "Showing: everyone's"}
          </button>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition hover:opacity-90"
            style={{ background: "var(--forest)", color: "white" }}
          >
            <span className="text-base leading-none">+</span> Add team task
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="border-b px-6 py-5" style={{ borderColor: "var(--border)", background: "var(--mist)" }}>
          <form onSubmit={handleAdd} className="space-y-4">
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
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Assign to</label>
                <select
                  value={form.assigned_to}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                  style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                >
                  <option value="">Unassigned (team)</option>
                  {team.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
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
              <div className="sm:col-span-2">
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
                {saving ? "Saving…" : "Add task"}
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

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {visible.length === 0 && (
          <div className="px-6 py-14 text-center">
            <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
              {onlyMine ? "No tasks assigned to or created by you." : "No team tasks yet — add one above."}
            </p>
          </div>
        )}

        {visible.map((todo) => {
          const canEdit = todo.created_by === currentEmployeeId || todo.assigned_to === currentEmployeeId;
          const canDelete = todo.created_by === currentEmployeeId;
          const assigneeName = todo.assignee?.full_name || todo.assignee?.display_name;
          const creatorName = todo.creator?.full_name || todo.creator?.display_name;

          return (
            <div key={todo.id} className={`px-6 py-4 flex items-start gap-4 group transition ${todo.done ? "opacity-50" : ""}`}>
              <span className="mt-2.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: PRIORITY_DOT[todo.priority] || PRIORITY_DOT.medium }} />

              <button
                onClick={() => canEdit && toggleDone(todo)}
                disabled={!canEdit}
                className="mt-0.5 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition disabled:cursor-not-allowed"
                style={todo.done ? { background: "var(--forest)", border: "2px solid var(--forest)" } : { border: "2px solid var(--border)" }}
                aria-label={todo.done ? "Mark incomplete" : "Mark complete"}
                title={canEdit ? undefined : "Only the creator or assignee can update this"}
              >
                {todo.done && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${todo.done ? "line-through" : ""}`} style={{ color: todo.done ? "var(--ink-faint)" : "var(--ink)" }}>
                  {todo.title}
                </p>
                {todo.notes && <p className="text-xs mt-1 truncate" style={{ color: "var(--ink-faint)" }}>{todo.notes}</p>}
                <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
                  {assigneeName ? `Assigned to ${assigneeName}` : "Unassigned"}
                  {creatorName ? ` · added by ${creatorName}` : ""}
                  {todo.due_date ? ` · due ${formatDate(todo.due_date)}` : ""}
                </p>
              </div>

              {canDelete && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button onClick={() => handleDelete(todo.id)} className="text-xs px-2 py-1 rounded-md transition" style={{ color: "#e0554f" }}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
