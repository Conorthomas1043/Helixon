"use client";

// Part of the employee mobile app (EmployeeMobileApp.jsx).

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { ErrorNotice, ICONS, Icon, RED, SectionTitle } from "./shared";

export function formatDayHeading(iso) {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.setHours(0, 0, 0, 0) - today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function formatEventTime(iso, allDay) {
  if (allDay) return "All day";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// ── Calendar ─────────────────────────────────────────────────────────────
// Same data/API as app/employee/calendar (the desktop page) - agenda view
// plus quick add/delete. Feed-URL subscribe and Google Calendar connect are
// left to the desktop page (linked out below) since that's a one-time setup
// step, not something worth re-building in this compact shell.

export function CalendarTab({ employee }) {
  const [ask, confirmDialog] = useConfirm();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
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
    if (!(await ask({ title: `Delete "${ev.title}"?`, confirmLabel: "Delete event", danger: true }))) return;
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
      {confirmDialog}
      <div className="flex items-center justify-between mb-2.5">
        <SectionTitle>Team calendar</SectionTitle>
        <button
          type="button"
          onClick={showAddForm ? () => setShowAddForm(false) : openAdd}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
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
            className="text-[14px] rounded-[10px] px-3 py-2.5"
            style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
          />
          <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>
            <input type="checkbox" checked={form.all_day} onChange={(e) => setForm((f) => ({ ...f, all_day: e.target.checked }))} />
            All-day event
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type={form.all_day ? "date" : "datetime-local"}
              value={form.start_at}
              onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
              className="text-[13px] rounded-[10px] px-2.5 py-2"
              style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
            />
            <input
              type={form.all_day ? "date" : "datetime-local"}
              value={form.end_at}
              onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
              className="text-[13px] rounded-[10px] px-2.5 py-2"
              style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
            />
          </div>
          {formError && (
            <p className="text-[12px] rounded-[8px] px-2.5 py-2" style={{ color: RED, background: "#fdf1f0", border: "1px solid #f6d6d3" }}>{formError}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="text-[14px] font-semibold py-2.5 rounded-[10px] disabled:opacity-50"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {saving ? "Saving…" : "Add event"}
          </button>
        </form>
      )}

      <ErrorNotice message={error} />

      {loading ? (
        <p className="text-[13px] text-center py-6" style={{ color: "var(--ink-faint)" }}>Loading…</p>
      ) : grouped.length === 0 ? (
        <p className="text-[13px] text-center py-6" style={{ color: "var(--ink-faint)" }}>No events in the next few months.</p>
      ) : (
        <div className="flex flex-col gap-3.5">
          {grouped.map(([dayKey, dayEvents]) => (
            <div key={dayKey}>
              <div className="text-[12px] font-semibold mb-1.5" style={{ color: "var(--ink-faint)" }}>
                {formatDayHeading(dayEvents[0].start_at)}
              </div>
              <div className="flex flex-col gap-2">
                {dayEvents.map((ev) => {
                  const canDelete = ev.created_by === employee?.id;
                  return (
                    <div key={ev.id} className="flex items-start gap-2.5 px-3.5 py-3 rounded-[12px]" style={{ background: "white", border: "1px solid var(--border)" }}>
                      <span className="text-[12px] font-medium tabular-nums w-12 shrink-0 mt-0.5" style={{ color: "var(--ink-faint)" }}>
                        {formatEventTime(ev.start_at, ev.all_day)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-medium truncate" style={{ color: "var(--ink)" }}>{ev.title}</div>
                        {(ev.location || ev.creator?.full_name || ev.creator?.display_name) && (
                          <div className="text-[12px] mt-0.5 truncate" style={{ color: "var(--ink-faint)" }}>
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
        <span className="text-[13px] font-medium">Subscribe (Google/Apple) or connect Google Calendar</span>
        <Icon path={ICONS.chevronRight} size={16} />
      </Link>
    </div>
  );
}
