import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "@/test/fake-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/redis", () => ({ getRedis: async () => ({ set: async () => "OK" }) }));
vi.mock("./alert-email", () => ({ sendFirewallAlert: vi.fn(async () => true) }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn(), reportQuietly: vi.fn() }));

const { enforceFirewallPolicy } = await import("./firewall");

let db;
const probe = (over = {}) => enforceFirewallPolicy({ supabase: db, ip: "203.0.113.9", path: "/%3Cscript%3E", method: "GET", userAgent: "x", fetchSite: "", ...over });

beforeEach(() => {
  db = fakeDb({ blocked_ips: [] });
});

describe("enforceFirewallPolicy", () => {
  it("blocks a scanner's IP, for a day by default", async () => {
    expect(await probe()).toBe(true);
    expect(db.tables.blocked_ips).toHaveLength(1);
    const hours = (new Date(db.tables.blocked_ips[0].expires_at) - Date.now()) / 3600e3;
    expect(hours).toBeGreaterThan(23);
    expect(hours).toBeLessThanOrEqual(24);
  });

  it("refuses a link clicked in a browser without blocking the IP", async () => {
    for (const fetchSite of ["none", "same-origin", "cross-site", "same-site"]) {
      expect(await probe({ fetchSite })).toBe(true);
    }
    expect(db.tables.blocked_ips).toHaveLength(0);
  });

  it("keeps a block permanent when an admin chose that", async () => {
    await probe({ policy: { autoBlockHours: 0 } });
    expect(db.tables.blocked_ips[0].expires_at).toBeUndefined();
  });

  it("lets an ordinary request through", async () => {
    expect(await probe({ path: "/dashboard" })).toBe(false);
  });
});
