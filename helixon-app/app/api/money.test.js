// The routes that touch money - billing and invoices - called for real
// against an in-memory database holding two agencies. Stripe is stubbed.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "@/test/fake-db";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const INV_A = "33333333-3333-4333-8333-33333333333a";
const INV_A_VOID = "33333333-3333-4333-8333-3333333333a2";
const INV_B = "33333333-3333-4333-8333-33333333333b";

const state = vi.hoisted(() => ({ db: null, auth: null, context: null, access: null }));
const portalCreate = vi.hoisted(() => vi.fn());
const emitWebhook = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return state.db;
  },
}));
vi.mock("@/lib/agency-db", () => ({ agencyDb: async () => state.db }));
vi.mock("@/lib/customer-auth", () => ({
  requireCustomerContext: async () => state.auth,
  getCustomerContext: async () => state.context,
}));
vi.mock("@/lib/permissions", () => ({ getAccess: async () => state.access }));
vi.mock("@/lib/plan", () => ({ getAgencyPlan: async () => "agency" }));
vi.mock("@/lib/stripe", () => ({ stripe: { billingPortal: { sessions: { create: (...a) => portalCreate(...a) } } } }));
vi.mock("@/lib/webhooks", () => ({ emitWebhook: (...a) => emitWebhook(...a) }));
vi.mock("@/lib/agency-audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/integrations/accounting-sync", () => ({ accountingConnection: async () => null }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal()), after: (fn) => fn() }));

const billing = await import("./billing/route");
const portal = await import("./billing/portal/route");
const invoices = await import("./invoices/route");
const invoice = await import("./invoices/[id]/route");

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
  state.auth = { ok: true, agencyId: A, userId: "user_a", profile: { id: "pa" } };
  state.context = { user: { id: "user_a" }, agencyId: A, profile: { id: "pa", agency_id: A } };
  state.access = { canSeeFinancials: true, seesAllCandidates: true };
  state.db = fakeDb({
    agencies: [
      { id: A, name: "Northgate", plan_name: "agency", analyses_used: 4, settings: {} },
      { id: B, name: "Other", plan_name: "individual", analyses_used: 9, settings: {} },
    ],
    subscriptions: [
      { user_id: "pa", plan: "agency", status: "active", stripe_customer_id: "cus_A", updated_at: "2026-10-01" },
      { user_id: "pb", plan: "individual", status: "active", stripe_customer_id: "cus_B", updated_at: "2026-10-01" },
    ],
    invoices: [
      { id: INV_A, agency_id: A, number: "INV-1", status: "sent", issued_on: "2026-10-01", total: 1000 },
      { id: INV_A_VOID, agency_id: A, number: "INV-2", status: "void", issued_on: "2026-09-01", total: 500 },
      { id: INV_B, agency_id: B, number: "INV-9", status: "sent", issued_on: "2026-10-02", total: 9000 },
    ],
    timesheets: [
      { id: "ts1", agency_id: A, invoice_id: INV_A, status: "invoiced" },
      { id: "ts2", agency_id: B, invoice_id: INV_A, status: "invoiced" }, // another agency's row, same id: untouched
    ],
  });
  portalCreate.mockReset();
  portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/session" });
  emitWebhook.mockReset();
});

describe("GET /api/billing", () => {
  it("needs a signed-in member", async () => {
    state.context = { user: null };
    expect((await billing.GET()).status).toBe(401);
  });

  it("shows the member's own agency and subscription, never another's", async () => {
    const body = await (await billing.GET()).json();
    expect(body).toMatchObject({ ok: true, agencyName: "Northgate", plan: "agency", analysesUsed: 4 });
    expect(body.subscription).toMatchObject({ plan: "agency", hasStripeCustomer: true });
    expect(JSON.stringify(body)).not.toContain("cus_"); // the customer id itself stays server-side
  });
});

describe("POST /api/billing/portal", () => {
  it("opens Stripe's portal for the member's own customer only", async () => {
    const body = await (await portal.POST()).json();
    expect(body).toEqual({ ok: true, redirectTo: "https://billing.stripe.test/session" });
    expect(portalCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_A" }));
  });

  it("refuses without a sign-in, a profile, or a Stripe customer", async () => {
    state.context = { user: null };
    expect((await portal.POST()).status).toBe(401);
    state.context = { user: { id: "u" }, profile: null };
    expect((await portal.POST()).status).toBe(403);
    state.context = { user: { id: "u" }, profile: { id: "no-sub" } };
    expect((await portal.POST()).status).toBe(404);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("says so when Stripe fails", async () => {
    portalCreate.mockRejectedValue(new Error("stripe down"));
    expect((await portal.POST()).status).toBe(500);
  });
});

describe("invoices", () => {
  it("are hidden from members who can't see money", async () => {
    state.access = { canSeeFinancials: false };
    expect((await call(invoices.GET)).status).toBe(403);
    expect((await call(invoice.GET, { id: INV_A })).status).toBe(403);
    expect((await call(invoice.PATCH, { method: "PATCH", id: INV_A, body: { status: "paid" } })).status).toBe(403);
    expect(state.db.tables.invoices.find((i) => i.id === INV_A).status).toBe("sent");
  });

  it("lists only the agency's own invoices, filtered by status", async () => {
    const all = await (await call(invoices.GET)).json();
    expect(all.invoices.map((i) => i.id).sort()).toEqual([INV_A, INV_A_VOID].sort());
    const voided = await (await call(invoices.GET, { query: "?status=void" })).json();
    expect(voided.invoices.map((i) => i.id)).toEqual([INV_A_VOID]);
  });

  it("marks one paid, with today's date unless one is given, and tells webhooks", async () => {
    const res = await call(invoice.PATCH, { method: "PATCH", id: INV_A, body: { status: "paid", paidOn: "2026-10-05" } });
    expect(res.status).toBe(200);
    expect(state.db.tables.invoices.find((i) => i.id === INV_A)).toMatchObject({ status: "paid", paid_on: "2026-10-05" });
    expect(emitWebhook).toHaveBeenCalledWith(A, "invoice.paid", expect.objectContaining({ id: INV_A }));
  });

  it("rejects draft or unknown statuses", async () => {
    for (const status of ["draft", "lost", undefined]) {
      expect((await call(invoice.PATCH, { method: "PATCH", id: INV_A, body: { status } })).status).toBe(400);
    }
  });

  it("voids one and puts only this agency's timesheets back to approved", async () => {
    await call(invoice.PATCH, { method: "PATCH", id: INV_A, body: { status: "void" } });
    expect(state.db.tables.invoices.find((i) => i.id === INV_A).status).toBe("void");
    expect(state.db.tables.timesheets.find((t) => t.id === "ts1")).toMatchObject({ status: "approved", invoice_id: null });
    expect(state.db.tables.timesheets.find((t) => t.id === "ts2")).toMatchObject({ status: "invoiced", invoice_id: INV_A });
  });

  it("won't change a void invoice", async () => {
    const res = await call(invoice.PATCH, { method: "PATCH", id: INV_A_VOID, body: { status: "paid" } });
    expect(res.status).toBe(409);
    expect(state.db.tables.invoices.find((i) => i.id === INV_A_VOID).status).toBe("void");
  });

  it("treats another agency's invoice as not found", async () => {
    expect((await call(invoice.GET, { id: INV_B })).status).toBe(404);
    expect((await call(invoice.PATCH, { method: "PATCH", id: INV_B, body: { status: "paid" } })).status).toBe(404);
    expect(state.db.tables.invoices.find((i) => i.id === INV_B).status).toBe("sent");
  });
});
