import { describe, expect, it, vi } from "vitest";
import { fakeDb } from "@/test/fake-db";

const erase = vi.hoisted(() => ({ fail: null }));
vi.mock("@/lib/candidates/erasure", () => ({
  // Erases what it's given from the fake database, or stops at a step.
  eraseCandidates: async (db, agencyId, ids) => {
    if (erase.fail) return { erased: 0, failedStep: erase.fail };
    db.tables.candidates = db.tables.candidates.filter((c) => !(c.agency_id === agencyId && ids.includes(c.id)));
    return { erased: ids.length };
  },
}));
vi.mock("@/lib/compliance/privacy-settings", () => ({ getAgencyPrivacy: vi.fn(), retentionCutoff: vi.fn(), RETENTION_WARNING_DAYS: 30, addMonths: vi.fn() }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));

const { purgeAgencyCandidates } = await import("./data-retention");

describe("purgeAgencyCandidates", () => {
  it("erases every candidate of the agency and nobody else's", async () => {
    const db = fakeDb({ candidates: [{ id: "a1", agency_id: "A" }, { id: "a2", agency_id: "A" }, { id: "b1", agency_id: "B" }] });
    erase.fail = null;
    expect(await purgeAgencyCandidates(db, "A")).toEqual({ erased: 2 });
    expect(db.tables.candidates.map((c) => c.id)).toEqual(["b1"]);
  });

  it("reports where it stopped instead of claiming success", async () => {
    const db = fakeDb({ candidates: [{ id: "a1", agency_id: "A" }] });
    erase.fail = "storage";
    expect(await purgeAgencyCandidates(db, "A")).toEqual({ erased: 0, failedStep: "storage" });
    expect(db.tables.candidates).toHaveLength(1);
  });
});
