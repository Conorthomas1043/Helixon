"use client";

// The signed-in recruiter's workspace tabs (lib/workspace/tabs.js), kept in
// this browser's localStorage under their own user id, so two people on one
// computer never see each other's tabs. Every window of the app stays in
// step: a tab opened in one shows up in the others.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useUser } from "@clerk/nextjs";
import { closeTab, openTab, parseStoredTabs } from "@/lib/workspace/tabs";

export const TABS_KEY_PREFIX = "helixon:workspace-tabs:";
const CHANGED = "helixon:workspace-tabs-changed";

/** @typedef {import("@/lib/workspace/tabs").WorkspaceTab} WorkspaceTab */

/** @param {string} key */
function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** @param {string} key @param {WorkspaceTab[]} tabs */
function write(key, tabs) {
  try {
    if (tabs.length) window.localStorage.setItem(key, JSON.stringify(tabs));
    else window.localStorage.removeItem(key);
  } catch {
    // Storage blocked (a private window): tabs just aren't remembered.
  }
  window.dispatchEvent(new Event(CHANGED));
}

// Parsed once per stored value, so the same string gives the same array.
/** @type {Map<string, WorkspaceTab[]>} */
const parsed = new Map();
/** @type {WorkspaceTab[]} */
const NONE = [];
/** @param {string | null} raw */
function tabsFrom(raw) {
  if (!raw) return NONE;
  if (!parsed.has(raw)) {
    if (parsed.size > 20) parsed.clear();
    parsed.set(raw, parseStoredTabs(raw));
  }
  return parsed.get(raw) ?? NONE;
}

/** @param {() => void} onChange */
function subscribe(onChange) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

/**
 * @returns {{
 *   tabs: WorkspaceTab[],
 *   open: (tab: { kind: string, id: string, title?: string }) => void,
 *   close: (key: string) => void,
 *   closeAll: () => void,
 * }}
 */
export function useWorkspaceTabs() {
  const { user } = useUser();
  const key = user?.id ? `${TABS_KEY_PREFIX}${user.id}` : null;
  const raw = useSyncExternalStore(
    subscribe,
    () => (key ? read(key) : null),
    () => null
  );
  const tabs = tabsFrom(raw);

  const open = useCallback((tab) => {
    if (key) write(key, openTab(tabsFrom(read(key)), tab));
  }, [key]);
  const close = useCallback((tabKey) => {
    if (key) write(key, closeTab(tabsFrom(read(key)), tabKey));
  }, [key]);
  const closeAll = useCallback(() => {
    if (key) write(key, []);
  }, [key]);

  return { tabs, open, close, closeAll };
}

/**
 * Puts the record a page shows into the tab strip once its title is known.
 * Pass null until then.
 * @param {{ kind: "candidate" | "job" | "client" | "shortlist", id: string, title: string } | null} tab
 */
export function useWorkspaceTab(tab) {
  const { open } = useWorkspaceTabs();
  const kind = tab?.kind;
  const id = tab?.id;
  const title = tab?.title;
  useEffect(() => {
    if (kind && id && title) open({ kind, id, title });
  }, [open, kind, id, title]);
}
