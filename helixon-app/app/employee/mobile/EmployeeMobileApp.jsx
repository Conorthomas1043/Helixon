"use client";

import { useCallback, useEffect, useState } from "react";

const RED = "#e0554f";
const AMBER = "#d99a3a";
const GRAY = "#94a3b8";

const PRIORITY_DOT = { high: RED, medium: AMBER, low: GRAY };

function Icon({ path, size = 18, strokeWidth = 2, className = "", ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {path}
    </svg>
  );
}

const ICONS = {
  todo: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9M13 17V5M8 17v-4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>
  ),
};

const TABS = [
  { id: "todos", label: "To-dos", icon: "todo" },
  { id: "stats", label: "Stats", icon: "chart" },
];

export default function EmployeeMobileApp({ employee }) {
  const [tab, setTab] = useState("todos");

  async function signOut() {
    try {
      await fetch("/api/employee/logout", { method: "POST" });
    } catch {
      // cookie will expire on its own if this fails
    }
    window.location.href = "/employee/login";
  }

  return (
    <div style={{ background: "var(--mist)", minHeight: "100dvh" }}>
      <header
        className="flex items-center justify-between px-4"
        style={{
          height: 52,
          paddingTop: "env(safe-area-inset-top)",
          background: "white",
          borderBottom: "1px solid var(--border)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] flex items-center justify-center" style={{ background: "var(--forest)" }}>
            <span className="text-white text-[11px] font-bold">H</span>
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-semibold" style={{ color: "var(--ink)" }}>
              Staff
            </div>
            <div className="text-[10px]" style={{ color: "var(--ink-faint)" }}>
              {employee?.display_name || employee?.full_name || employee?.username}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="w-9 h-9 flex items-center justify-center rounded-[10px]"
          style={{ color: "var(--ink-soft)" }}
        >
          <Icon path={ICONS.logout} size={18} />
        </button>
      </header>

      <main className="px-4 pt-4" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}>
        {tab === "todos" && <TodosTab />}
        {tab === "stats" && <StatsTab />}
      </main>

      <nav
        className="flex items-stretch"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: "white",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
          zIndex: 20,
        }}
        aria-label="Sections"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5"
              style={{ color: active ? "var(--forest)" : "var(--ink-faint)" }}
              aria-current={active ? "page" : undefined}
            >
              <Icon path={ICONS[t.icon]} size={20} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wide mb-2.5 mt-5 first:mt-0" style={{ color: "var(--ink-faint)" }}>
      {children}
    </h2>
  );
}

function ErrorNotice({ message }) {
  if (!message) return null;
  return (
    <div className="text-[12px] rounded-[10px] px-3 py-2.5 mb-3" style={{ background: "#fdf1f0", color: RED, border: "1px solid #f6d6d3" }}>
      {message}
    </div>
  );
}

// ── To-dos ───────────────────────────────────────────────────────────────

function TodosTab() {
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
    if (!window.confirm(`Delete "${todo.title}"?`)) return;
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
      <SectionTitle>Add a task</SectionTitle>
      <form onSubmit={addTodo} className="flex gap-2 mb-1">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What needs doing?"
          className="flex-1 text-[13px] rounded-[10px] px-3 py-2.5"
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
        <p className="text-[12px] text-center py-6" style={{ color: "var(--ink-faint)" }}>
          Loading…
        </p>
      ) : open.length === 0 ? (
        <p className="text-[12px] text-center py-6" style={{ color: "var(--ink-faint)" }}>
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

function TodoRow({ todo, onToggle, onDelete }) {
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
          className="text-[13px] font-medium truncate"
          style={{
            color: todo.done ? "var(--ink-faint)" : "var(--ink)",
            textDecoration: todo.done ? "line-through" : "none",
          }}
        >
          {todo.title}
        </div>
        {todo.due_date && (
          <div className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
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

// ── Stats ────────────────────────────────────────────────────────────────

function Kpi({ label, value }) {
  return (
    <div className="rounded-[14px] p-3.5" style={{ background: "white", border: "1px solid var(--border)" }}>
      <div className="text-[10px] font-medium mb-1" style={{ color: "var(--ink-faint)" }}>
        {label}
      </div>
      <div className="text-xl font-semibold tabular-nums" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
        {value}
      </div>
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/employee/stats", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not load stats.");
      setStats(data.stats);
    } catch (err) {
      setError(err?.message || "Could not load stats.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <SectionTitle>Platform snapshot, today</SectionTitle>
      <ErrorNotice message={error} />
      {loading && !stats ? (
        <p className="text-[12px] text-center py-6" style={{ color: "var(--ink-faint)" }}>
          Loading…
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <Kpi label="Total customers" value={stats?.totalUsers ?? "-"} />
          <Kpi label="Site views" value={stats?.siteViewsToday ?? "-"} />
          <Kpi label="Unique visitors" value={stats?.uniqueVisitorsToday ?? "-"} />
          <Kpi label="Blocked requests" value={stats?.blockedToday ?? "-"} />
        </div>
      )}
      <button
        type="button"
        onClick={load}
        className="mt-4 w-full flex items-center justify-center gap-1.5 text-[12px] font-medium py-2.5 rounded-[10px]"
        style={{ color: "var(--ink-soft)", border: "1px solid var(--border)" }}
      >
        <Icon path={ICONS.refresh} size={14} />
        Refresh
      </button>
    </div>
  );
}
