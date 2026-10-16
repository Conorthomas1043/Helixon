import { beforeEach, describe, expect, it, vi } from "vitest";

const profile = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/auth/create-profile", () => ({
  generateUsername: async (seed) => `${seed}x`,
  createProfileAndAgency: (...args) => profile.create(...args),
}));
vi.mock("@/lib/employee/auth", () => ({ generateEmployeePassword: () => "abcde-fghjk-mnpqr-stuvw" }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/security/alert-email", () => ({ escapeHtml: String, sendAdminAlert: async () => true }));
vi.mock("@/lib/messaging/mailer", () => ({ siteUrl: () => "https://www.helixon.co.uk" }));

const { applyTestAccountAction, createTestAccount, digestEmail, endsAtFor, mergeTimeline } = await import("./test-accounts");

// Records every query chain; `respond(table, calls)` answers it.
function fakeDb(respond = () => ({ data: null, error: null })) {
  const chains = [];
  return {
    chains,
    from(table) {
      const calls = [];
      chains.push({ table, calls });
      const chain = new Proxy(
        {},
        {
          get(_, name) {
            if (name === "then") return (resolve) => resolve(respond(table, calls));
            return (...args) => {
              calls.push([name, ...args]);
              return chain;
            };
          },
        },
      );
      return chain;
    },
  };
}

function fakeClerk() {
  return {
    users: {
      getUserList: vi.fn(async () => ({ data: [] })),
      createUser: vi.fn(async () => ({ id: "user_abc" })),
      deleteUser: vi.fn(async () => ({})),
      updateUser: vi.fn(async () => ({})),
    },
  };
}

const INPUT = { name: "Ana Silva", email: "Ana@Example.com", agencyName: "Silva Talent", days: 14, screeningCap: 50 };

beforeEach(() => {
  profile.create.mockReset();
});

describe("endsAtFor", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  it("is that many days on", () => {
    expect(endsAtFor(7, now)).toBe("2026-10-23T12:00:00.000Z");
    expect(endsAtFor(30, now)).toBe("2026-11-15T12:00:00.000Z");
  });
  it("is no end date for nothing, zero or text", () => {
    expect(endsAtFor(null, now)).toBe(null);
    expect(endsAtFor(0, now)).toBe(null);
    expect(endsAtFor("none", now)).toBe(null);
  });
  it("stops at a year", () => {
    expect(endsAtFor(5000, now)).toBe(new Date(now + 365 * 86400e3).toISOString());
  });
});

describe("mergeTimeline", () => {
  it("puts the newest first across sources and keeps 200", () => {
    const a = [{ at: "2026-10-01T00:00:00Z", text: "a" }];
    const b = Array.from({ length: 250 }, (_, i) => ({ at: new Date(Date.UTC(2026, 9, 2, 0, i)).toISOString(), text: `b${i}` }));
    const merged = mergeTimeline([a, b, null]);
    expect(merged.length).toBe(200);
    expect(merged[0].text).toBe("b249");
    expect(merged.some((e) => e.text === "a")).toBe(false);
  });
});

describe("createTestAccount", () => {
  it("creates the login, workspace, demo access and record, and returns the password once", async () => {
    profile.create.mockResolvedValue({ profileId: "p1", agencyId: "a1" });
    const db = fakeDb((table) => (table === "test_accounts" ? { data: { id: "t1", agency_id: "a1" }, error: null } : { data: null, error: null }));
    const client = fakeClerk();
    const result = await createTestAccount({ client, supabase: db, input: INPUT, admin: { username: "conor" } });

    expect(result.password).toBe("abcde-fghjk-mnpqr-stuvw");
    expect(result.signInUrl).toBe("https://www.helixon.co.uk/login");
    const created = client.users.createUser.mock.calls[0][0];
    expect(created.emailAddress).toEqual(["ana@example.com"]);
    expect(created.publicMetadata).toMatchObject({ is_test_user: true, helixon_test_account: true });
    expect(profile.create.mock.calls[0][0]).toMatchObject({ clerkUserId: "user_abc", agencyName: "Silva Talent", plan: "agency", firstName: "Ana", lastName: "Silva" });

    const sub = db.chains.find((c) => c.table === "subscriptions").calls.find(([m]) => m === "upsert")[1];
    expect(sub).toMatchObject({ user_id: "p1", status: "active", stripe_subscription_id: null, plan: "agency" });
    expect(sub.demo_expires_at).toBeTruthy();
    const cap = db.chains.find((c) => c.table === "agencies").calls.find(([m]) => m === "update")[1];
    expect(cap).toEqual({ screening_cap: 50 });
    const row = db.chains.find((c) => c.table === "test_accounts").calls.find(([m]) => m === "insert")[1];
    expect(row).toMatchObject({ agency_id: "a1", clerk_user_id: "user_abc", email: "ana@example.com", created_by: "conor", ends_at: sub.demo_expires_at });
  });

  it("refuses an email that already has a login", async () => {
    const client = fakeClerk();
    client.users.getUserList.mockResolvedValue({ data: [{ id: "user_x" }] });
    const result = await createTestAccount({ client, supabase: fakeDb(), input: INPUT, admin: { username: "conor" } });
    expect(result.status).toBe(409);
    expect(client.users.createUser).not.toHaveBeenCalled();
  });

  it("removes the Clerk user when the workspace can't be created", async () => {
    profile.create.mockRejectedValue(new Error("db down"));
    const client = fakeClerk();
    await expect(createTestAccount({ client, supabase: fakeDb(), input: INPUT, admin: { username: "conor" } })).rejects.toThrow("db down");
    expect(client.users.deleteUser).toHaveBeenCalledWith("user_abc");
  });

  it("removes the agency and the Clerk user when a later step fails", async () => {
    profile.create.mockResolvedValue({ profileId: "p1", agencyId: "a1" });
    const db = fakeDb((table) => (table === "test_accounts" ? { data: null, error: { message: "insert failed" } } : { data: null, error: null }));
    const client = fakeClerk();
    await expect(createTestAccount({ client, supabase: db, input: INPUT, admin: { username: "conor" } })).rejects.toThrow("insert failed");
    expect(client.users.deleteUser).toHaveBeenCalledWith("user_abc");
    expect(db.chains.some((c) => c.table === "agencies" && c.calls.some(([m]) => m === "delete"))).toBe(true);
  });

  it("needs a valid email and a name", async () => {
    expect((await createTestAccount({ client: fakeClerk(), supabase: fakeDb(), input: { ...INPUT, email: "nope" }, admin: {} })).status).toBe(400);
    expect((await createTestAccount({ client: fakeClerk(), supabase: fakeDb(), input: { ...INPUT, name: " " }, admin: {} })).status).toBe(400);
  });
});

describe("applyTestAccountAction", () => {
  const account = { id: "t1", agency_id: "a1", clerk_user_id: "user_abc", ends_at: null };
  const answers = (table) => (table === "profiles" ? { data: { id: "p1" }, error: null } : { data: null, error: null });

  it("end only updates demo rows, never a Stripe subscription", async () => {
    const db = fakeDb(answers);
    await applyTestAccountAction({ client: fakeClerk(), supabase: db, account, action: "end", body: {} });
    const sub = db.chains.find((c) => c.table === "subscriptions").calls;
    expect(sub.find(([m]) => m === "update")[1]).toMatchObject({ status: "canceled" });
    expect(sub).toContainEqual(["is", "stripe_subscription_id", null]);
    const row = db.chains.find((c) => c.table === "test_accounts").calls.find(([m]) => m === "update")[1];
    expect(row.ended_at).toBeTruthy();
  });

  it("extend sets a new end date and turns access back on", async () => {
    const db = fakeDb(answers);
    await applyTestAccountAction({ client: fakeClerk(), supabase: db, account, action: "extend", body: { days: 7 } });
    const sub = db.chains.find((c) => c.table === "subscriptions").calls;
    expect(sub.find(([m]) => m === "update")[1]).toMatchObject({ status: "active" });
    expect(sub).toContainEqual(["is", "stripe_subscription_id", null]);
    expect(db.chains.find((c) => c.table === "test_accounts").calls.find(([m]) => m === "update")[1]).toMatchObject({ ended_at: null });
  });

  it("reset_password sets and returns a new password", async () => {
    const client = fakeClerk();
    const result = await applyTestAccountAction({ client, supabase: fakeDb(answers), account, action: "reset_password", body: {} });
    expect(client.users.updateUser).toHaveBeenCalledWith("user_abc", { password: "abcde-fghjk-mnpqr-stuvw" });
    expect(result.password).toBe("abcde-fghjk-mnpqr-stuvw");
  });

  it("set_cap needs a whole number from 1 to 10000", async () => {
    expect((await applyTestAccountAction({ client: fakeClerk(), supabase: fakeDb(), account, action: "set_cap", body: { cap: 0 } })).status).toBe(400);
    const db = fakeDb();
    await applyTestAccountAction({ client: fakeClerk(), supabase: db, account, action: "set_cap", body: { cap: 120 } });
    expect(db.chains.find((c) => c.table === "agencies").calls.find(([m]) => m === "update")[1]).toEqual({ screening_cap: 120 });
  });

  it("refuses changes once the account has bought a plan", async () => {
    const result = await applyTestAccountAction({ client: fakeClerk(), supabase: fakeDb(), account: { ...account, converted_at: "2026-10-10T00:00:00Z" }, action: "end", body: {} });
    expect(result.status).toBe(409);
  });
});

describe("digestEmail", () => {
  const base = { name: "Ana", email: "ana@example.com", agencyName: "Silva", screenings: 0, candidates: 0, jobs: 0, seen: false, expiredToday: false };
  it("is nothing on a quiet day", () => {
    expect(digestEmail([base])).toBe(null);
  });
  it("lists active accounts and expiries, escaped", () => {
    const mail = digestEmail([{ ...base, screenings: 3, seen: true }, { ...base, name: "<Bo>", expiredToday: true }]);
    expect(mail.subject).toBe("Test accounts: 1 active, 1 expired in the last day");
    expect(mail.html).toMatch(/Ana.*3 screenings/s);
    expect(mail.html).toContain("&lt;Bo&gt;");
    expect(mail.html).not.toContain("<Bo>");
  });
});
