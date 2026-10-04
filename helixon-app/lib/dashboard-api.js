"use client";

// Thin fetch wrappers the dashboard and analyse pages use to reach the real
// API routes (app/api/candidates, jobs, team, analytics/timing ...). Each
// throws an Error carrying the server's message on a non-2xx response,
// except where a caller needs the status itself (getTeamSeatUsage). Stage
// values come from lib/stage-labels.js.
//
// The calls live in lib/api-client/, one module per area; this file
// re-exports them so existing imports keep working.

export * from "./api-client/analytics";
export * from "./api-client/candidates";
export * from "./api-client/clients";
export * from "./api-client/compliance";
export * from "./api-client/email";
export * from "./api-client/integrations";
export * from "./api-client/interviews";
export * from "./api-client/jobs";
export * from "./api-client/opportunities";
export * from "./api-client/placements";
export * from "./api-client/settings";
export * from "./api-client/shortlists";
export * from "./api-client/signatures";
export * from "./api-client/tags";
export * from "./api-client/talent-pool";
export * from "./api-client/team";
