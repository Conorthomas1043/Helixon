// The routes that change agency data, called for real against an in-memory
// database holding two agencies. A member of agency A must be able to work
// on A's records, and must get "Not found" (with nothing written) for B's,
// whatever id they send.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "@/test/fake-db";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ids = {
  candA: "11111111-1111-4111-8111-11111111111a",
  candB: "11111111-1111-4111-8111-11111111111b",
  placeA: "22222222-2222-4222-8222-22222222222a",
  placeB: "22222222-2222-4222-8222-22222222222b",
  invB: "33333333-3333-4333-8333-33333333333b",
  clientA: "44444444-4444-4444-8444-44444444444a",
  clientB: "44444444-4444-4444-8444-44444444444b",
};

const state = vi.hoisted(() => ({ db: null, auth: null }));

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return state.db;
  },
}));
vi.mock("@/lib/agency-db", () => ({ agencyDb: async () => state.db }));
vi.mock("@/lib/customer-auth", () => ({ requireCustomerContext: async () => state.auth }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal()), after: vi.fn() }));
vi.mock("@/lib/permissions", () => ({
  candidateHidden: async () => null,
  getAccess: async () => ({ seesAllCandidates: true, canSeeFinancials: true }),
  redactPlacement: (p) => p,
  canSeeCandidate: () => true,
  scopeCandidateQuery: (q) => q,
}));
vi.mock("@/lib/candidate-activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/agency-audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/webhooks", () => ({ emitWebhook: vi.fn() }));
vi.mock("@/lib/placement-sync", () => ({ syncCandidate: vi.fn(), splitsAreTeammates: async () => true }));
vi.mock("@/lib/recruiter-directory", () => ({ recruiterDisplayName: () => "Ada", resolveRecruiterNames: async () => new Map() }));
vi.mock("@/lib/integrations/accounting-sync", () => ({ syncInvoiceToAccounts: vi.fn() }));
vi.mock("@/lib/candidate-erasure", () => ({
  eraseCandidates: vi.fn(async (db, agencyId, list) => {
    db.tables.candidates = db.tables.candidates.filter((c) => !(list.includes(c.id) && c.agency_id === agencyId));
    return { erased: list.length };
  }),
}));
vi.mock("@/lib/clients", async (importOriginal) => ({ ...(await importOriginal()), logClientActivity: vi.fn() }));

const placements = await import("./placements/route");
const placement = await import("./placements/[id]/route");
const invoice = await import("./invoices/[id]/route");
const clients = await import("./clients/route");
const client = await import("./clients/[id]/route");
const candidate = await import("./candidates/[id]/route");

const call = (handler, { method = "GET", body, id, query = "" } = {}) =>
  handler(
    new Request(`http://x.test/api/thing${query}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );

beforeEach(() => {
  state.auth = { ok: true, agencyId: A, userId: "user_a", profile: { id: "p1" } };
  state.db = fakeDb({
    candidates: [
      { id: ids.candA, agency_id: A, full_name: "Ada (A)", job_id: null, stage: "Screened", extracted: {} },
      { id: ids.candB, agency_id: B, full_name: "Bo (B)", job_id: null, stage: "Screened", extracted: {} },
    ],
    placements: [
      { id: ids.placeA, agency_id: A, candidate_id: ids.candA, status: "offered", kind: "permanent", candidate_name: "Ada (A)" },
      { id: ids.placeB, agency_id: B, candidate_id: ids.candB, status: "offered", kind: "permanent", candidate_name: "Bo (B)" },
    ],
    invoices: [{ id: ids.invB, agency_id: B, placement_id: ids.placeB, status: "draft" }],
    clients: [
      { id: ids.clientA, agency_id: A, name: "Acme (A)", status: "active" },
      { id: ids.clientB, agency_id: B, name: "Bravo (B)", status: "active" },
    ],
    profiles: [],
  });
});

const row = (table, id) => state.db.tables[table].find((r) => r.id === id);

describe("signed out", () => {
  it("can't change anything", async () => {
    state.auth = { ok: false, status: 401, error: "Please sign in to continue." };
    const res = await call(placements.POST, { method: "POST", body: { candidateId: ids.candA } });
    expect(res.status).toBe(401);
    expect(state.db.writes()).toEqual([]);
  });
});

describe("placements", () => {
  it("records a placement for the member's own candidate, in their agency", async () => {
    const res = await call(placements.POST, { method: "POST", body: { candidateId: ids.candA } });
    expect(res.status).toBe(201);
    const created = state.db.tables.placements.at(-1);
    expect(created).toMatchObject({ agency_id: A, candidate_id: ids.candA });
  });

  it("won't record one for another agency's candidate", async () => {
    const before = state.db.tables.placements.length;
    const res = await call(placements.POST, { method: "POST", body: { candidateId: ids.candB } });
    expect(res.status).toBe(404);
    expect(state.db.tables.placements.length).toBe(before);
  });

  it("won't update or delete another agency's placement", async () => {
    expect((await call(placement.PATCH, { method: "PATCH", id: ids.placeB, body: { status: "started" } })).status).toBe(404);
    expect(row("placements", ids.placeB).status).toBe("offered");
    expect((await call(placement.DELETE, { method: "DELETE", id: ids.placeB })).status).toBe(404);
    expect(row("placements", ids.placeB)).toBeTruthy();
  });

  it("rejects a malformed body before touching the database", async () => {
    const res = await call(placements.POST, { method: "POST", body: { candidateId: ids.candA, splits: "half each" } });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^splits/);
    expect(state.db.writes()).toEqual([]);
  });
});

describe("invoices", () => {
  it("won't mark another agency's invoice paid", async () => {
    const res = await call(invoice.PATCH, { method: "PATCH", id: ids.invB, body: { status: "paid", paidOn: "2026-10-01" } });
    expect(res.status).toBe(404);
    expect(row("invoices", ids.invB).status).toBe("draft");
  });
});

describe("clients", () => {
  it("creates a client in the member's agency", async () => {
    const res = await call(clients.POST, { method: "POST", body: { name: "New Co" } });
    expect(res.status).toBe(201);
    expect(state.db.tables.clients.at(-1)).toMatchObject({ name: "New Co", agency_id: A });
  });

  it("won't read, update or delete another agency's client", async () => {
    expect((await call(client.GET, { id: ids.clientB })).status).toBe(404);
    expect((await call(client.PATCH, { method: "PATCH", id: ids.clientB, body: { name: "Hijacked" } })).status).toBe(404);
    expect(row("clients", ids.clientB).name).toBe("Bravo (B)");
    expect((await call(client.DELETE, { method: "DELETE", id: ids.clientB })).status).toBe(404);
    expect(row("clients", ids.clientB)).toBeTruthy();
  });

  it("updates the member's own client", async () => {
    const res = await call(client.PATCH, { method: "PATCH", id: ids.clientA, body: { name: "Acme Ltd" } });
    expect(res.status).toBe(200);
    expect(row("clients", ids.clientA).name).toBe("Acme Ltd");
  });
});

describe("candidates", () => {
  it("won't show, edit or delete another agency's candidate", async () => {
    expect((await call(candidate.GET, { id: ids.candB })).status).toBe(404);
    expect((await call(candidate.PATCH, { method: "PATCH", id: ids.candB, body: { fullName: "Hijacked" } })).status).toBe(404);
    expect(row("candidates", ids.candB).full_name).toBe("Bo (B)");
    expect((await call(candidate.DELETE, { method: "DELETE", id: ids.candB })).status).toBe(404);
    expect(row("candidates", ids.candB)).toBeTruthy();
  });

  it("deletes the member's own candidate", async () => {
    const res = await call(candidate.DELETE, { method: "DELETE", id: ids.candA });
    expect(res.status).toBe(200);
    expect(row("candidates", ids.candA)).toBeUndefined();
  });
});
