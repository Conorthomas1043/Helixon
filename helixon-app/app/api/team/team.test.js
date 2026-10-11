// Team management - roles, invites, removing someone - against an in-memory
// database and a stubbed Clerk organisation. Who may do what is the point:
// only the owner or an admin manages the team, the owner can't be demoted
// or removed, and nothing reaches into another agency.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "@/test/fake-db";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ORG = "org_a";

const state = vi.hoisted(() => ({ db: null, auth: null, roles: {}, creator: "owner", seats: 2, plan: "agency" }));
const clerk = vi.hoisted(() => ({
  setOrgMemberRole: vi.fn(),
  inviteToAgencyOrg: vi.fn(),
  revokeAgencyOrgInvitation: vi.fn(),
  removeAgencyOrgMember: vi.fn(),
}));
const logAudit = vi.hoisted(() => vi.fn());
const revokeMemberTokens = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return state.db;
  },
}));
vi.mock("@/lib/agency-db", () => ({ agencyDb: async () => state.db }));
vi.mock("@/lib/auth/customer-auth", () => ({ requireCustomerContext: async () => state.auth }));
vi.mock("@/lib/billing/plan", () => ({ getAgencyPlan: async () => state.plan }));
vi.mock("@/lib/ratelimit", () => ({ getClientIp: () => "203.0.113.9", rateLimit: async () => true }));
vi.mock("@/lib/auth/clerk-org", () => ({
  AGENCY_SEAT_LIMIT: 5,
  getOrgMemberRole: async ({ userId }) => state.roles[userId] ?? null,
  getOrgCreatorId: async () => state.creator,
  ensureAgencyOrg: async () => ORG,
  getOrgSeatUsage: async () => ({ used: 5 - state.seats, remaining: state.seats }),
  listOrgMembers: async () => [],
  ...clerk,
}));
vi.mock("@/lib/agency/audit", () => ({ logAudit: (...a) => logAudit(...a) }));
vi.mock("@/lib/agency/member-tokens", () => ({ revokeMemberTokens: (...a) => revokeMemberTokens(...a) }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

const role = await import("./role/route");
const invite = await import("./invite/route");

const call = (handler, { method = "POST", body } = {}) =>
  handler(
    new Request("http://x.test/api/team", {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({}) }
  );

beforeEach(() => {
  state.auth = { ok: true, agencyId: A, userId: "owner", profile: { id: "p-owner", first_name: "Olive" } };
  state.roles = { owner: "org:admin", admin: "org:admin", member: "org:member", member2: "org:member" };
  state.creator = "owner";
  state.seats = 2;
  state.plan = "agency";
  state.db = fakeDb({
    agencies: [
      { id: A, name: "Northgate", clerk_org_id: ORG },
      { id: B, name: "Other", clerk_org_id: "org_b" },
    ],
    profiles: [
      { id: "p-owner", clerk_user_id: "owner", agency_id: A, first_name: "Olive" },
      { id: "p-admin", clerk_user_id: "admin", agency_id: A, first_name: "Ada" },
      { id: "p-member", clerk_user_id: "member", agency_id: A, first_name: "Max" },
      { id: "p-member2", clerk_user_id: "member2", agency_id: A, first_name: "Mia" },
      { id: "p-outsider", clerk_user_id: "outsider", agency_id: B, first_name: "Otto" },
    ],
    candidates: [
      { id: "c1", agency_id: A, recruiter_id: "member" },
      { id: "c2", agency_id: A, recruiter_id: "member" },
      { id: "c3", agency_id: B, recruiter_id: "member" }, // same id string in another agency: untouched
    ],
    candidate_activity: [],
  });
  for (const fn of Object.values(clerk)) fn.mockReset();
  logAudit.mockReset();
  revokeMemberTokens.mockReset();
});

describe("POST /api/team/role", () => {
  it("lets the owner or an admin make a member an admin, and records it", async () => {
    state.auth.userId = "admin";
    const res = await call(role.POST, { body: { userId: "member", role: "admin" } });
    expect(await res.json()).toEqual({ ok: true, role: "admin" });
    expect(clerk.setOrgMemberRole).toHaveBeenCalledWith({ orgId: ORG, userId: "member", role: "org:admin" });
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "team.role_changed" }));
  });

  it("doesn't call Clerk when the role is already right", async () => {
    await call(role.POST, { body: { userId: "member", role: "member" } });
    expect(clerk.setOrgMemberRole).not.toHaveBeenCalled();
  });

  it.each([
    ["a member", { as: "member", body: { userId: "member2", role: "admin" } }, 403],
    ["anyone changing their own role", { as: "admin", body: { userId: "admin", role: "member" } }, 400],
    ["anyone demoting the owner", { as: "admin", body: { userId: "owner", role: "member" } }, 400],
    ["a target in another agency", { as: "owner", body: { userId: "outsider", role: "admin" } }, 404],
    ["a missing role", { as: "owner", body: { userId: "member" } }, 400],
  ])("refuses %s", async (_label, { as, body }, status) => {
    state.auth.userId = as;
    state.roles.outsider = "org:member";
    expect((await call(role.POST, { body })).status).toBe(status);
    expect(clerk.setOrgMemberRole).not.toHaveBeenCalled();
  });

  it("needs a team workspace first", async () => {
    state.db.tables.agencies[0].clerk_org_id = null;
    expect((await call(role.POST, { body: { userId: "member", role: "admin" } })).status).toBe(404);
  });
});

describe("POST /api/team/invite", () => {
  it("sends an invite for the owner while seats remain", async () => {
    const res = await call(invite.POST, { body: { email: "new@example.com" } });
    expect(res.status).toBe(200);
    expect(clerk.inviteToAgencyOrg).toHaveBeenCalledWith({ orgId: ORG, inviterUserId: "owner", email: "new@example.com" });
  });

  it.each([
    ["members", () => (state.auth.userId = "member"), 403],
    ["agencies not on the Agency plan", () => (state.plan = "individual"), 403],
    ["a full team", () => (state.seats = 0), 409],
  ])("refuses %s", async (_label, setup, status) => {
    setup();
    expect((await call(invite.POST, { body: { email: "new@example.com" } })).status).toBe(status);
    expect(clerk.inviteToAgencyOrg).not.toHaveBeenCalled();
  });

  it("rejects an invalid address", async () => {
    expect((await call(invite.POST, { body: { email: "not-an-email" } })).status).toBe(400);
  });

  it("gives the same answer whatever Clerk says, so it can't reveal who has an account", async () => {
    clerk.inviteToAgencyOrg.mockRejectedValue({ errors: [{ longMessage: "already a member of this organization" }] });
    const body = await (await call(invite.POST, { body: { email: "taken@example.com" } })).json();
    expect(body.error).not.toMatch(/already a member/);
  });
});

describe("DELETE /api/team/invite (removing a teammate)", () => {
  it("removes a member, detaches their profile, revokes their links and hands their candidates over", async () => {
    const res = await call(invite.DELETE, { method: "DELETE", body: { userId: "member", reassignTo: "member2" } });
    expect(await res.json()).toEqual({ ok: true, reassigned: 2 });
    expect(clerk.removeAgencyOrgMember).toHaveBeenCalledWith({ orgId: ORG, userId: "member" });
    expect(state.db.tables.profiles.find((p) => p.clerk_user_id === "member").agency_id).toBeNull();
    expect(revokeMemberTokens).toHaveBeenCalledWith("member", A);
    const recruiters = Object.fromEntries(state.db.tables.candidates.map((c) => [c.id, c.recruiter_id]));
    expect(recruiters).toEqual({ c1: "member2", c2: "member2", c3: "member" });
  });

  it.each([
    ["a member doing it", { as: "member", body: { userId: "member2" } }, 403],
    ["removing yourself", { as: "owner", body: { userId: "owner" } }, 400],
    ["removing an admin (or the owner)", { as: "owner", body: { userId: "admin" } }, 400],
    ["someone not on the team", { as: "owner", body: { userId: "outsider" } }, 404],
    ["handing candidates to someone outside the team", { as: "owner", body: { userId: "member", reassignTo: "outsider" } }, 400],
  ])("refuses %s, changing nothing", async (_label, { as, body }, status) => {
    state.auth.userId = as;
    expect((await call(invite.DELETE, { method: "DELETE", body })).status).toBe(status);
    expect(clerk.removeAgencyOrgMember).not.toHaveBeenCalled();
    expect(state.db.writes()).toEqual([]);
  });
});

describe("PATCH /api/team/invite (unassigned candidates)", () => {
  it("hands every unassigned candidate in the agency to one member", async () => {
    state.db.tables.candidates.push({ id: "c4", agency_id: A, recruiter_id: null }, { id: "c5", agency_id: A, recruiter_id: "gone" });
    const res = await call(invite.PATCH, { method: "PATCH", body: { reassignUnassignedTo: "member2" } });
    expect(await res.json()).toEqual({ ok: true, reassigned: 2 });
    expect(state.db.tables.candidates.find((c) => c.id === "c4").recruiter_id).toBe("member2");
    expect(state.db.tables.candidates.find((c) => c.id === "c1").recruiter_id).toBe("member");
  });

  it("is owner or admin only", async () => {
    state.auth.userId = "member";
    expect((await call(invite.PATCH, { method: "PATCH", body: { reassignUnassignedTo: "member2" } })).status).toBe(403);
  });
});
