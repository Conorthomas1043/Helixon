"use client";

import { useSyncExternalStore } from "react";

// Every dashboard/analyse animation imports this one instead of
// re-implementing it. (The landing page's scroll entrances check the media
// query once, inside lib/hooks/useScrollEntrance.)
//
// A subscription to the media query rather than state copied into an
// effect, so the first client render already has the right answer and
// there's no extra render. The server (and first hydration pass) assume
// motion is fine, as before.
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export default function useReducedMotion() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
