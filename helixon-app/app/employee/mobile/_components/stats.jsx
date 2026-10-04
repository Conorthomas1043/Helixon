"use client";

// Part of the employee mobile app (EmployeeMobileApp.jsx).

import { useCallback, useEffect, useState } from "react";
import { ErrorNotice, ICONS, Icon, Kpi, SectionTitle } from "./shared";

export const PRESENCE_DOT = { online: "#0b6e4f", busy: "#d99a3a", offline: "#b0c4ba" };
export const PRESENCE_LABEL = { online: "Online", busy: "Busy", offline: "Offline" };

export function formatSignedIn(iso) {
  if (!iso) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function TeamPresenceList() {
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
        <p className="text-[13px] text-center py-4" style={{ color: "var(--ink-faint)" }}>Loading…</p>
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
                <span className="text-[14px] font-medium truncate" style={{ color: "var(--ink)" }}>{person.name}</span>
              </div>
              <span className="text-[12px] shrink-0" style={{ color: "var(--ink-faint)" }}>
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

export function StatsTab() {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
    load();
  }, [load]);

  return (
    <div>
      <SectionTitle>Platform snapshot, today</SectionTitle>
      <ErrorNotice message={error} />
      {loading && !stats ? (
        <p className="text-[13px] text-center py-6" style={{ color: "var(--ink-faint)" }}>
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
        className="mt-4 w-full flex items-center justify-center gap-1.5 text-[13px] font-medium py-2.5 rounded-[10px]"
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
