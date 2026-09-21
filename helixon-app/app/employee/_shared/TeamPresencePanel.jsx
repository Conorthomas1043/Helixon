"use client";
// app/employee/_shared/TeamPresencePanel.jsx
// Who's online, busy, or offline right now, and how long the active ones
// have been signed in. Reused on the dashboard and (in a lighter form)
// wherever else it's useful - see lib/employee-presence.js for how status
// and "signed in since" are derived.

import { useCallback, useEffect, useState } from "react";

const STATUS_META = {
  online: { label: "Online", dot: "#0b6e4f" },
  busy: { label: "Busy", dot: "#d99a3a" },
  offline: { label: "Offline", dot: "#b0c4ba" },
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
      if (data.ok) setTeam(data.team);
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

  return (
    <div className="rounded-[16px] overflow-hidden" style={{ background: "white", border: "1px solid var(--border)" }}>
      <div
        className="px-6 py-4 border-b flex items-center justify-between gap-3"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 className="text-sm font-semibold" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          Team
        </h2>
        {currentEmployeeId && (
          <button
            type="button"
            onClick={toggleBusy}
            disabled={busyToggling}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg transition disabled:opacity-50"
            style={
              isBusy
                ? { background: "#fdf5e9", color: "#d99a3a", border: "1px solid #f2e3c2" }
                : { border: "1px solid var(--border)", color: "var(--ink-soft)" }
            }
          >
            {isBusy ? "Busy - tap to clear" : "Set yourself busy"}
          </button>
        )}
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {loading && team.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm" style={{ color: "var(--ink-faint)" }}>
            Loading…
          </div>
        ) : sorted.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm" style={{ color: "var(--ink-faint)" }}>
            No active employees yet.
          </div>
        ) : (
          sorted.map((person) => {
            const meta = STATUS_META[person.status] || STATUS_META.offline;
            const duration = person.status !== "offline" ? formatDuration(person.signedInSince) : null;
            return (
              <div key={person.id} className="px-6 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.dot }} />
                  <span className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                    {person.name}
                    {person.id === currentEmployeeId && (
                      <span style={{ color: "var(--ink-faint)" }}> (you)</span>
                    )}
                  </span>
                </div>
                <span className="text-xs shrink-0" style={{ color: "var(--ink-faint)" }}>
                  {meta.label}
                  {duration ? ` · signed in ${duration}` : ""}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
