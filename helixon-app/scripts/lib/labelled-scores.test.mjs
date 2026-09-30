import { describe, it, expect } from "vitest";
import { loadScores } from "./labelled-scores.mjs";
import { spread, varianceSummary } from "./variance.mjs";

// Minimal stand-in for the supabase-js query builder these reads use.
function fakeSupabase(tables) {
  return {
    from(name) {
      const q = {
        select: () => q,
        order: () => q,
        not: () => q,
        range: async (from, to) => ({ data: (tables[name] || []).slice(from, to + 1), error: null }),
      };
      return q;
    },
  };
}

describe("loadScores", () => {
  const tables = {
    scores: [
      { id: "s1", agency_id: "a", candidate_id: "c1", job_id: "j1", match_score: 70, result: { role_type: "professional" }, created_at: "2026-09-01" },
      { id: "s2", agency_id: "a", candidate_id: "c2", job_id: "j1", match_score: 40, result: {}, created_at: "2026-09-02" },
      { id: "s3", agency_id: "a", candidate_id: "c2", job_id: "j2", match_score: 80, result: {}, created_at: "2026-09-03" },
      { id: "s4", agency_id: "a", candidate_id: "c3", job_id: "j1", match_score: 55, result: {}, created_at: "2026-09-04" },
    ],
    feedback: [
      { score_id: "s1", expected_band: "Worth reviewing", created_at: "2026-09-05" },
      { score_id: "s1", expected_band: "Not suitable", created_at: "2026-09-06" },
    ],
    candidates: [
      { id: "c1", job_id: "j1", stage: "Placed", rejection_reason: null },
      { id: "c2", job_id: "j2", stage: "Rejected", rejection_reason: "skills_gap" },
      { id: "c3", job_id: "j1", stage: "Rejected", rejection_reason: "candidate_withdrew" },
    ],
    jobs: [{ id: "j1", parsed: { role_type: "frontline" } }, { id: "j2", parsed: {} }],
  };

  it("labels from the latest recruiter band first, then the pipeline for the job the candidate is in", async () => {
    const rows = await loadScores(fakeSupabase(tables));
    const byId = Object.fromEntries(rows.map((r) => [r.scoreId, r]));
    expect(byId.s1).toMatchObject({ label: 0, source: "recruiter band", roleType: "professional" }); // latest band wins over "Placed"
    expect(byId.s2.label).toBeNull(); // c2 is in the pipeline for j2, not j1
    expect(byId.s3).toMatchObject({ label: 0, source: "pipeline outcome" }); // rejected for a skills gap
    expect(byId.s4.label).toBeNull(); // withdrew - says nothing about the CV
    expect(byId.s4.roleType).toBe("frontline"); // from the job when the score doesn't say
  });
});

describe("variance", () => {
  it("measures spread and recommendation flips across repeated runs", () => {
    expect(spread([70, 74, 72])).toMatchObject({ mean: 72, range: 4 });
    const lines = varianceSummary([
      { scores: [70, 74, 72], recommendations: ["Worth reviewing", "Worth reviewing", "Worth reviewing"] },
      { scores: [78, 82, 80], recommendations: ["Worth reviewing", "Strong match", "Strong match"] },
    ]);
    expect(lines[0]).toMatch(/mean standard deviation 2\.0 points, largest range 4 points/);
    expect(lines[1]).toMatch(/1\/2 cases \(50%\)/);
  });
});
