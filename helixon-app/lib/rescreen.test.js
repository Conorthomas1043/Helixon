import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/cv-analysis", () => ({ analyseCV: vi.fn(), estimateSalary: vi.fn() }));
vi.mock("@/lib/candidate-files", () => ({ copyCandidateCv: vi.fn() }));

const { jobTextFor, poolRootId, rescreenCandidate } = await import("./rescreen");
const { analyseCV } = await import("@/lib/cv-analysis");

describe("poolRootId", () => {
  it("is the row a re-screen came from, or the row itself", () => {
    expect(poolRootId({ id: "b", pooled_from_id: "a" })).toBe("a");
    expect(poolRootId({ id: "a", pooled_from_id: null })).toBe("a");
  });
});

describe("jobTextFor", () => {
  it("uses the job's own description when there is one", () => {
    const text = "x".repeat(60);
    expect(jobTextFor({ job_text: text, title: "Ignored" })).toBe(text);
  });

  it("builds one from the fields of a job added by hand", () => {
    const text = jobTextFor({ title: "Care Assistant", required_skills: ["Enhanced DBS", "Manual handling"], min_years_experience: 1 });
    expect(text).toContain("Job title: Care Assistant");
    expect(text).toContain("Required skills: Enhanced DBS, Manual handling");
    expect(text).toContain("Minimum experience: 1 years");
  });
});

// A tiny stand-in for the supabase-js query builder: every call chains,
// and awaiting (or maybeSingle/single) resolves the table's queued result.
function fakeSupabase(results) {
  return {
    from(table) {
      const next = () => results[table]?.shift() ?? { data: null, error: null };
      const builder = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") return (resolve) => resolve(next());
            if (prop === "maybeSingle" || prop === "single") return () => Promise.resolve(next());
            return () => builder;
          },
        }
      );
      return builder;
    },
  };
}

describe("rescreenCandidate", () => {
  const args = { agencyId: "ag", userId: "u", actor: "Sam", sourceId: "c1", jobId: "j1" };

  it("refuses someone already screened for the job, without analysing", async () => {
    const supabase = fakeSupabase({
      candidates: [{ data: { id: "c1", cv_text: "CV text", pooled_from_id: null } }, { data: { id: "c9" } }],
      jobs: [{ data: { id: "j1", job_text: "y".repeat(80) } }],
    });
    const result = await rescreenCandidate(supabase, args);
    expect(result).toEqual({ error: "Already screened for this job.", status: 409, existingId: "c9" });
    expect(analyseCV).not.toHaveBeenCalled();
  });

  it("needs CV text on file", async () => {
    const supabase = fakeSupabase({
      candidates: [{ data: { id: "c1", cv_text: "  " } }],
      jobs: [{ data: { id: "j1" } }],
    });
    expect((await rescreenCandidate(supabase, args)).status).toBe(422);
  });

  it("is scoped to the agency - an unknown candidate or job is not found", async () => {
    expect((await rescreenCandidate(fakeSupabase({ jobs: [{ data: { id: "j1" } }] }), args)).status).toBe(404);
    expect((await rescreenCandidate(fakeSupabase({ candidates: [{ data: { id: "c1", cv_text: "x" } }] }), args)).status).toBe(404);
  });
});
