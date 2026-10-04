"use client";

// Part of the employee mobile app (EmployeeMobileApp.jsx).

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/dashboard/use-confirm";
import { AMBER, ErrorNotice, GRAY, ICONS, Icon, RED, SectionTitle } from "./shared";

// ── Cold calls ───────────────────────────────────────────────────────────
// Same data/API as app/employee/cold-calls (the desktop page). Shows the
// signed-in employee's own recent calls plus a compact today/this-week
// leaderboard - the full outcome breakdown stays on the desktop page.

export const OUTCOME_LABEL = {
  no_answer: "No answer",
  voicemail: "Voicemail",
  gatekeeper: "Gatekeeper",
  not_interested: "Not interested",
  wrong_number: "Wrong number",
  callback_requested: "Callback requested",
  interested: "Interested",
  meeting_booked: "Meeting booked",
};

export const OUTCOME_DOT = {
  no_answer: GRAY,
  voicemail: GRAY,
  gatekeeper: GRAY,
  not_interested: RED,
  wrong_number: RED,
  callback_requested: AMBER,
  interested: "#0b6e4f",
  meeting_booked: "#0b6e4f",
};

export function CallsTab({ employee }) {
  const [ask, confirmDialog] = useConfirm();
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
      const res = await fetch(`/api/employee/cold-calls?mine=1&stats=1`, { cache: "no-store" });
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
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

  async function setOutcome(call, outcome) {
    setCalls((current) => current.map((c) => (c.id === call.id ? { ...c, outcome } : c)));
    try {
      const res = await fetch("/api/employee/cold-calls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "update", id: call.id, outcome }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to update outcome.");
    } catch (err) {
      setError(err?.message || "Failed to update outcome.");
      load();
    }
  }

  async function handleDelete(call) {
    if (!(await ask({ title: "Delete this call log entry?", confirmLabel: "Delete entry", danger: true }))) return;
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
      {confirmDialog}
      <div className="flex items-center justify-between mb-2.5">
        <SectionTitle>My calls</SectionTitle>
        <button
          type="button"
          onClick={showAddForm ? () => setShowAddForm(false) : () => setShowAddForm(true)}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
          style={{ background: "var(--mint)", color: "var(--forest)" }}
        >
          {showAddForm ? "Cancel" : "+ Log call"}
        </button>
      </div>

      {me && (
        <div className="rounded-[14px] px-3.5 py-2.5 mb-3 flex items-center justify-between" style={{ background: "white", border: "1px solid var(--border)" }}>
          <span className="text-[13px] font-medium" style={{ color: "var(--ink-soft)" }}>Today</span>
          <span className="text-[14px] font-semibold tabular-nums" style={{ color: "var(--ink)" }}>{me.today} calls</span>
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
            className="text-[14px] rounded-[10px] px-3 py-2.5"
            style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
          />
          <input
            type="text"
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            placeholder="Company (optional)"
            className="text-[14px] rounded-[10px] px-3 py-2.5"
            style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
          />
          <select
            value={form.outcome}
            onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))}
            className="text-[14px] rounded-[10px] px-3 py-2.5"
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
            className="text-[14px] rounded-[10px] px-3 py-2.5 resize-none"
            style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
          />
          {formError && (
            <p className="text-[12px] rounded-[8px] px-2.5 py-2" style={{ color: RED, background: "#fdf1f0", border: "1px solid #f6d6d3" }}>{formError}</p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="text-[14px] font-semibold py-2.5 rounded-[10px] disabled:opacity-50"
            style={{ background: "var(--forest)", color: "white" }}
          >
            {saving ? "Saving…" : "Log call"}
          </button>
        </form>
      )}

      <ErrorNotice message={error} />

      {loading ? (
        <p className="text-[13px] text-center py-6" style={{ color: "var(--ink-faint)" }}>Loading…</p>
      ) : calls.length === 0 ? (
        <p className="text-[13px] text-center py-6" style={{ color: "var(--ink-faint)" }}>No calls logged yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {calls.map((call) => (
            <div key={call.id} className="flex items-start gap-2.5 px-3.5 py-3 rounded-[12px]" style={{ background: "white", border: "1px solid var(--border)" }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{ background: OUTCOME_DOT[call.outcome] || GRAY }} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium truncate" style={{ color: "var(--ink)" }}>
                  {call.contact_name || call.company || "Unnamed contact"}
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <select
                    value={call.outcome}
                    onChange={(e) => setOutcome(call, e.target.value)}
                    className="text-[11px] font-semibold pl-1.5 pr-1 py-0.5 rounded-full"
                    style={{ background: "var(--mist)", color: "var(--ink-soft)", border: "1px solid var(--border)" }}
                  >
                    {outcomes.map((o) => (
                      <option key={o} value={o}>{OUTCOME_LABEL[o] || o}</option>
                    ))}
                  </select>
                  <span className="text-[11px]" style={{ color: "var(--ink-faint)" }}>
                    {new Date(call.called_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {call.notes && (
                  <div className="text-[12px] mt-1" style={{ color: "var(--ink-soft)" }}>{call.notes}</div>
                )}
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
        <span className="text-[13px] font-medium">Full team log & leaderboard</span>
        <Icon path={ICONS.chevronRight} size={16} />
      </Link>
    </div>
  );
}
