"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate as fmtDate, initials, timeAgo as fmtTimeAgo } from "@/lib/format";

export const formatDate = (value) => fmtDate(value);
export const timeAgo = (value, now = Date.now()) => fmtTimeAgo(value, { now, style: "long" });
export { initials };

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
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full page load on purpose: it drops all client state after sign-out, account deletion or an expired session
        window.location.assign("/");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches from the server when the view opens or its inputs change; the loading state it sets is the point
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

export function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

