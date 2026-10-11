import { describe, expect, it } from "vitest";
import { isTextualBody, redactHeaders, redactPayload, redactQuery, stripSecretHeaders } from "./request-capture";

describe("redactHeaders", () => {
  it("keeps ordinary headers and hides anything that could act as the visitor", () => {
    const out = redactHeaders({
      "User-Agent": "Mozilla/5.0",
      "accept-language": "en-GB",
      cookie: "__session=abc.def; __client_uat=123; helixon_cookie_consent=all",
      authorization: "Bearer eyJhbGciOi.eyJzdWIi.sig",
      "x-internal-secret": "shh",
      "x-vercel-oidc-token": "tok",
      "x-csrf-token": "c",
    });
    expect(out["user-agent"]).toBe("Mozilla/5.0");
    expect(out["accept-language"]).toBe("en-GB");
    expect(out.cookie).toBe("[redacted: 3 cookies - __session, __client_uat, helixon_cookie_consent]");
    expect(out.authorization).toMatch(/^\[redacted: \d+ characters\]$/);
    expect(out["x-internal-secret"]).toMatch(/redacted/);
    expect(out["x-vercel-oidc-token"]).toMatch(/redacted/);
    expect(out["x-csrf-token"]).toMatch(/redacted/);
  });

  it("clips very long values", () => {
    expect(redactHeaders({ referer: "x".repeat(1500) }).referer).toMatch(/… \[500 more characters\]$/);
  });

  it("gives the same result when proxy.ts has already stripped the secrets", () => {
    const raw = { cookie: "__session=abc; theme=dark", authorization: "Bearer abc", referer: "x".repeat(1500), accept: "*/*" };
    const stripped = stripSecretHeaders(raw);
    expect(stripped.cookie).toBe("[redacted: 2 cookies - __session, theme]");
    expect(stripped.authorization).toBe("[redacted: 10 characters]");
    expect(stripped.referer).toHaveLength(1500); // clipping happens once, when stored
    expect(JSON.stringify(stripped)).not.toContain("abc");
    expect(redactHeaders(stripped)).toEqual(redactHeaders(raw));
  });
});

describe("redactQuery", () => {
  it("removes sensitive values and emails but keeps the shape", () => {
    expect(redactQuery("?page=2&token=abc123&email=jo@firm.co.uk&q=hello")).toBe("page=2&token=[redacted]&email=[email]&q=hello");
    expect(redactQuery("next=/dashboard&note=write to jo@firm.co.uk")).toBe("next=%2Fdashboard&note=write%20to%20[email]");
    expect(redactQuery("")).toBe("");
  });

  it("keeps attack payloads visible", () => {
    const q = redactQuery("id=1%27%20OR%201%3D1--");
    expect(decodeURIComponent(q)).toBe("id=1' OR 1=1--");
  });
});

describe("redactPayload", () => {
  it("redacts JSON fields by name, deeply", () => {
    const out = JSON.parse(redactPayload(JSON.stringify({ user: "jo", password: "hunter2", nested: { apiKey: "k", note: "mail jo@x.io" } }), "application/json"));
    expect(out).toEqual({ user: "jo", password: "[redacted]", nested: { apiKey: "[redacted]", note: "mail [email]" } });
  });

  it("redacts form bodies and free text", () => {
    expect(redactPayload("username=admin&password=hunter2", "application/x-www-form-urlencoded")).toBe("username=admin&password=[redacted]");
    expect(redactPayload("login password: hunter2 from jo@x.io", "text/plain")).toBe("login password: [redacted] from [email]");
  });

  it("truncates long bodies", () => {
    expect(redactPayload("a ".repeat(3000), "text/plain")).toMatch(/more characters\]$/);
  });
});

describe("isTextualBody", () => {
  it("accepts text-like bodies and never uploads", () => {
    expect(isTextualBody("application/json; charset=utf-8")).toBe(true);
    expect(isTextualBody("application/x-www-form-urlencoded")).toBe(true);
    expect(isTextualBody("multipart/form-data; boundary=x")).toBe(false);
    expect(isTextualBody("application/pdf")).toBe(false);
  });
});
