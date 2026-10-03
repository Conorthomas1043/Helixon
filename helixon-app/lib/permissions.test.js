import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/workspace-admin", () => ({ canManageWorkspace: vi.fn() }));

const { canSeeCandidate, cleanPermissions, normalisePermissions, redactPlacement, scopeCandidateQuery } = await import("./permissions");

describe("permissions", () => {
  it("defaults to everything visible", () => {
    expect(normalisePermissions({})).toEqual({ financialsAdminOnly: false, ownCandidatesOnly: false });
    expect(normalisePermissions({ permissions: { financialsAdminOnly: true, ownCandidatesOnly: "yes" } })).toEqual({ financialsAdminOnly: true, ownCandidatesOnly: false });
  });

  it("keeps only known boolean settings", () => {
    expect(cleanPermissions({ financialsAdminOnly: true, ownCandidatesOnly: "x", other: true })).toEqual({ financialsAdminOnly: true });
  });

  it("limits candidates to your own and unassigned", () => {
    const auth = { userId: "me" };
    const limited = { seesAllCandidates: false };
    expect(canSeeCandidate(limited, auth, { recruiter_id: "me" })).toBe(true);
    expect(canSeeCandidate(limited, auth, { recruiter_id: null })).toBe(true);
    expect(canSeeCandidate(limited, auth, { recruiter_id: "other" })).toBe(false);
    expect(canSeeCandidate({ seesAllCandidates: true }, auth, { recruiter_id: "other" })).toBe(true);

    const q = { or: vi.fn((f) => f) };
    expect(scopeCandidateQuery(q, limited, auth)).toBe("recruiter_id.is.null,recruiter_id.eq.me");
    expect(scopeCandidateQuery(q, { seesAllCandidates: true }, auth)).toBe(q);
  });

  it("blanks money for members who can't see financials", () => {
    const p = { id: "p", salary: 50000, feeAmount: 9000, payRate: 1, chargeRate: 2, feePercent: 18, invoices: [{}] };
    expect(redactPlacement(p, { canSeeFinancials: true })).toBe(p);
    expect(redactPlacement(p, { canSeeFinancials: false })).toMatchObject({ id: "p", salary: null, feeAmount: null, invoices: [], financialsHidden: true });
  });
});
