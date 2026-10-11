// PostHog, loaded only once a visitor has agreed to analytics cookies.
//
// posthog-js is about 90 KB (gzip). Imported directly it shipped to every
// visitor, including everyone who chose "Essential only". This module has
// the same shape the app uses (`posthog.capture(...)`, `posthog.__loaded`)
// but the library itself is fetched by loadPosthog(), which
// instrumentation-client.js calls only after consent.
//
// Before loading starts, calls are dropped, which is what an un-initialised
// posthog-js did too. While it is loading they are queued and replayed.

let client = null;
let loading = null;
const queue = [];

export function loadPosthog(init) {
  if (!loading) {
    loading = import("posthog-js").then(({ default: posthog }) => {
      init(posthog);
      client = posthog;
      for (const [method, args] of queue.splice(0)) client[method](...args);
      return client;
    });
  }
  return loading;
}

const call =
  (method) =>
  (...args) => {
    if (client) return client[method](...args);
    if (loading) queue.push([method, args]);
  };

const posthog = {
  get __loaded() {
    return Boolean(client?.__loaded);
  },
  capture: call("capture"),
  captureException: call("captureException"),
  identify: call("identify"),
  group: call("group"),
  reset: call("reset"),
  opt_in_capturing: call("opt_in_capturing"),
  opt_out_capturing: call("opt_out_capturing"),
};

export default posthog;

// For tests: forget any loaded client.
export function _resetPosthogForTests() {
  client = null;
  loading = null;
  queue.length = 0;
}
