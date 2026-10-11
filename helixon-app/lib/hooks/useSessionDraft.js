"use client";

// Text someone is typing, kept for this browser tab's session under `key`,
// so leaving a page (to another workspace tab, say) and coming back doesn't
// lose it. Cleared when they save (set("")), when the browser tab closes,
// and on log out (lib/compliance/clear-local-data.js clears the
// "helixon:note-draft:" keys). The server render has no draft; it appears
// once the page is in the browser.

import { useCallback, useSyncExternalStore } from "react";

const CHANGED = "helixon:session-draft-changed";

/** @param {string} key */
function read(key) {
  try {
    return window.sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** @param {() => void} onChange */
function subscribe(onChange) {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

/**
 * @param {string | null} key null keeps the draft in memory only
 * @returns {[string, (value: string) => void]}
 */
export function useSessionDraft(key) {
  const value = useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : ""),
    () => ""
  );
  const set = useCallback(
    (next) => {
      if (!key) return;
      try {
        if (next) window.sessionStorage.setItem(key, next);
        else window.sessionStorage.removeItem(key);
      } catch {
        // Storage blocked: the text just isn't kept across pages.
      }
      window.dispatchEvent(new Event(CHANGED));
    },
    [key]
  );
  return [value, set];
}
