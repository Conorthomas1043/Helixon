"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useHeartbeat } from "../_shared/useHeartbeat";

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
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  chevronRight: <path d="M9 18l6-6-6-6" />,
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />,
};

const TABS = [
  { id: "todos", label: "To-dos", icon: "todo" },
  { id: "calendar", label: "Calendar", icon: "calendar" },
  { id: "calls", label: "Calls", icon: "phone" },
  { id: "stats", label: "Stats", icon: "chart" },
];

function formatDayHeading(iso) {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.setHours(0, 0, 0, 0) - today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatEventTime(iso, allDay) {
  if (allDay) return "All day";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EmployeeMobileApp({ employee }) {
  const [tab, setTab] = useState("todos");
  useHeartbeat();

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
        <div className="flex items-center gap-1">
          <Link
            href="/employee/settings"
            aria-label="Account settings"
            className="w-9 h-9 flex items-center justify-center rounded-[10px]"
            style={{ color: "var(--ink-soft)" }}
          >
            <Icon path={ICONS.settings} size={18} />
          </Link>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="w-9 h-9 flex items-center justify-center rounded-[10px]"
            style={{ color: "var(--ink-soft)" }}
          >
            <Icon path={ICONS.logout} size={18} />
          </button>
        </div>
      </header>

      <main className="px-4 pt-4" style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}>
        {tab === "todos" && <TodosTab />}
        {tab === "calendar" && <CalendarTab employee={employee} />}
        {tab === "calls" && <CallsTab employee={employee} />}
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

// ── Calendar ─────────────────────────────────────────────────────────────
// Same data/API as app/employee/calendar (the desktop page) - agenda view
// plus quick add/delete. Feed-URL subscribe and Google Calendar connect are
// left to the desktop page (linked out below) since that's a one-time setup
// step, not something worth re-building in this compact shell.

function CalendarTab({ employee }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ title: "", start_at: "", end_at: "", all_day: false });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const res = await fetch(`/api/employee/calendar?from=${from.toISOString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not load the calendar.");
      setEvents(data.events || []);
    } catch (err) {
      setError(err?.message || "Could not load the calendar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    setForm({ title: "", start_at: toLocalInputValue(now), end_at: toLocalInputValue(end), all_day: false });
    setFormError("");
    setShowAddForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    if (!form.start_at) { setFormError("Start is required."); return; }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        action: "create",
        title: form.title,
        all_day: form.all_day,
        start_at: form.all_day ? new Date(`${form.start_at}T00:00:00`).toISOString() : new Date(form.start_at).toISOString(),
        end_at: form.all_day
          ? new Date(`${form.end_at || form.start_at}T23:59:59`).toISOString()
          : new Date(form.end_at || form.start_at).toISOString(),
      };
      const res = await fetch("/api/employee/calendar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) { setFormError(data.error || "Failed to save."); return; }
      setShowAddForm(false);
      load();
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ev) {
    if (!window.confirm(`Delete "${ev.title}"?`)) return;
    setEvents((current) => current.filter((e) => e.id !== ev.id));
    try {
      const res = await fetch("/api/employee/calendar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", id: ev.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to delete event.");
    } catch (err) {
      setError(err?.message || "Failed to delete event.");
      load();
    }
  }

  const grouped = (() => {
    const map = new Map();
    for (const ev of events) {
      const key = new Date(ev.start_at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return [...map.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0]));
  })();

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <SectionTitle>Team calendar</SectionTitle>
        <button
          type="button"
          onClick={showAddForm ? () => setShowAddForm(false) : openAdd}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-full"
          style={{ background: "var(--mint)", color: "var(--forest)" }}
        >
          {showAddForm ? "Cancel" : "+ New event"}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleSave} className="rounded-[14px] p-3.5 mb-3 flex flex-col gap-2.5" style={{ background: "white", border: "1px solid var(--border)" }}>
          <input
            autoFocus
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Event title"
            className="text-[13px] rounded-[10px] px-3 py-2.5"
            style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
          />
          <label className="flex items-center gap-2 text-[12px] font-medium" style={{ color: "var(--ink-soft)" }}>
            <input type="checkbox" checked={form.all_day} onChange={(e) => setForm((f) => ({ ...f, all_day: e.target.checked }))} />
            All-day event
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type={form.all_day ? "date" : "datetime-local"}
              value={form.start_at}
              onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
              className="text-[12px] rounded-[10px] px-2.5 py-2"
              style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
            />
            <input
              type={form.all_day ? "date" : "datetime-local"}
              value={form.end_at}
              onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
              className="text-[12px] rounded-[10px] px-2.5 py-2"
              style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
            />
          </div>
          {formError && (
            <p className="text-[11px] rounded-[8px] px-2.5 py-2" style={{ color: RED, background: "#fdf1f0", border: "1px solid #f6d6d3" }}>{formError}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="text-[13px] font-semibold py-2.5 rounded-[10px] disabled:opacity-50"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {saving ? "Saving…" : "Add event"}
          </button>
        </form>
      )}

      <ErrorNotice message={error} />

      {loading ? (
        <p className="text-[12px] text-center py-6" style={{ color: "var(--ink-faint)" }}>Loading…</p>
      ) : grouped.length === 0 ? (
        <p className="text-[12px] text-center py-6" style={{ color: "var(--ink-faint)" }}>No events in the next few months.</p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {grouped.map(([dayKey, dayEvents]) => (
            <div key={dayKey}>
              <div className="text-[11px] font-semibold mb-1.5" style={{ color: "var(--ink-faint)" }}>
                {formatDayHeading(dayEvents[0].start_at)}
              </div>
              <div className="flex flex-col gap-2">
                {dayEvents.map((ev) => {
                  const canDelete = ev.created_by === employee?.id;
                  return (
                    <div key={ev.id} className="flex items-start gap-2.5 px-3.5 py-3 rounded-[12px]" style={{ background: "white", border: "1px solid var(--border)" }}>
                      <span className="text-[11px] font-medium tabular-nums w-12 shrink-0 mt-0.5" style={{ color: "var(--ink-faint)" }}>
                        {formatEventTime(ev.start_at, ev.all_day)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{ev.title}</div>
                        {(ev.location || ev.creator?.full_name || ev.creator?.display_name) && (
                          <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--ink-faint)" }}>
                            {ev.location ? `${ev.location} · ` : ""}
                            {ev.creator?.full_name || ev.creator?.display_name || ""}
                          </div>
                        )}
                      </div>
                      {canDelete && (
                        <button type="button" onClick={() => handleDelete(ev)} aria-label="Delete event" className="shrink-0" style={{ color: "var(--ink-faint)" }}>
                          <Icon path={ICONS.trash} size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/employee/calendar"
        className="flex items-center justify-between px-3.5 py-3 rounded-[12px] mt-4"
        style={{ background: "white", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
      >
        <span className="text-[12px] font-medium">Subscribe (Google/Apple) or connect Google Calendar</span>
        <Icon path={ICONS.chevronRight} size={16} />
      </Link>
    </div>
  );
}

// ── Cold calls ───────────────────────────────────────────────────────────
// Same data/API as app/employee/cold-calls (the desktop page). Shows the
// signed-in employee's own recent calls plus a compact today/this-week
// leaderboard - the full outcome breakdown stays on the desktop page.

const OUTCOME_LABEL = {
  no_answer: "No answer",
  voicemail: "Voicemail",
  gatekeeper: "Gatekeeper",
  not_interested: "Not interested",
  wrong_number: "Wrong number",
  callback_requested: "Callback requested",
  interested: "Interested",
  meeting_booked: "Meeting booked",
};

const OUTCOME_DOT = {
  no_answer: GRAY,
  voicemail: GRAY,
  gatekeeper: GRAY,
  not_interested: RED,
  wrong_number: RED,
  callback_requested: AMBER,
  interested: "#0b6e4f",
  meeting_booked: "#0b6e4f",
};

function CallsTab({ employee }) {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [outcomes, setOutcomes] = useState(Object.keys(OUTCOME_LABEL));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ contact_name: "", company: "", outcome: "no_answer", notes: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const res = await fetch(`/api/employee/cold-calls?from=${from.toISOString()}&mine=1&stats=1`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Could not load calls.");
      setCalls(data.calls || []);
      setStats(data.stats);
      if (data.outcomes?.length) setOutcomes(data.outcomes);
    } catch (err) {
      setError(err?.message || "Could not load calls.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/employee/cold-calls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "create",
          contact_name: form.contact_name.trim(),
          company: form.company.trim(),
          outcome: form.outcome,
          notes: form.notes.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) { setFormError(data.error || "Failed to save."); return; }
      setForm({ contact_name: "", company: "", outcome: "no_answer", notes: "" });
      setShowAddForm(false);
      load();
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(call) {
    if (!window.confirm(`Delete this call log entry?`)) return;
    setCalls((current) => current.filter((c) => c.id !== call.id));
    try {
      const res = await fetch("/api/employee/cold-calls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "delete", id: call.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to delete.");
    } catch (err) {
      setError(err?.message || "Failed to delete.");
      load();
    }
  }

  const me = stats?.byEmployee?.find((row) => row.employeeId === employee?.id);

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <SectionTitle>My calls (last 7 days)</SectionTitle>
        <button
          type="button"
          onClick={showAddForm ? () => setShowAddForm(false) : () => setShowAddForm(true)}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-full"
          style={{ background: "var(--mint)", color: "var(--forest)" }}
        >
          {showAddForm ? "Cancel" : "+ Log call"}
        </button>
      </div>

      {me && (
        <div className="rounded-[14px] px-3.5 py-2.5 mb-3 flex items-center justify-between" style={{ background: "white", border: "1px solid var(--border)" }}>
          <span className="text-[12px] font-medium" style={{ color: "var(--ink-soft)" }}>Today</span>
          <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{me.today} calls</span>
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSave} className="rounded-[14px] p-3.5 mb-3 flex flex-col gap-2.5" style={{ background: "white", border: "1px solid var(--border)" }}>
          <input
            autoFocus
            type="text"
            value={form.contact_name}
            onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
            placeholder="Contact name"
            className="text-[13px] rounded-[10px] px-3 py-2.5"
            style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
          />
          <input
            type="text"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            placeholder="Company (optional)"
            className="text-[13px] rounded-[10px] px-3 py-2.5"
            style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
          />
          <select
            value={form.outcome}
            onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
            className="text-[13px] rounded-[10px] px-3 py-2.5"
            style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
          >
            {outcomes.map((o) => (
              <option key={o} value={o}>{OUTCOME_LABEL[o] || o}</option>
            ))}
          </select>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)"
            rows={2}
            className="text-[13px] rounded-[10px] px-3 py-2.5 resize-none"
            style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
          />
          {formError && (
            <p className="text-[11px] rounded-[8px] px-2.5 py-2" style={{ color: RED, background: "#fdf1f0", border: "1px solid #f6d6d3" }}>{formError}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="text-[13px] font-semibold py-2.5 rounded-[10px] disabled:opacity-50"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {saving ? "Saving…" : "Log call"}
          </button>
        </form>
      )}

      <ErrorNotice message={error} />

      {loading ? (
        <p className="text-[12px] text-center py-6" style={{ color: "var(--ink-faint)" }}>Loading…</p>
      ) : calls.length === 0 ? (
        <p className="text-[12px] text-center py-6" style={{ color: "var(--ink-faint)" }}>No calls logged in the last 7 days.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {calls.map((call) => (
            <div key={call.id} className="flex items-start gap-2.5 px-3.5 py-3 rounded-[12px]" style={{ background: "white", border: "1px solid var(--border)" }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: OUTCOME_DOT[call.outcome] || GRAY }} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>
                  {call.contact_name || call.company || "Unnamed contact"}
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--ink-faint)" }}>
                  {OUTCOME_LABEL[call.outcome] || call.outcome} · {new Date(call.called_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <button type="button" onClick={() => handleDelete(call)} aria-label="Delete call" className="shrink-0" style={{ color: "var(--ink-faint)" }}>
                <Icon path={ICONS.trash} size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/employee/cold-calls"
        className="flex items-center justify-between px-3.5 py-3 rounded-[12px] mt-4"
        style={{ background: "white", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
      >
        <span className="text-[12px] font-medium">Full team log & leaderboard</span>
        <Icon path={ICONS.chevronRight} size={16} />
      </Link>
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

const PRESENCE_DOT = { online: "#0b6e4f", busy: "#d99a3a", offline: "#b0c4ba" };
const PRESENCE_LABEL = { online: "Online", busy: "Busy", offline: "Offline" };

function formatSignedIn(iso) {
  if (!iso) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function TeamPresenceList() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/employee/presence", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setTeam(data.team);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const sorted = [...team].sort((a, b) => (a.status === "offline") - (b.status === "offline"));

  return (
    <>
      <SectionTitle>Team</SectionTitle>
      {loading && team.length === 0 ? (
        <p className="text-[12px] text-center py-4" style={{ color: "var(--ink-faint)" }}>Loading…</p>
      ) : (
        <div className="rounded-[14px]" style={{ background: "white", border: "1px solid var(--border)" }}>
          {sorted.map((person, i) => (
            <div
              key={person.id}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: PRESENCE_DOT[person.status] }} />
                <span className="text-[13px] font-medium truncate" style={{ color: "var(--ink)" }}>{person.name}</span>
              </div>
              <span className="text-[11px] shrink-0" style={{ color: "var(--ink-faint)" }}>
                {PRESENCE_LABEL[person.status]}
                {person.signedInSince ? ` · ${formatSignedIn(person.signedInSince)}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
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

      <div className="mt-5">
        <TeamPresenceList />
      </div>
    </div>
  );
}
