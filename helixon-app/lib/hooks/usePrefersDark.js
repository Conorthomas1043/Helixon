"use client";

import { useSyncExternalStore } from "react";

// Whether the system is set to dark. Only for things CSS can't reach, such as
// Clerk's widgets, which take literal colours (lib/ui/clerk-appearance.js);
// everything else follows the media query in app/globals.css directly.
//
// The same subscription pattern as useReducedMotion. The server (and first
// hydration pass) assume light.
const QUERY = "(prefers-color-scheme: dark)";

function subscribe(onChange) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export default function usePrefersDark() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
