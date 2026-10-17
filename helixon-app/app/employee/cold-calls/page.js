"use client";
// app/employee/cold-calls/page.js
// Cold call log for the sales team - every active employee sees every
// call (it doubles as a team leaderboard), but only the person who made
// a call can edit or delete it. See lib/employee/cold-calls.js.

import { Toaster, useToasts } from "@/app/employee/_shared/Toaster";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useHeartbeat } from "../_shared/useHeartbeat";
import CallListPanel from "./CallListPanel";
import EmployeeShell from "../_shared/EmployeeShell";
import { formatDate as fmtDate } from "@/lib/format";

const formatDate = (iso) => fmtDate(iso, { withYear: false, empty: null });

const OUTCOME_META = {
  no_answer: { label: "No answer", dot: "var(--ink-mute)", bg: "var(--mist)", color: "var(--ink-soft)" },
  voicemail: { label: "Left voicemail", dot: "var(--ink-mute)", bg: "var(--mist)", color: "var(--ink-soft)" },
  gatekeeper: { label: "Gatekeeper", dot: "var(--ink-mute)", bg: "var(--mist)", color: "var(--ink-soft)" },
  not_interested: { label: "Not interested", dot: "var(--score-low)", bg: "var(--ui-danger-soft)", color: "var(--score-low)" },
  wrong_number: { label: "Wrong number", dot: "var(--score-low)", bg: "var(--ui-danger-soft)", color: "var(--score-low)" },
  callback_requested: { label: "Callback requested", dot: "var(--gold)", bg: "var(--ui-warn-soft)", color: "var(--ui-warn)" },
  interested: { label: "Interested", dot: "var(--forest)", bg: "var(--mint)", color: "var(--forest)" },
  meeting_booked: { label: "Meeting booked", dot: "var(--forest)", bg: "var(--mint)", color: "var(--forest)" },
};

function metaFor(outcome) {
  return OUTCOME_META[outcome] || { label: outcome, dot: "var(--ink-mute)", bg: "var(--mist)", color: "var(--ink-soft)" };
}

function formatDayHeading(iso) {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.setHours(0, 0, 0, 0) - today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const EMPTY_FORM = { contact_name: "", company: "", phone: "", outcome: "no_answer", notes: "", follow_up_at: "", called_at: "" };

export default function ColdCallsPage() {
  const [ask, confirmDialog] = useConfirm();
  const { toasts, notify, dismiss } = useToasts();
  const router = useRouter();
  useHeartbeat();

  const [checking, setChecking] = useState(true);
  const [employee, setEmployee] = useState(null);
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scope, setScope] = useState("team"); // "team" | "mine"

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  // Set when the form was opened from the call list, so saving ticks that
  // contact off (see app/api/employee/cold-calls).
  const [callListId, setCallListId] = useState(null);
  const [callListVersion, setCallListVersion] = useState(0);
  const formRef = useRef(null);

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

  async function fetchAll() {
    setLoading(true);
    setError("");
    try {
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const params = new URLSearchParams({ from: from.toISOString(), stats: "1" });
      if (scope === "mine") params.set("mine", "1");
      const res = await fetch(`/api/employee/cold-calls?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) { setError(data.error || "Could not load calls."); return; }
      setCalls(data.calls || []);
      setStats(data.stats);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
    if (!checking) fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fetch only when these inputs change; the fetch function is recreated every render
  }, [checking, scope]);

  function openAdd() {
    setForm({ ...EMPTY_FORM, called_at: toLocalInputValue(new Date()) });
    setFormError("");
    setEditingId(null);
    setCallListId(null);
    setShowAddForm(true);
  }

  function openFromList(row) {
    setForm({
      ...EMPTY_FORM,
      contact_name: row.contact_name || "",
      company: row.company || "",
      phone: row.phone || "",
      notes: row.notes || "",
      called_at: toLocalInputValue(new Date()),
    });
    setFormError("");
    setEditingId(null);
    setCallListId(row.id);
    setShowAddForm(true);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function openEdit(call) {
    setForm({
      contact_name: call.contact_name || "",
      company: call.company || "",
      phone: call.phone || "",
      outcome: call.outcome,
      notes: call.notes || "",
      follow_up_at: call.follow_up_at ? call.follow_up_at.slice(0, 10) : "",
      called_at: toLocalInputValue(new Date(call.called_at)),
    });
    setFormError("");
    setEditingId(call.id);
    setCallListId(null);
    setShowAddForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        action: editingId ? "update" : "create",
        contact_name: form.contact_name.trim(),
        company: form.company.trim(),
        phone: form.phone.trim(),
        outcome: form.outcome,
        notes: form.notes.trim(),
        follow_up_at: form.follow_up_at ? new Date(`${form.follow_up_at}T09:00:00`).toISOString() : null,
        called_at: form.called_at ? new Date(form.called_at).toISOString() : new Date().toISOString(),
      };
      if (editingId) payload.id = editingId;
      else if (callListId) payload.call_list_id = callListId;

      const res = await fetch("/api/employee/cold-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) { setFormError(data.error || "Failed to save."); return; }
      setShowAddForm(false);
      if (callListId) setCallListVersion((v) => v + 1);
      setCallListId(null);
      fetchAll();
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  async function setOutcome(call, outcome) {
    setCalls((prev) => prev.map((c) => (c.id === call.id ? { ...c, outcome } : c)));
    try {
      const res = await fetch("/api/employee/cold-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: call.id, outcome }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to update outcome.");
    } catch (err) {
      notify(err.message || "Failed to update outcome.", { tone: "error" });
      fetchAll();
    }
  }

  async function handleDelete(id) {
    if (!(await ask({ title: "Delete this call log entry?", confirmLabel: "Delete entry", danger: true }))) return;
    setCalls((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch("/api/employee/cold-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to delete.");
    } catch (err) {
      notify(err.message || "Failed to delete.", { tone: "error" });
      fetchAll();
    }
  }

  const grouped = useMemo(() => {
    const map = new Map();
    for (const call of calls) {
      const key = new Date(call.called_at).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(call);
    }
    return [...map.entries()].sort((a, b) => new Date(b[0]) - new Date(a[0]));
  }, [calls]);

  const todayTotal = calls.filter((c) => new Date(c.called_at).toDateString() === new Date().toDateString()).length;

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--mist)]">
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "4px solid var(--border)", borderTopColor: "var(--forest)" }} />
      </main>
    );
  }

  return (
    <EmployeeShell section="cold_calls">
      {confirmDialog}
      <Toaster toasts={toasts} onDismiss={dismiss} />
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--ink)] font-display">
              Cold calls
            </h1>
            <p className="text-sm mt-1 text-[var(--ink-soft)]">
              Import a call list, work through it together and log outcomes across the sales team. You logged <b>{todayTotal}</b> today.
            </p>
          </div>
          <button type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2.5 rounded-lg transition hover:opacity-90 self-start bg-[var(--forest)] text-[var(--on-accent)]"
          >
            <span className="text-base leading-none">+</span> Log call
          </button>
        </div>

        {error && (
          <div className="rounded-card px-4 py-3 text-sm mb-6 bg-[var(--ui-danger-soft)] border border-[var(--danger-line)] text-[var(--score-low)]">
            {error}
          </div>
        )}

        {showAddForm && (
          <div ref={formRef} className="rounded-2xl p-5 mb-6 scroll-mt-20 bg-[var(--bg)] border border-[var(--border)]">
            {callListId && (
              <p className="text-xs font-semibold mb-3 text-[var(--forest)]">
                Logging a call from the call list - saving ticks this contact off.
              </p>
            )}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1 text-[var(--ink-soft)]">Contact name</label>
                  <input
                    autoFocus
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                    className="w-full bg-[var(--bg)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition border border-[var(--border)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-[var(--ink-soft)]">Company</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    className="w-full bg-[var(--bg)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition border border-[var(--border)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-[var(--ink-soft)]">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-[var(--bg)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition border border-[var(--border)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-[var(--ink-soft)]">Outcome</label>
                  <select
                    value={form.outcome}
                    onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
                    className="w-full bg-[var(--bg)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition border border-[var(--border)] text-[var(--ink)]"
                  >
                    {Object.entries(OUTCOME_META).map(([value, meta]) => (
                      <option key={value} value={value}>{meta.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-[var(--ink-soft)]">Called at</label>
                  <input
                    type="datetime-local"
                    value={form.called_at}
                    onChange={(e) => setForm((f) => ({ ...f, called_at: e.target.value }))}
                    className="w-full bg-[var(--bg)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition border border-[var(--border)] text-[var(--ink)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-[var(--ink-soft)]">Follow up on</label>
                  <input
                    type="date"
                    value={form.follow_up_at}
                    onChange={(e) => setForm((f) => ({ ...f, follow_up_at: e.target.value }))}
                    className="w-full bg-[var(--bg)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition border border-[var(--border)] text-[var(--ink)]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1 text-[var(--ink-soft)]">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                    placeholder="What came up, objections, next step…"
                    className="w-full bg-[var(--bg)] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 transition resize-none border border-[var(--border)] text-[var(--ink)]"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-xs rounded-lg px-3 py-2 text-[var(--score-low)] bg-[var(--ui-danger-soft)] border border-[var(--danger-line)]">{formError}</p>
              )}

              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50 hover:opacity-90 bg-[var(--forest)] text-[var(--on-accent)]">
                  {saving ? "Saving…" : editingId ? "Save changes" : "Log call"}
                </button>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-sm px-4 py-2 rounded-lg transition hover:bg-[var(--bg)] text-[var(--ink-soft)]">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <CallListPanel employee={employee} onLogCall={openFromList} refreshKey={callListVersion} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* ── Call log ────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              {["team", "mine"].map((s) => (
                <button type="button"
                  key={s}
                  onClick={() => setScope(s)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-full transition"
                  style={scope === s ? { background: "var(--forest)", color: "var(--on-accent)" } : { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--ink-soft)" }}
                >
                  {s === "team" ? "Whole team" : "Just me"}
                </button>
              ))}
            </div>

            <div className="rounded-2xl overflow-hidden bg-[var(--bg)] border border-[var(--border)]">
              {loading ? (
                <div className="px-6 py-14 text-center text-sm text-[var(--ink-faint)]">Loading…</div>
              ) : grouped.length === 0 ? (
                <div className="px-6 py-14 text-center text-sm text-[var(--ink-faint)]">No calls logged in the last 30 days - log one above.</div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {grouped.map(([dayKey, dayCalls]) => (
                    <div key={dayKey} className="px-6 py-4">
                      <p className="text-xs font-semibold mb-2.5 text-[var(--ink-faint)]">
                        {formatDayHeading(dayCalls[0].called_at)} · {dayCalls.length} call{dayCalls.length === 1 ? "" : "s"}
                      </p>
                      <div className="space-y-2.5">
                        {dayCalls.map((call) => {
                          const canEdit = call.employee_id === employee?.id;
                          const caller = call.caller?.full_name || call.caller?.display_name;
                          const meta = metaFor(call.outcome);
                          return (
                            <div key={call.id} className="flex items-start gap-3 group">
                              <span className="text-xs font-medium tabular-nums w-12 shrink-0 mt-0.5 text-[var(--ink-faint)]">
                                {formatTime(call.called_at)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-medium text-[var(--ink)]">
                                    {call.contact_name || call.company || "Unnamed contact"}
                                  </p>
                                  {canEdit ? (
                                    <select
                                      value={call.outcome}
                                      onChange={(e) => setOutcome(call, e.target.value)}
                                      className="text-11 font-semibold pl-2 pr-1 py-0.5 rounded-full"
                                      style={{ background: meta.bg, color: meta.color, border: "none" }}
                                    >
                                      {Object.entries(OUTCOME_META).map(([value, m]) => (
                                        <option key={value} value={value}>{m.label}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-11 font-semibold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                                      {meta.label}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs mt-0.5 text-[var(--ink-faint)]">
                                  {call.company && call.contact_name ? `${call.company} · ` : ""}
                                  {call.phone ? `${call.phone} · ` : ""}
                                  {scope === "team" && caller ? `Called by ${caller}` : ""}
                                  {call.follow_up_at ? ` · Follow up ${formatDate(call.follow_up_at)}` : ""}
                                </p>
                                {call.notes && <p className="text-xs mt-1 text-[var(--ink-soft)]">{call.notes}</p>}
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                  <button type="button" onClick={() => openEdit(call)} className="text-xs px-2 py-1 rounded-md transition hover:bg-[var(--bg)] text-[var(--ink-soft)]">Edit</button>
                                  <button type="button" onClick={() => handleDelete(call.id)} className="text-xs px-2 py-1 rounded-md transition text-[var(--score-low)]">Delete</button>
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
          </div>

          {/* ── Leaderboard ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="rounded-2xl p-5 bg-[var(--bg)] border border-[var(--border)]">
              <h2 className="text-sm font-semibold mb-3 text-[var(--ink)] font-display">
                This week
              </h2>
              {!stats || stats.byEmployee.length === 0 ? (
                <p className="text-xs text-[var(--ink-faint)]">No calls logged this week yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {stats.byEmployee.map((row) => (
                    <div key={row.employeeId} className="flex items-center justify-between gap-3">
                      <span className={`text-xs font-medium truncate ${row.employeeId === employee?.id ? "text-[var(--forest)]" : "text-[var(--ink)]"}`}>
                        {row.name}
                      </span>
                      <span className="text-xs shrink-0 tabular-nums text-[var(--ink-faint)]">
                        {row.today} today · {row.thisWeek} this week
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {stats && Object.keys(stats.byOutcomeThisWeek).length > 0 && (
              <div className="rounded-2xl p-5 bg-[var(--bg)] border border-[var(--border)]">
                <h2 className="text-sm font-semibold mb-3 text-[var(--ink)] font-display">
                  Outcomes this week
                </h2>
                <div className="space-y-2">
                  {Object.entries(stats.byOutcomeThisWeek)
                    .sort((a, b) => b[1] - a[1])
                    .map(([outcome, count]) => {
                      const meta = metaFor(outcome);
                      return (
                        <div key={outcome} className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-xs text-[var(--ink-soft)]">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: meta.dot }} />
                            {meta.label}
                          </span>
                          <span className="text-xs tabular-nums text-[var(--ink-faint)]">{count}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </EmployeeShell>
  );
}
