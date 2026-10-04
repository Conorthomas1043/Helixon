"use client";

// Part of the employee mobile app (EmployeeMobileApp.jsx).

import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { AMBER, ErrorNotice, GRAY, ICONS, Icon, RED, SectionTitle } from "./shared";

export const PRIORITY_DOT = { high: RED, medium: AMBER, low: GRAY };

// ── To-dos ───────────────────────────────────────────────────────────────

export function TodosTab() {
  const [ask, confirmDialog] = useConfirm();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/employee/todos", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not load to-dos.");
      setTodos(data.todos || []);
    } catch (err) {
      setError(err?.message || "Could not load to-dos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
    load();
  }, [load]);

  async function addTodo(e) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/employee/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", title }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not add task.");
      setTodos((current) => [data.todo, ...current]);
      setDraft("");
    } catch (err) {
      setError(err?.message || "Could not add task.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleTodo(todo) {
    setTodos((current) => current.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)));
    try {
      const res = await fetch("/api/employee/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "toggle", id: todo.id, done: !todo.done }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not update task.");
    } catch (err) {
      setTodos((current) => current.map((t) => (t.id === todo.id ? { ...t, done: todo.done } : t)));
      setError(err?.message || "Could not update task.");
    }
  }

  async function deleteTodo(todo) {
    if (!(await ask({ title: `Delete "${todo.title}"?`, confirmLabel: "Delete task", danger: true }))) return;
    const previous = todos;
    setTodos((current) => current.filter((t) => t.id !== todo.id));
    try {
      const res = await fetch("/api/employee/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", id: todo.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not delete task.");
    } catch (err) {
      setTodos(previous);
      setError(err?.message || "Could not delete task.");
    }
  }

  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done);

  return (
    <div>
      {confirmDialog}
      <SectionTitle>Add a task</SectionTitle>
      <form onSubmit={addTodo} className="flex gap-2 mb-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What needs doing?"
          className="flex-1 text-[14px] rounded-[10px] px-3 py-2.5"
          style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="w-11 h-11 flex items-center justify-center rounded-[10px] shrink-0"
          style={{ background: "var(--forest)", color: "white" }}
          aria-label="Add task"
        >
          <Icon path={ICONS.plus} size={18} />
        </button>
      </form>

      <ErrorNotice message={error} />

      <SectionTitle>Open ({open.length})</SectionTitle>
      {loading ? (
        <p className="text-[13px] text-center py-6" style={{ color: "var(--ink-faint)" }}>
          Loading…
        </p>
      ) : open.length === 0 ? (
        <p className="text-[13px] text-center py-6" style={{ color: "var(--ink-faint)" }}>
          Nothing open. Nice.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {open.map((todo) => (
            <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <SectionTitle>Done ({done.length})</SectionTitle>
          <div className="flex flex-col gap-2">
            {done.map((todo) => (
              <TodoRow key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TodoRow({ todo, onToggle, onDelete }) {
  return (
    <div
      className="flex items-center gap-3 px-3.5 py-3 rounded-[12px]"
      style={{ background: "white", border: "1px solid var(--border)" }}
    >
      <button
        type="button"
        onClick={() => onToggle(todo)}
        aria-label={todo.done ? "Mark as not done" : "Mark as done"}
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
        style={{
          border: `1.5px solid ${todo.done ? "var(--forest)" : "var(--border)"}`,
          background: todo.done ? "var(--forest)" : "transparent",
          color: "white",
        }}
      >
        {todo.done && <Icon path={ICONS.check} size={13} strokeWidth={3} />}
      </button>
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: PRIORITY_DOT[todo.priority] || GRAY }}
      />
      <div className="min-w-0 flex-1">
        <div
          className="text-[14px] font-medium truncate"
          style={{
            color: todo.done ? "var(--ink-faint)" : "var(--ink)",
            textDecoration: todo.done ? "line-through" : "none",
          }}
        >
          {todo.title}
        </div>
        {todo.due_date && (
          <div className="text-[12px]" style={{ color: "var(--ink-faint)" }}>
            Due {new Date(todo.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDelete(todo)}
        aria-label="Delete task"
        className="w-8 h-8 flex items-center justify-center rounded-[8px] shrink-0"
        style={{ color: "var(--ink-faint)" }}
      >
        <Icon path={ICONS.trash} size={15} />
      </button>
    </div>
  );
}
