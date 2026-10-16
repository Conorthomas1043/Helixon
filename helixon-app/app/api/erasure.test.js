// Erasing candidates - the right-to-erasure tool - with the real erasure
// code against an in-memory database holding two agencies. Every row that
// names the person goes, nothing of another agency's is touched, and a
// member limited to their own candidates can't erase a colleague's.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "@/test/fake-db";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const ROOT = "11111111-1111-4111-8111-11111111111a";
const RESCREEN = "11111111-1111-4111-8111-1111111111a2";
const OTHER = "11111111-1111-4111-8111-1111111111a3";
const COLLEAGUES = "11111111-1111-4111-8111-1111111111a4";
const THEIRS = "11111111-1111-4111-8111-11111111111b";

const state = vi.hoisted(() => ({ db: null, auth: null, access: null, admin: true }));
const removeCandidateCvs = vi.hoisted(() => vi.fn(async () => null));
const logAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return state.db;
  },
}));
vi.mock("@/lib/agency-db", () => ({ agencyDb: async () => state.db }));
vi.mock("@/lib/auth/customer-auth", () => ({ requireCustomerContext: async () => state.auth }));
vi.mock("@/lib/agency/permissions", async (importOriginal) => ({
  ...(await importOriginal()),
  candidateHidden: async () => null,
  getAccess: async () => state.access,
}));
vi.mock("@/lib/agency/workspace-admin", () => ({ canManageWorkspace: async () => state.admin }));
vi.mock("@/lib/candidates/files", () => ({ removeCandidateCvs: (...a) => removeCandidateCvs(...a) }));
vi.mock("@/lib/compliance/files", () => ({ removeComplianceDocuments: async () => null }));
vi.mock("@/lib/agency/audit", () => ({ logAudit: (...a) => logAudit(...a) }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

const candidate = await import("./candidates/[id]/route");
const bulk = await import("./candidates/bulk/route");

const call = (handler, { method = "DELETE", body, id, query = "" } = {}) =>
  handler(
    new Request(`http://x.test/api/candidates${query}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) }
  );

const ids = (table) => state.db.tables[table].map((r) => r.id).sort();

beforeEach(() => {
  state.auth = { ok: true, agencyId: A, userId: "user_a", profile: { id: "pa" } };
  state.access = { seesAllCandidates: true, canSeeFinancials: true };
  state.admin = true;
  state.db = fakeDb({
    candidates: [
      { id: ROOT, agency_id: A, recruiter_id: "user_a", pooled_from_id: null, cv_file_url: "cvs/root.pdf" },
      { id: RESCREEN, agency_id: A, recruiter_id: "user_a", pooled_from_id: ROOT, cv_file_url: "cvs/rescreen.pdf" },
      { id: OTHER, agency_id: A, recruiter_id: "user_a", pooled_from_id: null },
      { id: COLLEAGUES, agency_id: A, recruiter_id: "colleague", pooled_from_id: ROOT },
      { id: THEIRS, agency_id: B, recruiter_id: "user_b", pooled_from_id: null },
    ],
    scores: [
      { id: "s-root", candidate_id: ROOT },
      { id: "s-other", candidate_id: OTHER },
      { id: "s-theirs", candidate_id: THEIRS },
    ],
    feedback: [{ id: "f1", score_id: "s-root" }],
    shortlist_candidates: [{ id: "sl1", candidate_id: ROOT, score_id: "s-root" }],
    artifacts: [{ id: "a1", candidate_id: ROOT }],
    candidate_notes: [
      { id: "n1", candidate_id: ROOT },
      { id: "n2", candidate_id: THEIRS },
    ],
    compliance_checks: [],
    notifications: [{ id: "nt1", agency_id: A, href: `/dashboard/candidates/${ROOT}` }],
  });
  removeCandidateCvs.mockClear();
  logAudit.mockClear();
});

describe("DELETE /api/candidates/[id]", () => {
  it("erases the candidate and every row that references them, and nothing else", async () => {
    const res = await call(candidate.DELETE, { id: ROOT });
    expect(await res.json()).toEqual({ ok: true, erased: 1 });
    expect(ids("candidates")).toEqual([COLLEAGUES, OTHER, RESCREEN, THEIRS].sort());
    expect(ids("scores")).toEqual(["s-other", "s-theirs"]);
    expect(ids("feedback")).toEqual([]);
    expect(ids("shortlist_candidates")).toEqual([]);
    expect(ids("artifacts")).toEqual([]);
    expect(ids("candidate_notes")).toEqual(["n2"]);
    expect(ids("notifications")).toEqual([]);
    expect(removeCandidateCvs).toHaveBeenCalledWith(["cvs/root.pdf"]);
    expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "candidate.deleted" }));
  });

  it("with ?all=1, erases every record for the person across jobs", async () => {
    const res = await call(candidate.DELETE, { id: RESCREEN, query: "?all=1" });
    expect(await res.json()).toEqual({ ok: true, erased: 3 });
    expect(ids("candidates")).toEqual([OTHER, THEIRS].sort());
  });

  it("won't let an own-candidates-only member erase records assigned to a colleague", async () => {
    state.access = { seesAllCandidates: false };
    const res = await call(candidate.DELETE, { id: ROOT, query: "?all=1" });
    expect(res.status).toBe(403);
    expect(ids("candidates")).toHaveLength(5);
  });

  it("treats another agency's candidate as not found, and erases nothing", async () => {
    expect((await call(candidate.DELETE, { id: THEIRS })).status).toBe(404);
    expect(state.db.writes()).toEqual([]);
  });
});

describe("POST /api/candidates/bulk { action: 'delete' }", () => {
  it("erases the agency's own candidates and ignores anyone else's ids", async () => {
    const res = await call(bulk.POST, { method: "POST", body: { action: "delete", ids: [OTHER, THEIRS] } });
    expect(await res.json()).toEqual({ ok: true, updated: 1 });
    expect(ids("candidates")).toEqual([COLLEAGUES, RESCREEN, ROOT, THEIRS].sort());
    expect(ids("scores")).toEqual(["s-root", "s-theirs"]);
  });

  it("is for the owner and admins only", async () => {
    state.admin = false;
    const res = await call(bulk.POST, { method: "POST", body: { action: "delete", ids: [OTHER] } });
    expect(res.status).toBe(403);
    expect(state.db.writes()).toEqual([]);
  });

  it("only erases what the member can see", async () => {
    state.access = { seesAllCandidates: false };
    const res = await call(bulk.POST, { method: "POST", body: { action: "delete", ids: [OTHER, COLLEAGUES] } });
    expect(await res.json()).toEqual({ ok: true, updated: 1 });
    expect(ids("candidates")).toContain(COLLEAGUES);
    expect(ids("candidates")).not.toContain(OTHER);
  });
});
