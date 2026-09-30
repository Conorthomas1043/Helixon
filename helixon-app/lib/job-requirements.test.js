import { describe, it, expect } from "vitest";
import { syncParsedRequirements } from "./job-requirements.js";

const parsed = {
  title: "Data Engineer",
  required_skills: ["Python", "SQL"],
  preferred_skills: ["dbt"],
  skill_importance: { Python: "Critical", SQL: "Low" },
  min_years_experience: 5,
};

describe("syncParsedRequirements", () => {
  it("carries edited skills into what screening scores against", () => {
    const next = syncParsedRequirements(parsed, { required_skills: ["Python", "Airflow"], preferred_skills: [] });
    expect(next.required_skills).toEqual(["Python", "Airflow"]);
    expect(next.preferred_skills).toEqual([]);
    // Importance kept for what's still required, dropped for what isn't.
    expect(next.skill_importance).toEqual({ Python: "Critical" });
    expect(next.title).toBe("Data Engineer");
    expect(parsed.required_skills).toEqual(["Python", "SQL"]); // not mutated
  });

  it("updates minimum years, treating a cleared value as none", () => {
    expect(syncParsedRequirements(parsed, { min_years_experience: 3 }).min_years_experience).toBe(3);
    expect(syncParsedRequirements(parsed, { min_years_experience: null }).min_years_experience).toBe(0);
  });

  it("leaves untouched fields alone", () => {
    const next = syncParsedRequirements(parsed, { preferred_skills: ["Spark"] });
    expect(next.required_skills).toEqual(parsed.required_skills);
    expect(next.skill_importance).toEqual(parsed.skill_importance);
  });

  it("does nothing for a job that hasn't been parsed yet", () => {
    expect(syncParsedRequirements(null, { required_skills: ["Python"] })).toBeNull();
    expect(syncParsedRequirements({}, { required_skills: ["Python"] })).toBeNull();
  });

  it("ignores inherited keys on a malformed importance map", () => {
    const next = syncParsedRequirements({ ...parsed, skill_importance: {} }, { required_skills: ["constructor"] });
    expect(next.skill_importance).toEqual({});
  });
});
