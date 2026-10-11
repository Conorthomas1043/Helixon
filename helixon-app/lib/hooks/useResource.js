"use client";

// Loading data in a client component: one hook in place of a
// useState/useEffect/cancelled-flag block in each page.
//
//   const { data: interviews, error, loading, reload } = useResource(
//     `interviews:${scope}`,
//     () => getInterviews({ scope }),
//   );
//
// The loader runs when the key changes, and again on reload(). The key names
// everything the request depends on; an answer for an old key never replaces
// the current one. The last answer for each key is kept for the session
// (lib/hooks/resource-cache.js), so coming back to a page shows it at once while
// it loads again. `null` as the key means "nothing to load yet".
//
// Pages that can load on the server should (see the candidate profile);
// this is for the ones that load in the browser.

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { EMPTY_ENTRY, createResourceCache } from "@/lib/hooks/resource-cache";

const cache = createResourceCache();

/** Forgets every cached answer (on sign-out). */
export const clearResources = () => cache.clear();

/**
 * @template T
 * @param {string | null} key
 * @param {() => Promise<T>} loader
 * @returns {{
 *   data: T | undefined,
 *   error: Error | null,
 *   loading: boolean,
 *   refreshing: boolean,
 *   reload: () => Promise<T | undefined>,
 *   mutate: (next: T | ((previous: T | undefined) => T)) => void,
 * }}
 * `loading`: nothing to show yet. `refreshing`: showing the last answer
 * while a newer one loads. `error`: the last request failed (the last good
 * `data`, if any, is still there).
 */
export function useResource(key, loader) {
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  const subscribe = useCallback((/** @type {() => void} */ onChange) => (key == null ? () => {} : cache.subscribe(key, onChange)), [key]);
  const entry = useSyncExternalStore(
    subscribe,
    () => cache.get(key),
    () => EMPTY_ENTRY
  );

  useEffect(() => {
    if (key != null) cache.load(key, () => loaderRef.current());
  }, [key]);

  const reload = useCallback(() => (key == null ? Promise.resolve(undefined) : cache.load(key, () => loaderRef.current(), { force: true })), [key]);
  const mutate = useCallback((/** @type {T | ((previous: T | undefined) => T)} */ next) => {
    if (key != null) cache.set(key, next);
  }, [key]);

  // While a request is in flight (a retry after a failure, say) the last
  // error isn't shown; if it fails again, it comes back.
  const error = entry.loading ? null : entry.error;
  return {
    data: entry.data,
    error,
    // Nothing to show yet: before the first answer, or retrying after a
    // first load that failed.
    loading: key != null && !entry.loaded && !error,
    refreshing: entry.loaded && entry.loading,
    reload,
    mutate,
  };
}
