import { describe, expect, it } from "vitest";
import { cleanOffices, normaliseOffices } from "./offices";
import { cleanJobDetails } from "./job-details";

describe("offices", () => {
  it("reads saved offices, dropping junk and stale assignments", () => {
    const settings = {
      offices: [{ id: "london-abc123", name: " London " }, { id: "BAD ID", name: "x" }, { id: "leeds-1", name: "" }],
      memberOffices: { user_1: "london-abc123", user_2: "gone", "bad id": "london-abc123" },
    };
    expect(normaliseOffices(settings)).toEqual({ offices: [{ id: "london-abc123", name: "London" }], memberOffices: { user_1: "london-abc123" } });
    expect(normaliseOffices(null)).toEqual({ offices: [], memberOffices: {} });
  });

  it("gives new offices ids and keeps existing ones", () => {
    const res = cleanOffices({ offices: [{ id: "london-abc123", name: "London" }, { name: "Manchester Tech" }, { name: "  " }], memberOffices: { user_1: "london-abc123", user_2: "nope" } });
    expect(res.offices[0]).toEqual({ id: "london-abc123", name: "London" });
    expect(res.offices[1].id).toMatch(/^manchester-tech-[a-f0-9]{6}$/);
    expect(res.offices).toHaveLength(2);
    expect(res.memberOffices).toEqual({ user_1: "london-abc123" });
  });

  it("refuses duplicate names", () => {
    expect(cleanOffices({ offices: [{ name: "London" }, { name: "london" }] }).error).toMatch(/twice/);
  });

  it("validates a job's office", () => {
    expect(cleanJobDetails({ officeId: "london-abc123" })).toEqual({ office_id: "london-abc123" });
    expect(cleanJobDetails({ officeId: "" })).toEqual({ office_id: null });
    expect(cleanJobDetails({ officeId: "Not Valid" }).error).toBeTruthy();
  });
});
