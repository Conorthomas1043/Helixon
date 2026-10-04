import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False in the server render and while the browser hydrates it, true after.
// Pages loaded on the server use it for text that depends on the browser's
// clock or time zone (a greeting, "14:05", "Mon"): the server runs in UTC,
// so rendering those there would disagree with the browser's first render.
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
