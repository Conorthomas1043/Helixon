"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Generic GET hook for the console's read-only views.
//
//   const { data, error, loading, reload, updatedAt } = useAdminData("/api/admin/agencies?search=x");
//
// - refetches when the URL changes (an in-flight request for the old URL is
//   ignored, so a slow search can't overwrite a newer one)
// - keeps the previous data on screen while reloading, so the page doesn't blank
// - optional polling via { every: ms }; paused while the tab is hidden
// - `error` is a user-facing string; a 401 (session ended) sends the admin back
//   out instead of leaving a page that quietly fails

export function useAdminData(url, { every = 0, enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: "", loading: Boolean(enabled), updatedAt: null });
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !url) return;
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true }));

    try {
      const response = await fetch(url, { credentials: "include", cache: "no-store" });

      if (response.status === 401) {
        window.location.href = "/";
        return;
      }

      const body = await response.json().catch(() => null);
      if (id !== requestId.current) return; // a newer request has superseded this one

      if (!response.ok) {
        setState((s) => ({ ...s, loading: false, error: body?.error || "Could not load this data." }));
        return;
      }
      setState({ data: body, error: "", loading: false, updatedAt: new Date() });
    } catch {
      if (id === requestId.current) {
        setState((s) => ({ ...s, loading: false, error: "Network error - check your connection and try again." }));
      }
    }
  }, [url, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!every || !enabled) return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) load();
    }, every);
    return () => clearInterval(timer);
  }, [every, enabled, load]);

  return { ...state, reload: load };
}

// ── Formatting helpers shared by the pages ─────────────────────────────────

export function formatNumber(n) {
  return Number(n || 0).toLocaleString();
}

export function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// "3 hours ago" / "in 2 days". Falls back to the date for anything over a month.
export function timeAgo(value, now = Date.now()) {
  if (!value) return "never";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "-";
  const seconds = Math.round((now - t) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs >= 86400 * 30) return formatDate(value);
  const [size, unit] = abs < 3600 ? [60, "minute"] : abs < 86400 ? [3600, "hour"] : [86400, "day"];
  const count = Math.max(1, Math.round(abs / size));
  const label = `${count} ${unit}${count === 1 ? "" : "s"}`;
  return seconds >= 0 ? `${label} ago` : `in ${label}`;
}

export function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("") || "?"
  );
}
