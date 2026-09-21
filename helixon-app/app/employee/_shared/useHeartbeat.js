"use client";
// app/employee/_shared/useHeartbeat.js
// Pings /api/employee/presence every 45s while an employee page is open
// and the tab is visible, so lib/employee-presence.js's "online within the
// last 3 minutes" window has something recent to check against. Mount
// this once per signed-in employee page (dashboard, ops, calendar,
// goals) - it's a no-op fire-and-forget, no state to render.

import { useEffect } from "react";

const HEARTBEAT_MS = 45_000;

function ping() {
  fetch("/api/employee/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "heartbeat" }),
  }).catch(() => {
    // A missed beat is harmless - the next interval, or the next visible
    // tab focus, catches up. Nothing here needs to retry.
  });
}

export function useHeartbeat(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;

    ping();
    const interval = setInterval(ping, HEARTBEAT_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") ping();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled]);
}
