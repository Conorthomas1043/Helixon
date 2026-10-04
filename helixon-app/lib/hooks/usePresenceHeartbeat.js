"use client";

// Tells the server this person has Helixon open, once a minute, and whether
// they've actually used it since the last beat (lib/presence.js turns that
// into Active / Idle / Offline on the Team page). Mounted once, in
// DashboardNav, so every signed-in page reports.
//
// Coming back to an idle tab beats straight away, so a teammate sees them
// go from Idle to Active without waiting for the next minute.

import { useEffect } from "react";
import { HEARTBEAT_MS, IDLE_AFTER_MS } from "@/lib/presence";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "mousemove", "touchstart"];

export function usePresenceHeartbeat(enabled) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let interacted = true; // opening a page counts as using it
    let lastBeat = 0;
    let lastActive = Date.now();

    function beat() {
      const active = interacted && document.visibilityState === "visible";
      interacted = false;
      lastBeat = Date.now();
      if (active) lastActive = lastBeat;
      fetch("/api/team/presence", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
        keepalive: true,
      }).catch(() => {}); // best-effort: a missed beat is retried next interval, so not reported
    }

    function onActivity() {
      interacted = true;
      // Was idle (as far as the server knows) - report the return now.
      if (Date.now() - lastActive >= IDLE_AFTER_MS - 30_000 && Date.now() - lastBeat > 10_000) beat();
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        interacted = true;
        if (Date.now() - lastBeat > 10_000) beat();
      }
    }

    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}
