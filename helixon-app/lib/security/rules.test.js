import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const { blockIsActive, indexRules, isCountryCode, matchRequestRule, ruleProblem } = await import("./rules");

describe("indexRules", () => {
  it("indexes active allow-list IPs and upper-cased countries", () => {
    const now = Date.parse("2026-09-29T12:00:00Z");
    const { allowIps, blockedCountries } = indexRules(
      [
        { kind: "allow_ip", value: "81.2.69.160", expires_at: null },
        { kind: "block_country", value: "ru", expires_at: "2026-10-01T00:00:00Z" },
        { kind: "block_country", value: "KP", expires_at: "2026-09-01T00:00:00Z" },
      ],
      now,
    );
    expect(allowIps.has("81.2.69.160")).toBe(true);
    expect(blockedCountries.has("RU")).toBe(true);
    expect(blockedCountries.has("KP")).toBe(false);
  });
});

describe("blockIsActive", () => {
  it("treats a missing expiry as permanent and a past one as lifted", () => {
    const now = Date.parse("2026-09-29T12:00:00Z");
    expect(blockIsActive({ ip: "1.2.3.4" }, now)).toBe(true);
    expect(blockIsActive({ ip: "1.2.3.4", expires_at: "2026-09-29T11:00:00Z" }, now)).toBe(false);
    expect(blockIsActive({ ip: "1.2.3.4", expires_at: "2026-09-29T13:00:00Z" }, now)).toBe(true);
    expect(blockIsActive(null, now)).toBe(false);
  });
});

describe("isCountryCode", () => {
  it("accepts two-letter codes only", () => {
    expect(isCountryCode("gb")).toBe(true);
    expect(isCountryCode("GBR")).toBe(false);
    expect(isCountryCode("1A")).toBe(false);
  });
});

describe("path and user-agent rules", () => {
  const rules = indexRules([
    { kind: "block_path", value: "/wp-admin" },
    { kind: "block_ua", value: "SQLMap" },
  ]);

  it("matches path prefixes and user-agent fragments, case-insensitively", () => {
    expect(matchRequestRule(rules, "/WP-ADMIN/setup.php", "Mozilla/5.0")).toEqual({ kind: "block_path", value: "/wp-admin" });
    expect(matchRequestRule(rules, "/", "sqlmap/1.7")).toEqual({ kind: "block_ua", value: "sqlmap" });
    expect(matchRequestRule(rules, "/pricing", "Mozilla/5.0 Chrome")).toBe(null);
  });

  it("refuses rules that would lock out the console or every browser", () => {
    expect(ruleProblem("block_path", "/wp-admin")).toBe(null);
    expect(ruleProblem("block_path", "/")).toMatch(/2-64/);
    expect(ruleProblem("block_path", "/adm")).toMatch(/admin console/);
    expect(ruleProblem("block_path", "/api/webhooks/stripe")).toMatch(/service endpoint/);
    expect(ruleProblem("block_ua", "sqlmap")).toBe(null);
    expect(ruleProblem("block_ua", "Chrome")).toMatch(/almost everyone/);
    expect(ruleProblem("block_ua", "ab")).toMatch(/3-64/);
  });
});
