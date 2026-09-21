"use client";
// app/employee/calendar/page.js
// Shared team calendar - every active employee sees every event. Plus two
// ways to get it into a personal calendar app: a read-only "subscribe by
// URL" ICS feed (works in both Google Calendar and Apple Calendar today,
// no setup needed beyond pasting a link), and a real two-way Google
// Calendar OAuth connection (lib/google-calendar.js) that needs
// GOOGLE_CALENDAR_CLIENT_ID/SECRET configured before it can do anything.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useHeartbeat } from "../_shared/useHeartbeat";

const GOOGLE_ERROR_MESSAGES = {
  not_configured: "Google Calendar isn't set up on this deployment yet - ask an admin to add GOOGLE_CALENDAR_CLIENT_ID/SECRET.",
  invalid_state: "That connection attempt expired or was tampered with. Try connecting again.",
  no_refresh_token: "Google didn't grant lasting access. Remove Helixon from your Google Account's third-party access list, then reconnect.",
  exchange_failed: "Could not complete the connection to Google. Try again.",
  access_denied: "Google access was declined.",
};

function formatDayHeading(iso) {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.setHours(0, 0, 0, 0) - today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function formatTime(iso, allDay) {
  if (allDay) return "All day";
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function CalendarPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useHeartbeat();

  const [checking, setChecking] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: "", notes: "", location: "", start_at: "", end_at: "", all_day: false });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [feedUrl, setFeedUrl] = useState("");
  const [feedLoading, setFeedLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const [googleStatus, setGoogleStatus] = useState(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [banner, setBanner] = useState(null);

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

  useEffect(() => {
    const connected = searchParams.get("googleConnected");
    const googleError = searchParams.get("googleError");
    if (connected) setBanner({ tone: "ok", message: "Google Calendar connected." });
    else if (googleError) setBanner({ tone: "error", message: GOOGLE_ERROR_MESSAGES[googleError] || "Could not connect Google Calendar." });
    if (connected || googleError) {
      router.replace("/employee/calendar");
    }
  }, [searchParams, router]);

  async function fetchEvents() {
    setLoading(true);
    try {
      const from = new Date();
      from.setDate(from.getDate() - 7);
      const res = await fetch(`/api/employee/calendar?from=${from.toISOString()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setEvents(data.events);
      else setError(data.error || "Could not load the calendar.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchFeedUrl() {
    setFeedLoading(true);
    try {
      const res = await fetch("/api/employee/calendar/feed-token");
      const data = await res.json();
      if (data.ok) setFeedUrl(data.url);
    } finally {
      setFeedLoading(false);
    }
  }

  async function fetchGoogleStatus() {
    try {
      const res = await fetch("/api/employee/calendar/google/status");
      const data = await res.json();
      if (data.ok) setGoogleStatus(data);
    } catch {
      // leave googleStatus null - the panel just shows nothing rather than erroring
    }
  }

  useEffect(() => {
    if (checking) return;
    fetchEvents();
    fetchFeedUrl();
    fetchGoogleStatus();
  }, [checking]);

  function openAdd() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const end = new Date(now.getTime() + 60 * 60 * 1000);
    setForm({ title: "", notes: "", location: "", start_at: toLocalInputValue(now), end_at: toLocalInputValue(end), all_day: false });
    setFormError("");
    setEditingId(null);
    setShowAddForm(true);
  }

  function openEdit(ev) {
    setForm({
      title: ev.title,
      notes: ev.notes || "",
      location: ev.location || "",
      start_at: ev.all_day ? ev.start_at.slice(0, 10) : toLocalInputValue(new Date(ev.start_at)),
      end_at: ev.all_day ? ev.end_at.slice(0, 10) : toLocalInputValue(new Date(ev.end_at)),
      all_day: ev.all_day,
    });
    setFormError("");
    setEditingId(ev.id);
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
        action: editingId ? "update" : "create",
        title: form.title,
        notes: form.notes,
        location: form.location,
        all_day: form.all_day,
        start_at: form.all_day ? new Date(`${form.start_at}T00:00:00`).toISOString() : new Date(form.start_at).toISOString(),
        end_at: form.all_day
          ? new Date(`${form.end_at || form.start_at}T23:59:59`).toISOString()
          : new Date(form.end_at || form.start_at).toISOString(),
      };
      if (editingId) payload.id = editingId;

      const res = await fetch("/api/employee/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) { setFormError(data.error || "Failed to save."); return; }
      setShowAddForm(false);
      fetchEvents();
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this event?")) return;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try {
      const res = await fetch("/api/employee/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to delete event.");
    } catch (err) {
      alert(err.message || "Failed to delete event.");
      fetchEvents();
    }
  }

  function copyFeedUrl() {
    navigator.clipboard?.writeText(feedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function regenerateFeed() {
    if (!confirm("Regenerate your feed link? Any calendar already subscribed to the old one will stop receiving updates.")) return;
    setFeedLoading(true);
    try {
      const res = await fetch("/api/employee/calendar/feed-token", { method: "POST" });
      const data = await res.json();
      if (data.ok) setFeedUrl(data.url);
    } finally {
      setFeedLoading(false);
    }
  }

  async function disconnectGoogle() {
    if (!confirm("Disconnect Google Calendar? This stops future syncing but doesn't delete anything already synced.")) return;
    setGoogleBusy(true);
    try {
      await fetch("/api/employee/calendar/google/disconnect", { method: "POST" });
      await fetchGoogleStatus();
    } finally {
      setGoogleBusy(false);
    }
  }

  async function syncGoogle() {
    setGoogleBusy(true);
    try {
      const res = await fetch("/api/employee/calendar/google/sync", { method: "POST" });
      const data = await res.json();
      if (!data.ok) { alert(data.error || "Sync failed."); return; }
      await Promise.all([fetchGoogleStatus(), fetchEvents()]);
    } finally {
      setGoogleBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      const key = new Date(ev.start_at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    }
    return [...map.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0]));
  }, [events]);

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
            <Link href="/employee/goals" className="nav-link text-xs font-medium px-2" style={{ color: "var(--ink-soft)" }}>Goals</Link>
            <Link href="/employee/dashboard" className="text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:bg-white" style={{ borderColor: "var(--border)", color: "var(--ink-soft)" }}>
              ← My dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              Calendar
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-soft)" }}>
              The shared team calendar - visible to every employee.
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-lg transition hover:opacity-90 self-start"
            style={{ background: "var(--forest)", color: "white" }}
          >
            <span className="text-base leading-none">+</span> New event
          </button>
        </div>

        {banner && (
          <div
            className="rounded-[14px] px-4 py-3 text-sm mb-6 flex items-center justify-between gap-3"
            style={banner.tone === "ok" ? { background: "var(--mint)", border: "1px solid var(--border)", color: "var(--forest)" } : { background: "#fdf1f0", border: "1px solid #f4d4d2", color: "#e0554f" }}
          >
            <span>{banner.message}</span>
            <button onClick={() => setBanner(null)} className="opacity-70 hover:opacity-100" aria-label="Dismiss">✕</button>
          </div>
        )}

        {error && (
          <div className="rounded-[14px] px-4 py-3 text-sm mb-6" style={{ background: "#fdf1f0", border: "1px solid #f4d4d2", color: "#e0554f" }}>
            {error}
          </div>
        )}

        {showAddForm && (
          <div className="rounded-[16px] p-5 mb-6" style={{ background: "white", border: "1px solid var(--border)" }}>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Event title *</label>
                  <input
                    autoFocus
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <label className="sm:col-span-2 flex items-center gap-2 text-xs font-medium" style={{ color: "var(--ink-soft)" }}>
                  <input type="checkbox" checked={form.all_day} onChange={(e) => setForm((f) => ({ ...f, all_day: e.target.checked }))} />
                  All-day event
                </label>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>{form.all_day ? "Start date" : "Starts"}</label>
                  <input
                    type={form.all_day ? "date" : "datetime-local"}
                    value={form.start_at}
                    onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>{form.all_day ? "End date" : "Ends"}</label>
                  <input
                    type={form.all_day ? "date" : "datetime-local"}
                    value={form.end_at}
                    onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                    placeholder="Optional"
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-soft)" }}>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    className="w-full bg-white rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition resize-none"
                    style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
                  />
                </div>
              </div>

              {formError && (
                <p className="text-xs rounded-lg px-3 py-2" style={{ color: "#e0554f", background: "#fdf1f0", border: "1px solid #f4d4d2" }}>{formError}</p>
              )}

              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 hover:opacity-90" style={{ background: "var(--forest)", color: "white" }}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add event"}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-sm px-4 py-2 rounded-lg transition hover:bg-white" style={{ color: "var(--ink-soft)" }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* ── Agenda ──────────────────────────────────────────────────── */}
          <div className="rounded-[16px] overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }}>
            {loading ? (
              <div className="px-6 py-14 text-center text-sm" style={{ color: "var(--ink-faint)" }}>Loading…</div>
            ) : grouped.length === 0 ? (
              <div className="px-6 py-14 text-center text-sm" style={{ color: "var(--ink-faint)" }}>No events in the next few months - add one above.</div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {grouped.map(([dayKey, dayEvents]) => (
                  <div key={dayKey} className="px-6 py-4">
                    <p className="text-xs font-semibold mb-2.5" style={{ color: "var(--ink-faint)" }}>{formatDayHeading(dayEvents[0].start_at)}</p>
                    <div className="space-y-2.5">
                      {dayEvents.map((ev) => {
                        const canEdit = ev.created_by === employee?.id;
                        const organiser = ev.creator?.full_name || ev.creator?.display_name;
                        return (
                          <div key={ev.id} className="flex items-start gap-3 group">
                            <span className="text-xs font-medium tabular-nums w-16 shrink-0 mt-0.5" style={{ color: "var(--ink-faint)" }}>
                              {formatTime(ev.start_at, ev.all_day)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>{ev.title}</p>
                              <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                                {ev.location ? `${ev.location} · ` : ""}
                                {organiser ? `Organised by ${organiser}` : ""}
                                {ev.google_event_id ? " · synced from Google" : ""}
                              </p>
                              {ev.notes && <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>{ev.notes}</p>}
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                <button onClick={() => openEdit(ev)} className="text-xs px-2 py-1 rounded-md transition hover:bg-white" style={{ color: "var(--ink-soft)" }}>Edit</button>
                                <button onClick={() => handleDelete(ev.id)} className="text-xs px-2 py-1 rounded-md transition" style={{ color: "#e0554f" }}>Delete</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Connect panel ───────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="rounded-[16px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Subscribe from Google or Apple
              </h2>
              <p className="text-xs mb-3" style={{ color: "var(--ink-faint)" }}>
                Add this link as a subscribed calendar - it updates automatically. Read-only.
              </p>
              {feedLoading ? (
                <div className="text-xs" style={{ color: "var(--ink-faint)" }}>Loading link…</div>
              ) : (
                <>
                  <div className="flex gap-2 mb-2">
                    <input
                      readOnly
                      value={feedUrl}
                      onFocus={(e) => e.target.select()}
                      className="flex-1 min-w-0 text-[11px] rounded-lg px-2.5 py-2 font-mono"
                      style={{ border: "1px solid var(--border)", color: "var(--ink-soft)", background: "var(--mist)" }}
                    />
                    <button onClick={copyFeedUrl} className="text-xs font-semibold px-3 py-2 rounded-lg shrink-0" style={{ background: "var(--mint)", color: "var(--forest)" }}>
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <details className="text-xs" style={{ color: "var(--ink-faint)" }}>
                    <summary className="cursor-pointer font-medium" style={{ color: "var(--ink-soft)" }}>How to add it</summary>
                    <p className="mt-2"><b>Google Calendar</b> - Settings → Add calendar → From URL → paste the link.</p>
                    <p className="mt-1.5"><b>Apple Calendar</b> - File → New Calendar Subscription → paste the link.</p>
                  </details>
                  <button onClick={regenerateFeed} className="text-xs mt-3" style={{ color: "var(--ink-faint)" }}>
                    Regenerate link
                  </button>
                </>
              )}
            </div>

            <div className="rounded-[16px] p-5" style={{ background: "white", border: "1px solid var(--border)" }}>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
                Google Calendar (two-way)
              </h2>
              {!googleStatus ? (
                <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Loading…</p>
              ) : !googleStatus.configured ? (
                <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
                  Not set up on this deployment yet - needs GOOGLE_CALENDAR_CLIENT_ID/SECRET from an admin.
                </p>
              ) : googleStatus.connection ? (
                <>
                  <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>
                    Connected as <b>{googleStatus.connection.google_email || "your Google account"}</b>.
                    {googleStatus.connection.last_synced_at
                      ? ` Last synced ${new Date(googleStatus.connection.last_synced_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.`
                      : " Not synced yet."}
                    {googleStatus.connection.last_sync_error && (
                      <span style={{ color: "#e0554f" }}> Last sync failed: {googleStatus.connection.last_sync_error}</span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={syncGoogle} disabled={googleBusy} className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ background: "var(--mint)", color: "var(--forest)" }}>
                      {googleBusy ? "Working…" : "Sync now"}
                    </button>
                    <button onClick={disconnectGoogle} disabled={googleBusy} className="text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50" style={{ border: "1px solid var(--border)", color: "var(--ink-soft)" }}>
                      Disconnect
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs mb-3" style={{ color: "var(--ink-faint)" }}>
                    Pulls your Google events onto the shared calendar and pushes events you organise here back to your Google Calendar.
                  </p>
                  <a
                    href="/api/employee/calendar/google/connect"
                    className="inline-flex text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "var(--forest)", color: "white" }}
                  >
                    Connect Google Calendar
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// useSearchParams() (for ?googleConnected=1 / ?googleError=) requires a
// Suspense boundary in the app router - same reason app/login and
// app/employee/login wrap their content components.
export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarPageContent />
    </Suspense>
  );
}
