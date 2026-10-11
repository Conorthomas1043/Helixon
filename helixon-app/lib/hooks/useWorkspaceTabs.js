"use client";

// The signed-in recruiter's workspace tabs (lib/workspace/tabs.js), kept in
// this browser's localStorage under their own user id, so two people on one
// computer never see each other's tabs. Every window of the app stays in
// step: a tab opened in one shows up in the others.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useUser } from "@clerk/nextjs";
import { closeTab, openTab, parseStoredTabs } from "@/lib/workspace/tabs";
import { track } from "@/lib/analytics/track";

export const TABS_KEY_PREFIX = "helixon:workspace-tabs:";
const CHANGED = "helixon:workspace-tabs-changed";
// "1" while this browser has tabs open, so the server can leave room for the
// strip before the tabs are read (app/layout.js sets data-ws-tabs on <html>)
// instead of the page jumping when it appears. No personal data in it.
export const TABS_COOKIE = "helixon_ws_tabs";

/** @param {boolean} on */
export function setTabsCookie(on) {
  try {
    document.cookie = on ? `${TABS_COOKIE}=1; path=/; max-age=31536000; samesite=lax` : `${TABS_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } catch {
    // No cookies: the strip just appears after the page loads.
  }
}

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
  setTabsCookie(tabs.length > 0);
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
    if (!key) return;
    const before = tabsFrom(read(key));
    const after = openTab(before, tab);
    // Counted once per tab, not on every visit.
    if (!before.some((t) => t.kind === tab.kind && t.id === tab.id)) track("workspace_tab_opened", { kind: tab.kind, open_tabs: after.length });
    write(key, after);
  }, [key]);
  const close = useCallback((tabKey) => {
    if (key) write(key, closeTab(tabsFrom(read(key)), tabKey));
  }, [key]);
  const closeAll = useCallback(() => {
    if (key) write(key, []);
  }, [key]);

  return { tabs, open, close, closeAll };
}

// Where each record's page was scrolled to, for the session, so coming back
// by its tab lands where you left off.
const SCROLL_PREFIX = "helixon:tab-scroll:";
const RETURN_KEY = "helixon:tab-return";

/** @param {string} key @param {string | null} [value] undefined reads */
function session(key, value) {
  try {
    if (value === undefined) return window.sessionStorage.getItem(key);
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked: the page just opens at the top.
  }
  return null;
}

/**
 * Called when a tab is clicked: the page it opens should go back to where
 * it was. Opening the same record any other way starts at the top.
 * @param {string} tabKey
 */
export function markTabReturn(tabKey) {
  session(RETURN_KEY, tabKey);
}

/**
 * Puts the record a page shows into the tab strip once its title is known
 * (pass null until then), remembers how far down the page it's scrolled,
 * and restores that when the page was opened from its tab.
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

  const ready = Boolean(kind && id && title);
  useEffect(() => {
    if (!ready) return undefined;
    const key = `${kind}:${id}`;
    if (session(RETURN_KEY, undefined) === key) {
      session(RETURN_KEY, null);
      const y = Number(session(`${SCROLL_PREFIX}${key}`, undefined));
      // After the page has laid out its content.
      if (y > 0) requestAnimationFrame(() => window.scrollTo({ top: y }));
    }
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => session(`${SCROLL_PREFIX}${key}`, String(Math.round(window.scrollY))));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, [ready, kind, id]);
}
