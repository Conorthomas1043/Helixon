import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "./csp";

const ROOT = path.resolve(__dirname, "..");
const directive = (policy, name) => policy.split("; ").find((d) => d.startsWith(`${name} `));

describe("content security policy", () => {
  const policy = buildCsp("abc123");

  it("only runs scripts carrying the nonce, or loaded by one", () => {
    const scripts = directive(policy, "script-src");
    expect(scripts).toContain("'nonce-abc123'");
    expect(scripts).toContain("'strict-dynamic'");
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
  });

  it("allows eval only in development", () => {
    expect(directive(buildCsp("n", { isDev: true }), "script-src")).toContain("'unsafe-eval'");
  });

  it("keeps the other protections", () => {
    expect(directive(policy, "object-src")).toBe("object-src 'none'");
    expect(directive(policy, "base-uri")).toBe("base-uri 'self'");
    expect(directive(policy, "frame-ancestors")).toBe("frame-ancestors 'self'");
  });

  it("makes a fresh, unguessable nonce each time", () => {
    const a = createNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(createNonce()).not.toBe(a);
  });

  it("every page renders per request, so Next can put the nonce on its scripts", () => {
    // A prerendered page would have no nonce, so none of its scripts would run.
    expect(fs.readFileSync(path.join(ROOT, "app/layout.js"), "utf8")).toMatch(/await connection\(\)/);
  });
});
