"use client";
// app/employee/_shared/TeamPresencePanel.jsx
// Who's online, busy, or offline right now, and how long the active ones
// have been signed in. Reused on the dashboard and (in a lighter form)
// wherever else it's useful - see lib/employee/presence.js for how status
// and "signed in since" are derived.

import { useCallback, useEffect, useState } from "react";

const STATUS_META = {
  online: { label: "Online", dot: "var(--forest)" },
  busy: { label: "Busy", dot: "var(--gold)" },
  offline: { label: "Offline", dot: "var(--ink-mute)" }, // dot only, never text
};

const POLL_MS = 30_000;

function formatDuration(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remMinutes}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default function TeamPresencePanel({ currentEmployeeId }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyToggling, setBusyToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/employee/presence", { cache: "no-store" });
      const data = await res.json();
      if (data.ok) setTeam(Array.isArray(data.team) ? data.team : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const me = team.find((t) => t.id === currentEmployeeId);
  const isBusy = me?.status === "busy";

  async function toggleBusy() {
    setBusyToggling(true);
    try {
      await fetch("/api/employee/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "busy", busy: !isBusy }),
      });
      await load();
    } finally {
      setBusyToggling(false);
    }
  }

  const sorted = [...team].sort((a, b) => {
    const order = { online: 0, busy: 0, offline: 1 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.name.localeCompare(b.name);
  });

  const onlineCount = team.filter((t) => t.status !== "offline").length;

  return (
    <section className="rounded-2xl bg-white border border-[var(--border)]" aria-labelledby="team-presence-title">
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <p className="text-11 font-semibold uppercase tracking-[0.1em] mb-0.5 text-[var(--ink-faint)]">Team</p>
          <h2 id="team-presence-title" className="text-15 font-semibold text-[var(--ink)] font-display">
            {loading && team.length === 0 ? "Who's around" : `${onlineCount} of ${team.length} online`}
          </h2>
        </div>
        {currentEmployeeId && (
          <button
            type="button"
            onClick={toggleBusy}
            disabled={busyToggling}
            aria-pressed={isBusy}
            className="text-xs font-semibold px-3 py-1.5 rounded-full transition disabled:opacity-50"
            style={
              isBusy
                ? { background: "var(--ui-warn-soft)", color: "var(--ui-warn)", border: "1px solid var(--ui-warn-soft)" }
                : { border: "1px solid var(--border)", color: "var(--ink-soft)" }
            }
          >
            {isBusy ? "You're busy · clear" : "Set busy"}
          </button>
        )}
      </div>

      {loading && team.length === 0 ? (
        <div className="px-5 pb-5 space-y-2" aria-hidden="true">
          {[0, 1].map((i) => <div key={i} className="shimmer-block h-9 rounded-btn" />)}
        </div>
      ) : sorted.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-[var(--ink-faint)]">No active employees yet.</p>
      ) : (
        <ul className="pb-3">
          {sorted.map((person) => {
            const meta = STATUS_META[person.status] || STATUS_META.offline;
            const duration = person.status !== "offline" ? formatDuration(person.signedInSince) : null;
            const initials = String(person.name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
            return (
              <li key={person.id} className="px-5 py-1.5 flex items-center gap-3">
                <span className="relative shrink-0">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-12 font-semibold"
                    style={person.status === "offline" ? { background: "var(--mist)", color: "var(--ink-faint)" } : { background: "var(--mint)", color: "var(--forest)" }}
                    aria-hidden="true"
                  >
                    {initials}
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white" style={{ background: meta.dot }} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium truncate ${person.status === "offline" ? "text-[var(--ink-soft)]" : "text-[var(--ink)]"}`}>
                    {person.name}
                    {person.id === currentEmployeeId && <span className="text-[var(--ink-faint)]"> (you)</span>}
                  </span>
                  <span className="block text-xs text-[var(--ink-faint)]">
                    {meta.label}
                    {duration ? ` · on for ${duration}` : ""}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
