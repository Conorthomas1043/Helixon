"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { csrfHeaders } from "./csrf";

// Keeps the console's view of the admin session in step with the server's.
//
// The server ends a session after 30 idle minutes (sliding - see
// lib/admin-session.js). This hook:
//   - polls GET /api/admin/session (which does NOT extend it) so the sidebar can
//     show who's signed in and how long is left;
//   - treats real use (mouse, keys, touch) as activity and, at most every five
//     minutes, POSTs to extend the session;
//   - flags `warning` in the last two minutes so the layout can offer "Stay
//     signed in", and signs the admin out cleanly when time runs out.

const POLL_MS = 60_000;
const ACTIVITY_PING_MS = 5 * 60_000;
const WARN_SECONDS = 120;

export function useAdminSession() {
  const [info, setInfo] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  // Difference between the server's clock and ours, so the countdown is right
  // even if this computer's clock is off.
  const offsetRef = useRef(0);
  const lastPingRef = useRef(Date.now());
  const expiresRef = useRef(null);
  const endedRef = useRef(false);

  const apply = useCallback((data) => {
    setInfo(data);
    offsetRef.current = (data.serverTime || Date.now()) - Date.now();
    expiresRef.current = data.expiresAt;
  }, []);

  const signOut = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    let redirectTo = "/";
    try {
      const res = await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => null);
      if (data?.redirectTo) redirectTo = data.redirectTo;
    } catch {
      // Offline: the cookie will expire by itself.
    }
    window.location.href = redirectTo;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/session", { credentials: "include", cache: "no-store" });
      if (res.status === 401) return signOut();
      if (res.ok) apply(await res.json());
    } catch {
      // A missed poll is harmless; the next one will catch up.
    }
    return undefined;
  }, [apply, signOut]);

  const staySignedIn = useCallback(async () => {
    lastPingRef.current = Date.now();
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        credentials: "include",
        headers: csrfHeaders({ "content-type": "application/json" }),
      });
      if (res.status === 401) return signOut();
      if (res.ok) apply(await res.json());
    } catch {
      // ignore - see refresh()
    }
    return undefined;
  }, [apply, signOut]);

  // Initial load + polling.
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // Countdown, once a second.
  useEffect(() => {
    const timer = setInterval(() => {
      if (!expiresRef.current) return;
      const left = Math.round((expiresRef.current - (Date.now() + offsetRef.current)) / 1000);
      setSecondsLeft(left);
      if (left <= 0) signOut();
    }, 1000);
    return () => clearInterval(timer);
  }, [signOut]);

  // Activity -> extend, throttled.
  useEffect(() => {
    function onActivity() {
      const now = Date.now();
      if (now - lastPingRef.current < ACTIVITY_PING_MS) return;
      // Don't quietly extend an already-expired or expiring session from a stray
      // mouse move; once the warning is up, only the explicit button does it.
      const left = expiresRef.current ? (expiresRef.current - (now + offsetRef.current)) / 1000 : Infinity;
      if (left <= WARN_SECONDS) return;
      staySignedIn();
    }
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, [staySignedIn]);

  return {
    info,
    secondsLeft,
    warning: secondsLeft !== null && secondsLeft > 0 && secondsLeft <= WARN_SECONDS,
    staySignedIn,
    signOut,
  };
}

export function formatCountdown(seconds) {
  if (seconds === null || seconds === undefined) return "";
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
