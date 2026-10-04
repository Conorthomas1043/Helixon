"use client";
// app/employee/dashboard/team-tasks-panel.js
// Team-visible task list: every active employee sees every task here.
// Only the creator or assignee can edit/complete a task; only the creator
// can delete it (enforced server-side in lib/employee-shared-todos.js -
// this component just doesn't render controls the API would reject).

import { useConfirm } from "@/components/dashboard/use-confirm";
import { useEffect, useMemo, useState } from "react";
import { relativeDayLabel, dayKey, toDayKey } from "@/lib/employee-day";
import { Card } from "../_shared/ui";

const PRIORITY_DOT = { high: "#c0392b", medium: "#b45309", low: "#8a9a92" };

export default function TeamTasksPanel({ currentEmployeeId, notify }) {
  const [ask, confirmDialog] = useConfirm();
  // Errors go to the page's toasts when it has them, else a plain alert.
  const report = (message) => (notify ? notify(message, { tone: "error" }) : alert(message));
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
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
    try {
      const res = await fetch("/api/employee/shared-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", id: todo.id, done: !todo.done }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to update task.");
    } catch (err) {
      report(err.message || "Failed to update task. Please try again.");
      fetchAll();
    }
  }

  async function handleDelete(id) {
    if (!(await ask({ title: "Delete this team task?", confirmLabel: "Delete task", danger: true }))) return;
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch("/api/employee/shared-todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to delete task.");
    } catch (err) {
      report(err.message || "Failed to delete task. Please try again.");
      fetchAll();
    }
  }

  const visible = useMemo(() => {
    let list = todos;
    if (onlyMine) {
      list = list.filter((t) => t.created_by === currentEmployeeId || t.assigned_to === currentEmployeeId);
    }
    return list;
  }, [todos, onlyMine, currentEmployeeId]);

  return (
    <Card className="overflow-hidden" aria-labelledby="team-tasks-title">
      {confirmDialog}
      <div
        className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="flex items-center gap-2">
          <h2 id="team-tasks-title" className="text-[15px] font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Shared with the team
          </h2>
          {loading && (
            <div className="w-3.5 h-3.5 rounded-full animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--forest)" }} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyMine((v) => !v)}
            aria-pressed={onlyMine}
            className="text-sm px-3 py-1.5 rounded-[10px] font-medium transition"
            style={onlyMine ? { background: "var(--mint)", color: "var(--forest)", border: "1px solid var(--forest)" } : { border: "1px solid var(--border)", color: "var(--ink-soft)" }}
          >
            {onlyMine ? "Only mine" : "Everyone's"}
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            aria-expanded={showAddForm}
            className="flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-[10px] transition hover:opacity-90"
            style={{ background: "var(--forest)", color: "white" }}
          >
            <span className="text-base leading-none" aria-hidden="true">+</span> Add team task
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="border-b px-5 py-5" style={{ borderColor: "var(--border-soft)", background: "var(--mist)" }}>
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
              <p role="alert" className="text-xs rounded-lg px-3 py-2" style={{ color: "#a83226", background: "#fbefed", border: "1px solid #f2d2cd" }}>
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

      <ul className="divide-y divide-[var(--border-soft)]">
        {visible.length === 0 && (
          <li className="px-5 py-12 text-center">
            <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
              {onlyMine ? "No tasks assigned to or created by you." : "No team tasks yet - add one above."}
            </p>
          </li>
        )}

        {visible.map((todo) => {
          const canEdit = todo.created_by === currentEmployeeId || todo.assigned_to === currentEmployeeId;
          const canDelete = todo.created_by === currentEmployeeId;
          const assigneeName = todo.assignee?.full_name || todo.assignee?.display_name;
          const creatorName = todo.creator?.full_name || todo.creator?.display_name;

          return (
            <li key={todo.id} className="px-5 py-3 flex items-start gap-3 group transition hover:bg-[#fafcfb]">
              <button
                type="button"
                role="checkbox"
                aria-checked={!!todo.done}
                onClick={() => canEdit && toggleDone(todo)}
                disabled={!canEdit}
                className="w-9 h-9 -m-2 mt-[-6px] flex items-center justify-center shrink-0 rounded-full disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
                aria-label={`${todo.done ? "Mark not done" : "Mark done"}: ${todo.title}`}
                title={canEdit ? undefined : "Only the creator or assignee can update this"}
              >
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={todo.done ? { background: "var(--forest)", border: "2px solid var(--forest)" } : { border: `2px solid ${canEdit ? "#b9c7c0" : "var(--border)"}`, background: canEdit ? "white" : "var(--mist)" }}
                >
                  {todo.done && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-snug ${todo.done ? "line-through" : ""}`} style={{ color: todo.done ? "var(--ink-faint)" : "var(--ink)" }}>
                  {todo.title}
                </p>
                {todo.notes && !todo.done && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--ink-soft)" }}>{todo.notes}</p>}
                <p className="text-xs mt-1 flex flex-wrap items-center gap-x-1.5" style={{ color: "var(--ink-faint)" }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: PRIORITY_DOT[todo.priority] || PRIORITY_DOT.medium }} aria-hidden="true" />
                  <span>{assigneeName ? (todo.assigned_to === currentEmployeeId ? "Assigned to you" : `Assigned to ${assigneeName}`) : "Unassigned"}</span>
                  {creatorName && <span>· added by {todo.created_by === currentEmployeeId ? "you" : creatorName}</span>}
                  {todo.due_date && <span>· {toDayKey(todo.due_date) < dayKey() && !todo.done ? "was due" : "due"} {relativeDayLabel(toDayKey(todo.due_date)).toLowerCase()}</span>}
                </p>
              </div>

              {canDelete && (
                <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition shrink-0">
                  <button type="button" onClick={() => handleDelete(todo.id)} className="text-xs font-medium px-2 py-1.5 rounded-[8px] transition hover:bg-red-50" style={{ color: "#a83226" }}>
                    Delete
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
