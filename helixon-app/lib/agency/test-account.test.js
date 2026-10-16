import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny stand-in for the Supabase query builder: records each chain's
// calls and answers from `respond(table, calls)`.
const db = vi.hoisted(() => ({ chains: [], respond: () => ({ data: null, error: null }), rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => {
  function from(table) {
    const calls = [];
    db.chains.push({ table, calls });
    const chain = new Proxy(
      {},
      {
        get(_, name) {
          if (name === "then") return (resolve) => resolve(db.respond(table, calls));
          return (...args) => {
            calls.push([name, ...args]);
            return chain;
          };
        },
      },
    );
    return chain;
  }
  return { supabase: { from, rpc: (...args) => db.rpc(...args) } };
});
const alerts = vi.hoisted(() => ({ sent: [] }));
vi.mock("@/lib/security/alert-email", () => ({
  escapeHtml: (s) => String(s),
  sendAdminAlert: async (msg) => {
    alerts.sent.push(msg);
    return true;
  },
}));
vi.mock("@/lib/ops/site-settings", () => ({
  getSiteSettings: async () => ({}),
  alertRecipients: () => ["ops@example.com"],
}));

const { _clearTestAccountCache, isTestAgency, noteFirstScreening, noteSeen, testAccountStatus, testEmailRefusal } = await import("./test-account");

const ROW = { id: "t1", agency_id: "a1", name: "Ana", email: "ana@example.com", ends_at: null, email_daily_cap: 20, first_seen_at: null, first_screening_at: null };

beforeEach(() => {
  _clearTestAccountCache();
  db.chains = [];
  db.respond = () => ({ data: null, error: null });
  db.rpc.mockReset();
  alerts.sent = [];
});

describe("testAccountStatus", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  it("is active with no end date or one still ahead", () => {
    expect(testAccountStatus({ ends_at: null }, now)).toBe("active");
    expect(testAccountStatus({ ends_at: "2026-10-20T00:00:00Z" }, now)).toBe("active");
  });
  it("is expired once the end date passes", () => {
    expect(testAccountStatus({ ends_at: "2026-10-16T11:59:00Z" }, now)).toBe("expired");
  });
  it("is ended, converted or deleted when those are set, in that precedence", () => {
    expect(testAccountStatus({ ended_at: "2026-10-01T00:00:00Z", ends_at: "2026-10-02T00:00:00Z" }, now)).toBe("ended");
    expect(testAccountStatus({ converted_at: "2026-10-01T00:00:00Z", ended_at: "2026-10-01T00:00:00Z" }, now)).toBe("converted");
    expect(testAccountStatus({ deleted_at: "2026-10-01T00:00:00Z", converted_at: "2026-10-01T00:00:00Z" }, now)).toBe("deleted");
  });
});

describe("isTestAgency", () => {
  it("is false once converted (only unconverted, undeleted rows count)", async () => {
    db.respond = (table, calls) => {
      const filtered = calls.some(([m, col]) => m === "is" && col === "converted_at") && calls.some(([m, col]) => m === "is" && col === "deleted_at");
      return { data: filtered ? null : ROW, error: null };
    };
    expect(await isTestAgency("a1")).toBe(null);
  });

  it("returns the row and caches it", async () => {
    db.respond = () => ({ data: ROW, error: null });
    expect(await isTestAgency("a1")).toEqual(ROW);
    await isTestAgency("a1");
    expect(db.chains.length).toBe(1);
  });

  it("treats a lookup error as not a test account", async () => {
    db.respond = () => ({ data: null, error: { message: "down" } });
    expect(await isTestAgency("a1")).toBe(null);
  });
});

describe("testEmailRefusal", () => {
  it("allows any agency that isn't a test account without counting", async () => {
    expect(await testEmailRefusal("a1", 5)).toBe(null);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("charges the whole batch and refuses when count would pass the cap", async () => {
    db.respond = () => ({ data: ROW, error: null });
    db.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ data: false, error: null });
    expect(await testEmailRefusal("a1", 1)).toBe(null);
    expect(db.rpc).toHaveBeenLastCalledWith("test_account_take_emails", { p_agency_id: "a1", p_count: 1 });
    const refused = await testEmailRefusal("a1", 2);
    expect(refused).toMatch(/20 emails a day/);
    expect(db.rpc).toHaveBeenLastCalledWith("test_account_take_emails", { p_agency_id: "a1", p_count: 2 });
  });

  it("refuses when the allowance can't be checked", async () => {
    db.respond = () => ({ data: ROW, error: null });
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect(await testEmailRefusal("a1", 1)).toMatch(/emails a day/);
  });
});

describe("noteSeen", () => {
  it("records the first sign-in once and alerts the admins", async () => {
    db.respond = (table, calls) => {
      if (calls.some(([m]) => m === "update") && calls.some(([m, col]) => m === "is" && col === "first_seen_at")) return { data: [{ id: "t1" }], error: null };
      return { data: ROW, error: null };
    };
    await noteSeen("a1");
    expect(alerts.sent.length).toBe(1);
    expect(alerts.sent[0].subject).toMatch(/Ana/);
    // Throttled: a second page load within 5 minutes writes nothing.
    const before = db.chains.length;
    await noteSeen("a1");
    expect(db.chains.length).toBe(before);
  });

  it("does nothing for an ordinary agency", async () => {
    await noteSeen("a1");
    expect(db.chains.length).toBe(1);
    expect(alerts.sent.length).toBe(0);
  });
});

describe("noteFirstScreening", () => {
  it("alerts on the first screening only", async () => {
    db.respond = (table, calls) => (calls.some(([m]) => m === "update") ? { data: [{ id: "t1" }], error: null } : { data: ROW, error: null });
    await noteFirstScreening("a1");
    expect(alerts.sent.length).toBe(1);
    expect(alerts.sent[0].subject).toMatch(/first screening/i);
  });

  it("skips the write when a screening is already recorded", async () => {
    db.respond = () => ({ data: { ...ROW, first_screening_at: "2026-10-10T00:00:00Z" }, error: null });
    await noteFirstScreening("a1");
    expect(db.chains.length).toBe(1);
    expect(alerts.sent.length).toBe(0);
  });
});
