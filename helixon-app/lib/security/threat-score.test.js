import { describe, expect, it } from "vitest";
import { scoreRequest } from "./threat-score";

describe("scoreRequest", () => {
  it("scores attacks in the query string, encoded or not", () => {
    expect(scoreRequest({ path: "/jobs", query: "id=1%27%20OR%201%3D1--" }).signals).toContain("sql-injection-probe");
    expect(scoreRequest({ path: "/search", query: "q=<script>alert(1)</script>" }).signals).toContain("xss-probe");
    expect(scoreRequest({ path: "/x", query: "file=..%2F..%2Fetc%2Fpasswd" }).signals).toContain("path-traversal");
  });

  it("leaves ordinary requests alone", () => {
    expect(scoreRequest({ path: "/pricing", query: "utm_source=google&plan=agency", user_agent: "Mozilla/5.0" }).score).toBe(0);
    // Sensitive-path probes are about the path itself, not a query value.
    expect(scoreRequest({ path: "/blog", query: "ref=/wp-admin" }).signals).not.toContain("sensitive-path-probe");
  });

  it("still scores path and user agent as before", () => {
    expect(scoreRequest({ path: "/.env" }).signals).toEqual(["sensitive-path-probe"]);
    expect(scoreRequest({ path: "/", user_agent: "sqlmap/1.7" }).signals).toEqual(["scanner-ua"]);
  });
});
