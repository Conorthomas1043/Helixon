"use client";
// app/employee/dashboard/my-tasks-panel.js
// The employee's own to-do list, organised by when things are due:
// Overdue / Today / Next 7 days / Later / No date, with completed tasks
// folded away at the bottom.
//
// - Quick add: type and press Enter; pick a priority and a due date
//   (Today / Tomorrow / Next week / any date) without opening a form.
// - Every row can be completed, edited in place, rescheduled in one click
//   or deleted - with Undo instead of an "Are you sure?" prompt.
// - Keyboard: N focuses quick add, / focuses search, Esc cancels an edit.
//
// All writes go through /api/employee/todos (unchanged), optimistically,
// resyncing from the server if a write fails.

import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, dayKey, groupTasks, relativeDayLabel, startOfWeekKey, toDayKey } from "@/lib/employee-day";
import { Card, Chip } from "../_shared/ui";

const PRIORITIES = [
  { key: "high", label: "High", dot: "#c0392b" },
  { key: "medium", label: "Medium", dot: "#b45309" },
  { key: "low", label: "Low", dot: "#8a9a92" },
];
const PRIORITY_META = Object.fromEntries(PRIORITIES.map((p) => [p.key, p]));

const SECTIONS = [
  { key: "overdue", title: "Overdue" },
  { key: "today", title: "Today" },
  { key: "upcoming", title: "Next 7 days" },
  { key: "later", title: "Later" },
  { key: "someday", title: "No date" },
];

const COMPLETED_PREVIEW = 5;

async function postTodo(body) {
  const res = await fetch("/api/employee/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
  return data;
}

function isTyping(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function quickDates(todayKey) {
  const nextMonday = addDays(startOfWeekKey(todayKey), 7);
  return [
    { key: "today", label: "Today", value: todayKey },
    { key: "tomorrow", label: "Tomorrow", value: addDays(todayKey, 1) },
    { key: "next-week", label: "Next week", value: nextMonday },
  ];
}

function PriorityPicker({ value, onChange, name }) {
  return (
    <div className="flex rounded-[10px] p-0.5 gap-0.5" style={{ background: "var(--mist)" }} role="radiogroup" aria-label="Priority">
      {PRIORITIES.map((p) => (
        <label
          key={p.key}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-[8px] cursor-pointer transition focus-within:ring-2 focus-within:ring-[var(--forest)]"
          style={value === p.key ? { background: "white", color: "var(--ink)", boxShadow: "0 1px 2px rgba(0,0,0,0.06)" } : { color: "var(--ink-soft)" }}
        >
          <input type="radio" name={name} value={p.key} checked={value === p.key} onChange={() => onChange(p.key)} className="sr-only" />
          <span className="w-2 h-2 rounded-full" style={{ background: p.dot }} aria-hidden="true" />
          {p.label}
        </label>
      ))}
    </div>
  );
}

function DuePicker({ value, onChange, todayKey }) {
  const options = quickDates(todayKey);
  const custom = value && !options.some((o) => o.value === value);
  const chip = (active) =>
    `text-xs font-medium px-2.5 py-1.5 rounded-[8px] transition ${active ? "" : "hover:bg-[var(--mist)]"}`;
  const chipStyle = (active) => (active ? { background: "var(--mint)", color: "var(--forest)" } : { color: "var(--ink-soft)" });
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Due date">
      <button type="button" className={chip(!value)} style={chipStyle(!value)} onClick={() => onChange("")} aria-pressed={!value}>
        No date
      </button>
      {options.map((o) => (
        <button key={o.key} type="button" className={chip(value === o.value)} style={chipStyle(value === o.value)} onClick={() => onChange(o.value)} aria-pressed={value === o.value}>
          {o.label}
        </button>
      ))}
      <input
        type="date"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Pick a due date"
        className="text-xs rounded-[8px] px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
        style={{ border: `1px solid ${custom ? "var(--forest)" : "var(--border)"}`, color: "var(--ink)" }}
      />
    </div>
  );
}

function Checkbox({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="w-9 h-9 -m-2 flex items-center justify-center shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--forest)]"
    >
      <span
        className="w-5 h-5 rounded-full flex items-center justify-center transition"
        style={checked ? { background: "var(--forest)", border: "2px solid var(--forest)" } : { border: "2px solid #b9c7c0", background: "white" }}
      >
        {checked && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
    </button>
  );
}

function RescheduleMenu({ todo, todayKey, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const options = [...quickDates(todayKey), { key: "none", label: "No date", value: null }];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="text-xs font-medium px-2 py-1.5 rounded-[8px] hover:bg-[var(--mist)]"
        style={{ color: "var(--ink-soft)" }}
      >
        Reschedule
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-20 w-40 rounded-[12px] py-1 bg-white" style={{ border: "1px solid var(--border)", boxShadow: "0 12px 28px -12px rgba(19,32,27,0.3)" }}>
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onPick(todo, o.value); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--mint)]"
              style={{ color: "var(--ink)" }}
            >
              {o.label}
              {o.value && o.key !== "today" && o.key !== "tomorrow" && (
                <span className="ml-1.5 text-xs" style={{ color: "var(--ink-faint)" }}>{relativeDayLabel(o.value, todayKey)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EditRow({ todo, todayKey, onSave, onCancel }) {
  const [form, setForm] = useState({
    title: todo.title,
    notes: todo.notes || "",
    priority: todo.priority || "medium",
    due_date: toDayKey(todo.due_date) || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError("Give the task a title."); return; }
    setSaving(true);
    setError("");
    const ok = await onSave(todo, { ...form, title: form.title.trim(), due_date: form.due_date || null });
    if (!ok) setSaving(false);
  }

  return (
    <li className="px-5 py-4" style={{ background: "var(--mist)" }}>
      <form onSubmit={submit} onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }} className="space-y-3">
        <input
          autoFocus
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          aria-label="Task title"
          className="w-full bg-white rounded-[10px] px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
          style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
        />
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Notes"
          aria-label="Notes"
          rows={2}
          className="w-full bg-white rounded-[10px] px-3.5 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
          style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <PriorityPicker value={form.priority} onChange={(p) => setForm((f) => ({ ...f, priority: p }))} name={`edit-priority-${todo.id}`} />
          <DuePicker value={form.due_date} onChange={(d) => setForm((f) => ({ ...f, due_date: d }))} todayKey={todayKey} />
        </div>
        {error && <p className="text-xs" role="alert" style={{ color: "#a83226" }}>{error}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={saving} className="text-sm font-semibold px-4 py-2 rounded-[10px] text-white disabled:opacity-60" style={{ background: "var(--forest)" }}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onCancel} className="text-sm px-3 py-2 rounded-[10px] hover:bg-white" style={{ color: "var(--ink-soft)" }}>
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}

function TaskRow({ todo, todayKey, bucket, onToggle, onEdit, onReschedule, onDelete }) {
  const pm = PRIORITY_META[todo.priority] || PRIORITY_META.medium;
  const due = toDayKey(todo.due_date);
  const dueTone = todo.done ? "neutral" : bucket === "overdue" ? "red" : bucket === "today" ? "green" : "neutral";
  // Just added and not confirmed by the server yet - nothing to act on.
  const pending = String(todo.id).startsWith("temp-");

  return (
    <li className={`group flex items-start gap-3 px-5 py-3 transition hover:bg-[#fafcfb] ${pending ? "opacity-60 pointer-events-none" : ""}`} aria-busy={pending || undefined}>
      <div className="pt-0.5">
        <Checkbox checked={!!todo.done} onChange={() => onToggle(todo)} label={todo.done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug break-words ${todo.done ? "line-through" : ""}`} style={{ color: todo.done ? "var(--ink-faint)" : "var(--ink)" }}>
          {todo.title}
        </p>
        {todo.notes && !todo.done && (
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--ink-soft)" }}>{todo.notes}</p>
        )}
        {(!todo.done || due) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {!todo.done && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--ink-soft)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: pm.dot }} aria-hidden="true" />
                {pm.label}
              </span>
            )}
            {due && <Chip tone={dueTone}>{bucket === "overdue" ? `Overdue · ${relativeDayLabel(due, todayKey)}` : relativeDayLabel(due, todayKey)}</Chip>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition">
        {!todo.done && <RescheduleMenu todo={todo} todayKey={todayKey} onPick={onReschedule} />}
        <button type="button" onClick={() => onEdit(todo)} className="text-xs font-medium px-2 py-1.5 rounded-[8px] hover:bg-[var(--mist)]" style={{ color: "var(--ink-soft)" }}>
          Edit
        </button>
        <button type="button" onClick={() => onDelete(todo)} aria-label={`Delete "${todo.title}"`} className="w-8 h-8 flex items-center justify-center rounded-[8px] hover:bg-red-50" style={{ color: "#a83226" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          </svg>
        </button>
      </div>
    </li>
  );
}

export default function MyTasksPanel({ todos, setTodos, loaded, reload, notify, quickAddRef }) {
  const todayKey = dayKey();
  const [draft, setDraft] = useState({ title: "", priority: "medium", due_date: "" });
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const searchRef = useRef(null);
  const localQuickAdd = useRef(null);
  const inputRef = quickAddRef || localQuickAdd;

  useEffect(() => {
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); inputRef.current?.focus(); }
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputRef]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return todos.filter((t) => {
      if (priorityFilter !== "all" && (t.priority || "medium") !== priorityFilter) return false;
      if (q && !`${t.title} ${t.notes || ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [todos, query, priorityFilter]);

  const groups = useMemo(() => groupTasks(filtered, todayKey), [filtered, todayKey]);
  const openCount = todos.filter((t) => !t.done).length;
  const filtering = query.trim() || priorityFilter !== "all";

  async function addTask(e) {
    e.preventDefault();
    const title = draft.title.trim();
    if (!title) return;
    setAdding(true);
    const temp = { id: `temp-${Date.now()}`, title, notes: "", priority: draft.priority, due_date: draft.due_date || null, done: false, created_at: new Date().toISOString() };
    setTodos((list) => [temp, ...list]);
    setDraft((d) => ({ ...d, title: "" }));
    try {
      const { todo } = await postTodo({ action: "create", title, notes: "", priority: draft.priority, due_date: draft.due_date || null });
      setTodos((list) => list.map((t) => (t.id === temp.id ? todo : t)));
    } catch (err) {
      setTodos((list) => list.filter((t) => t.id !== temp.id));
      setDraft((d) => ({ ...d, title }));
      notify(err.message, { tone: "error" });
    } finally {
      setAdding(false);
    }
  }

  async function patch(todo, changes, { successMessage } = {}) {
    setTodos((list) => list.map((t) => (t.id === todo.id ? { ...t, ...changes, updated_at: new Date().toISOString() } : t)));
    try {
      if ("done" in changes && Object.keys(changes).length === 1) {
        await postTodo({ action: "toggle", id: todo.id, done: changes.done });
      } else {
        const { todo: saved } = await postTodo({ action: "update", id: todo.id, ...changes });
        setTodos((list) => list.map((t) => (t.id === todo.id ? saved : t)));
      }
      if (successMessage) notify(successMessage);
      return true;
    } catch (err) {
      // Put back just this task as it was; other edits made meanwhile stay.
      setTodos((list) => list.map((t) => (t.id === todo.id ? todo : t)));
      notify(err.message, { tone: "error" });
      reload();
      return false;
    }
  }

  async function toggle(todo) {
    const done = !todo.done;
    const ok = await patch(todo, { done });
    if (ok && done) {
      notify(`Done: ${todo.title}`, { action: { label: "Undo", onClick: () => patch({ ...todo, done: true }, { done: false }) } });
    }
  }

  function reschedule(todo, value) {
    patch(todo, { due_date: value }, { successMessage: value ? `Moved to ${relativeDayLabel(value, todayKey).toLowerCase()}` : "Due date removed" });
  }

  async function saveEdit(todo, changes) {
    const ok = await patch(todo, changes);
    if (ok) setEditingId(null);
    return ok;
  }

  async function restore(deleted) {
    try {
      const restored = [];
      for (const t of deleted) {
        const { todo } = await postTodo({ action: "create", title: t.title, notes: t.notes || "", priority: t.priority || "medium", due_date: t.due_date || null });
        restored.push(t.done ? (await postTodo({ action: "toggle", id: todo.id, done: true })).todo : todo);
      }
      setTodos((list) => [...restored, ...list]);
    } catch (err) {
      notify(`Couldn't restore: ${err.message}`, { tone: "error" });
      reload();
    }
  }

  async function remove(todo) {
    setTodos((list) => list.filter((t) => t.id !== todo.id));
    try {
      await postTodo({ action: "delete", id: todo.id });
      notify("Task deleted", { action: { label: "Undo", onClick: () => restore([todo]) } });
    } catch (err) {
      notify(err.message, { tone: "error" });
      reload();
    }
  }

  async function clearCompleted() {
    const done = todos.filter((t) => t.done);
    if (done.length === 0) return;
    setTodos((list) => list.filter((t) => !t.done));
    const results = await Promise.all(done.map((t) => postTodo({ action: "delete", id: t.id }).then(() => t).catch(() => null)));
    const cleared = results.filter(Boolean);
    if (cleared.length < done.length) {
      notify(`${done.length - cleared.length} task${done.length - cleared.length === 1 ? "" : "s"} couldn't be cleared.`, { tone: "error" });
      reload();
    }
    if (cleared.length) {
      notify(`Cleared ${cleared.length} completed task${cleared.length === 1 ? "" : "s"}`, { action: { label: "Undo", onClick: () => restore(cleared) } });
    }
  }

  const rowProps = {
    todayKey,
    onToggle: toggle,
    onEdit: (t) => setEditingId(t.id),
    onReschedule: reschedule,
    onDelete: remove,
  };

  const renderRows = (list, bucket) =>
    list.map((t) =>
      editingId === t.id ? (
        <EditRow key={t.id} todo={t} todayKey={todayKey} onSave={saveEdit} onCancel={() => setEditingId(null)} />
      ) : (
        <TaskRow key={t.id} todo={t} bucket={bucket} {...rowProps} />
      )
    );

  const doneList = groups.done;
  const doneVisible = showAllDone ? doneList : doneList.slice(0, COMPLETED_PREVIEW);
  const showDone = doneOpen || (filtering && doneList.length > 0);
  const nothingOpen = SECTIONS.every((s) => groups[s.key].length === 0);

  return (
    <Card aria-labelledby="my-tasks-title">
      {/* Quick add */}
      <form onSubmit={addTask} className="p-4 sm:p-5 border-b" style={{ borderColor: "var(--border-soft)" }}>
        <h2 id="my-tasks-title" className="sr-only">My tasks</h2>
        <div className="flex items-center gap-2 rounded-[12px] pl-3.5 pr-1.5 py-1.5 bg-white focus-within:ring-2 focus-within:ring-[var(--forest)]" style={{ border: "1px solid var(--border)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <input
            ref={inputRef}
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Add a task, then press Enter"
            aria-label="New task"
            maxLength={300}
            className="flex-1 min-w-0 text-sm py-1.5 bg-transparent focus:outline-none"
            style={{ color: "var(--ink)" }}
          />
          <kbd className="hidden sm:inline text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--mist)", color: "var(--ink-faint)" }}>N</kbd>
          <button
            type="submit"
            disabled={!draft.title.trim() || adding}
            className="text-sm font-semibold px-3.5 py-1.5 rounded-[9px] text-white transition disabled:opacity-40"
            style={{ background: "var(--forest)" }}
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2.5">
          <PriorityPicker value={draft.priority} onChange={(p) => setDraft((d) => ({ ...d, priority: p }))} name="new-task-priority" />
          <DuePicker value={draft.due_date} onChange={(v) => setDraft((d) => ({ ...d, due_date: v }))} todayKey={todayKey} />
        </div>
      </form>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-5 py-3">
        <div className="relative flex-1 min-w-[160px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks (/)"
            aria-label="Search tasks"
            className="w-full text-sm rounded-[10px] pl-8 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
            style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
          />
        </div>
        <label className="sr-only" htmlFor="task-priority-filter">Filter by priority</label>
        <select
          id="task-priority-filter"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="text-sm rounded-[10px] px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--forest)]"
          style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }}
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => <option key={p.key} value={p.key}>{p.label} priority</option>)}
        </select>
      </div>

      {/* Sections */}
      {!loaded ? (
        <div className="px-5 pb-6 space-y-2" aria-hidden="true">
          {[0, 1, 2].map((i) => <div key={i} className="shimmer-block h-12 rounded-[10px]" />)}
        </div>
      ) : (
        <div className="pb-2">
          {nothingOpen && (
            <div className="px-5 py-10 text-center">
              <div className="w-11 h-11 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: "var(--mint)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
                {filtering ? "No open tasks match" : openCount === 0 && todos.length > 0 ? "All clear" : "Nothing on your list"}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
                {filtering ? "Try a different search or priority." : "Add a task above, or press N from anywhere on this page."}
              </p>
            </div>
          )}

          {SECTIONS.map((s) => {
            const list = groups[s.key];
            if (list.length === 0) return null;
            return (
              <section key={s.key} aria-labelledby={`tasks-${s.key}`}>
                <h3 id={`tasks-${s.key}`} className="flex items-center gap-2 px-5 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: s.key === "overdue" ? "#a83226" : "var(--ink-faint)" }}>
                  {s.title}
                  <span className="tabular-nums">{list.length}</span>
                </h3>
                <ul className="divide-y divide-[var(--border-soft)]">{renderRows(list, s.key)}</ul>
              </section>
            );
          })}

          {doneList.length > 0 && (
            <section aria-labelledby="tasks-done" className="mt-1 border-t" style={{ borderColor: "var(--border-soft)" }}>
              <div className="flex items-center justify-between px-5 py-2.5">
                <button
                  type="button"
                  id="tasks-done"
                  onClick={() => setDoneOpen((v) => !v)}
                  aria-expanded={showDone}
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--ink-faint)" }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" style={{ transform: showDone ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                  Completed <span className="tabular-nums">{doneList.length}</span>
                </button>
                <button type="button" onClick={clearCompleted} className="text-xs font-medium hover:underline" style={{ color: "var(--ink-soft)" }}>
                  Clear completed
                </button>
              </div>
              {showDone && (
                <>
                  <ul className="divide-y divide-[var(--border-soft)]">{renderRows(doneVisible, "done")}</ul>
                  {doneList.length > COMPLETED_PREVIEW && (
                    <button type="button" onClick={() => setShowAllDone((v) => !v)} className="w-full text-xs font-medium py-2.5 hover:underline" style={{ color: "var(--forest)" }}>
                      {showAllDone ? "Show fewer" : `Show all ${doneList.length}`}
                    </button>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
