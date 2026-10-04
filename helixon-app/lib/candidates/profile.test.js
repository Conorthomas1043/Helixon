import { beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for supabase-js: every builder method chains. .maybeSingle()
// and .single() give the table's canned row; awaiting the query itself gives
// its canned list.
const results = {};
const lists = {};
function table(name) {
  const q = {
    then: (resolve, reject) => Promise.resolve(lists[name] ?? { data: [], error: null }).then(resolve, reject),
  };
  for (const m of ["select", "eq", "in", "order", "limit", "is", "neq"]) q[m] = () => q;
  q.maybeSingle = () => Promise.resolve(results[name] ?? { data: null, error: null });
  q.single = q.maybeSingle;
  return q;
}
const client = { from: (name) => table(name) };

const hidden = vi.fn();
vi.mock("@/lib/supabase", () => ({ supabase: client }));
vi.mock("@/lib/agency-db", () => ({ agencyDb: async () => client }));
vi.mock("@/lib/permissions", () => ({ candidateHidden: (...a) => hidden(...a), getAccess: async () => ({ canSeeFinancials: false }) }));
vi.mock("@/lib/recruiter-directory", () => ({ resolveRecruiterNames: async () => new Map(), recruiterDisplayName: () => "" }));

const { loadCandidateProfile } = await import("./profile");
const auth = { ok: true, agencyId: "agency-1", userId: "user_1" };

describe("loadCandidateProfile", () => {
  beforeEach(() => {
    for (const k of Object.keys(results)) delete results[k];
    for (const k of Object.keys(lists)) delete lists[k];
    hidden.mockResolvedValue(null);
  });

  it("is not found when this member may not see the candidate", async () => {
    hidden.mockResolvedValue({ status: 404 });
    expect(await loadCandidateProfile(auth, "c1")).toEqual({ status: 404, error: "Not found" });
  });

  it("is not found when the candidate isn't in this agency", async () => {
    results.candidates = { data: null, error: null };
    expect(await loadCandidateProfile(auth, "c1")).toEqual({ status: 404, error: "Not found" });
  });

  it("returns the profile, hiding fees from members without financial access", async () => {
    results.candidates = {
      data: { id: "c1", full_name: "Ada Lovelace", job_id: "j1", jobs: { id: "j1", title: "Engineer", client: "Acme" }, placement_fee: 9000, extracted: {} },
      error: null,
    };
    lists.candidate_notes = { data: [{ id: "n1", author_name: "Bo", author_id: "u", note: "Strong", created_at: "2026-10-01" }], error: null };
    const result = await loadCandidateProfile(auth, "c1");
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ id: "c1", fullName: "Ada Lovelace", jobTitle: "Engineer", company: "Acme", placementFee: null });
    expect(result.body.notes).toEqual([expect.objectContaining({ id: "n1", body: "Strong" })]);
  });
});
