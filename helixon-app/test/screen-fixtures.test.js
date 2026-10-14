// The fixture API answers behind e2e/screens.spec.js must match what the
// routes really return, or the screenshots show screens no customer sees.
// Checked against the response contracts where a route has one.

import { describe, expect, it } from "vitest";
import { apiFixture } from "../e2e/data/api.js";
import { CandidateListPageSchema, CandidateProfileSchema, StageCountsSchema } from "@/lib/contracts/candidates";
import { JobListSchema } from "@/lib/contracts/jobs";

const body = (path) => apiFixture("GET", path)?.body;

describe("screen fixtures", () => {
  it("match the candidate and job contracts", () => {
    expect(() => CandidateListPageSchema.parse(body("/api/candidates"))).not.toThrow();
    expect(() => StageCountsSchema.parse(body("/api/candidates/stage-counts"))).not.toThrow();
    expect(() => CandidateProfileSchema.parse(body("/api/candidates/c1"))).not.toThrow();
    expect(() => JobListSchema.parse(body("/api/jobs"))).not.toThrow();
  });

  it("answer nothing for a route without a fixture", () => {
    expect(apiFixture("GET", "/api/nope")).toBeNull();
  });
});
