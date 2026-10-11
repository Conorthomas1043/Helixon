// The store behind useResource (lib/hooks/useResource.js): the last answer for
// each key, the request in flight for it, and who is listening. Kept apart
// from React so it can be tested on its own (resource-cache.test.js).
//
// Each key has its own entry, so a slow answer for an old key (the previous
// filter, the previous page) only ever updates that key - it can't replace
// what the page is showing now. Within one key, only the latest request's
// answer is kept. Entries live for the browser session; returning to a page
// shows its last answer at once while it loads again.

/**
 * @template T
 * @typedef {{ data: T | undefined, error: Error | null, loading: boolean, loaded: boolean }} ResourceEntry
 */

/** @type {ResourceEntry<any>} */
export const EMPTY_ENTRY = Object.freeze({ data: undefined, error: null, loading: false, loaded: false });

export function createResourceCache() {
  /** @type {Map<string, ResourceEntry<any>>} */
  const entries = new Map();
  /** @type {Map<string, Set<() => void>>} */
  const listeners = new Map();
  /** @type {Map<string, { seq: number, promise: Promise<any> | null }>} */
  const requests = new Map();

  /** @param {string} key @param {Partial<ResourceEntry<any>>} patch */
  function update(key, patch) {
    // A new object on every change, so useSyncExternalStore sees it.
    entries.set(key, { ...(entries.get(key) ?? EMPTY_ENTRY), ...patch });
    for (const fn of listeners.get(key) ?? []) fn();
  }

  return {
    /** @param {string | null} key @returns {ResourceEntry<any>} */
    get(key) {
      return (key != null && entries.get(key)) || EMPTY_ENTRY;
    },

    /** @param {string} key @param {() => void} fn */
    subscribe(key, fn) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key)?.add(fn);
      return () => listeners.get(key)?.delete(fn);
    },

    /**
     * Loads `key` with `loader`. A request already in flight for the key is
     * shared unless `force` is set (a reload after a change), in which case
     * the new request's answer is the one kept.
     * @template T
     * @param {string} key
     * @param {() => Promise<T>} loader
     * @param {{ force?: boolean }} [options]
     * @returns {Promise<T | undefined>}
     */
    load(key, loader, { force = false } = {}) {
      const current = requests.get(key);
      if (current?.promise && !force) return current.promise;
      const seq = (current?.seq ?? 0) + 1;
      update(key, { loading: true });
      const promise = Promise.resolve()
        .then(loader)
        .then(
          (data) => {
            if (requests.get(key)?.seq === seq) update(key, { data, error: null, loading: false, loaded: true });
            return data;
          },
          (err) => {
            // The last good answer stays, with the error beside it.
            if (requests.get(key)?.seq === seq) update(key, { error: err instanceof Error ? err : new Error(String(err)), loading: false });
            return undefined;
          }
        )
        .finally(() => {
          if (requests.get(key)?.seq === seq) requests.set(key, { seq, promise: null });
        });
      requests.set(key, { seq, promise });
      return promise;
    },

    /**
     * Replaces a key's data, after a change the page already knows the
     * result of (an item added, renamed or removed).
     * @template T
     * @param {string} key
     * @param {T | ((previous: T | undefined) => T)} next
     */
    set(key, next) {
      const previous = entries.get(key)?.data;
      const data = typeof next === "function" ? /** @type {(previous: T | undefined) => T} */ (next)(previous) : next;
      update(key, { data, loaded: true });
    },

    // Every entry, gone - after signing out, so the next person on this
    // browser never sees the last one's data.
    clear() {
      entries.clear();
      requests.clear();
      for (const set of listeners.values()) for (const fn of set) fn();
    },
  };
}
