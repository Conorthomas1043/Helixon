import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    if (process.env.NEXT_PHASE !== "phase-production-build") reportEnvProblems((await import("./lib/env")).checkEnv());
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reported to Sentry as before, and - for requests the edge logged - the
// log line is marked 500 so admin Traffic can count server errors.
export async function onRequestError(err, request, context) {
  await Sentry.captureRequestError(err, request, context);
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const raw = request?.headers?.["x-helixon-log-uid"];
  const uid = Array.isArray(raw) ? raw[0] : raw;
  if (!uid) return;
  const { markRequestStatus } = await import("./lib/request-status");
  await markRequestStatus(uid, 500);
}

// Missing or malformed environment variables (lib/env.js), once per server
// start: errors to the logs and Sentry, the rest to the logs.
function reportEnvProblems({ errors, warnings }) {
  for (const w of warnings) console.warn(`[env] ${w}`);
  if (!errors.length) return;
  for (const e of errors) console.error(`[env] ${e}`);
  Sentry.captureMessage(`Environment problems: ${errors.join(" ")}`, "error");
}
