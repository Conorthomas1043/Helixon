// Customer API routes start with customerRoute (lib/api/route.js), which
// signs the member in, validates the body and reports failures. These
// routes still call requireCustomerContext themselves, for a reason of their
// own (a rate limit before sign-in, a redirect instead of JSON, a shared
// helper used by several handlers). The list may shrink, never grow: a new
// route should use customerRoute.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const ALLOWED = new Set([
  "app/api/analytics/snapshot/route.js",
  "app/api/analytics/timing/route.js",
  "app/api/candidates/[id]/call-notes/route.js",
  "app/api/candidates/[id]/notes/route.js",
  "app/api/candidates/[id]/rescreen/route.js",
  "app/api/candidates/[id]/sms/route.js",
  "app/api/candidates/[id]/talent-pool/route.js",
  "app/api/clients/[id]/contacts/route.js",
  "app/api/draft-email/route.js",
  "app/api/feedback/route.js",
  "app/api/integrations/keys/route.js",
  "app/api/integrations/oauth/[provider]/callback/route.js",
  "app/api/integrations/oauth/[provider]/connect/route.js",
  "app/api/integrations/webhooks/route.js",
  "app/api/run/route.js",
  "app/api/send-email/route.js",
  "app/api/tags/route.js",
  "app/api/team/invite/route.js",
  "app/api/team/presence/route.js",
  "app/api/update-artifact/route.js",
]);

function routes(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) routes(p, out);
    else if (e.name === "route.js") out.push(path.relative(ROOT, p).split(path.sep).join("/"));
  }
  return out;
}

describe("customer routes use customerRoute", () => {
  it("no new route signs members in by hand", () => {
    const direct = routes(path.join(ROOT, "app/api")).filter((f) => /await requireCustomerContext\(/.test(fs.readFileSync(path.join(ROOT, f), "utf8")));
    expect(direct.filter((f) => !ALLOWED.has(f)), "Use customerRoute() from lib/api/route.js").toEqual([]);
  });
});
