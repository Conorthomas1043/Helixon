// Drop-in replacement for console.error on the server: still writes the
// same line to the logs, and also sends it to Sentry, so handled failures
// (a webhook that couldn't save, a cron step that threw) reach someone
// instead of sitting in Vercel's log stream.
//
//   reportError("[team/invite] Clerk revoke failed:", err);
//
// An Error among the arguments is captured with its stack; otherwise the
// arguments are joined into a message. Never throws.

import * as Sentry from "@sentry/nextjs";

function describe(arg) {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return arg.message;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export function reportError(...args) {
  console.error(...args);
  try {
    const message = args.map(describe).join(" ").slice(0, 2000);
    const scope = typeof args[0] === "string" ? args[0].match(/^\[([^\]]+)\]/)?.[1] : undefined;
    const error = args.find((a) => a instanceof Error);
    const context = { tags: scope ? { scope } : undefined, extra: { message } };
    if (error) Sentry.captureException(error, context);
    else Sentry.captureMessage(message, { ...context, level: "error" });
  } catch {
    // Reporting must never break the request that hit the error.
  }
}
