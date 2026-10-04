import http from "node:http";
import { test as base, expect } from "@playwright/test";

// Some sandboxes let Node reach the local server but not the browser. With
// E2E_VIA_NODE=1, every request to the app is fetched by Node and handed to
// the page with its real headers (so the CSP is still enforced).
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    if (process.env.E2E_VIA_NODE) {
      const target = new URL(baseURL);
      await context.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.host !== target.host) return route.abort();
        const req = route.request();
        const res = await new Promise((resolve, reject) => {
          const r = http.request(
            { host: target.hostname, port: target.port, path: url.pathname + url.search, method: req.method(), headers: req.headers() },
            (resp) => {
              const chunks = [];
              resp.on("data", (c) => chunks.push(c));
              resp.on("end", () => resolve({ status: resp.statusCode, headers: resp.headers, body: Buffer.concat(chunks) }));
            }
          );
          r.on("error", reject);
          const body = req.postDataBuffer();
          if (body) r.write(body);
          r.end();
        });
        const headers = Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)]));
        await route.fulfill({ status: res.status, headers, body: res.body });
      });
    }
    await use(context);
  },
});

export { expect };

// Fails the test on any Content-Security-Policy violation other than the
// ones a test triggers on purpose.
export function watchCsp(page) {
  const violations = [];
  page.on("console", (m) => {
    const t = m.text();
    if (/Content Security Policy/i.test(t) && !/e2e-injected/.test(t)) violations.push(t.slice(0, 200));
  });
  return violations;
}
