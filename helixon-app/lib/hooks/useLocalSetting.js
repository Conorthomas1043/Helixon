"use client";

import { useCallback, useSyncExternalStore } from "react";

// A string remembered in localStorage, read so the server render and the
// first browser render always agree: both see `serverValue`, then the stored
// value takes over. Pages that arrive with their data already loaded need
// this; reading localStorage in a useState initialiser would make the
// browser's first render differ from the server's.
//
// Where storage throws (private mode), the value is kept in memory for the
// rest of the visit.
//
//   const [scope, setScope] = useLocalSetting("helixon.dashboard.scope", "team");

const memory = new Map();
const listeners = new Set();

function read(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(onChange) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * @param {string} key
 * @param {string | null} [serverValue] what the server and hydration render use
 * @returns {[string | null, (next: string) => void]}
 */
export function useLocalSetting(key, serverValue = null) {
  const value = useSyncExternalStore(subscribe, () => read(key), () => serverValue);
  const set = useCallback(
    (next) => {
      try {
        window.localStorage.setItem(key, next);
        memory.delete(key);
      } catch {
        memory.set(key, next);
      }
      listeners.forEach((l) => l());
    },
    [key]
  );
  return [value, set];
}
