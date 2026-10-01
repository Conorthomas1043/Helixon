import { describe, expect, it } from "vitest";
import { aggregate, cleanCommission, cleanTargets, commissionFor, periodRange, placementInPeriod, scaleTargets } from "@/lib/performance";

describe("periodRange", () => {
  const now = new Date("2026-02-15T12:00:00Z");
  it("covers months, quarters and years, crossing year ends", () => {
    expect(periodRange("this_month", now)).toMatchObject({ from: "2026-02-01", to: "2026-03-01", months: 1 });
    expect(periodRange("last_month", new Date("2026-01-10T00:00:00Z"))).toMatchObject({ from: "2025-12-01", to: "2026-01-01" });
    expect(periodRange("this_quarter", now)).toMatchObject({ from: "2026-01-01", to: "2026-04-01", months: 3 });
    expect(periodRange("last_quarter", now)).toMatchObject({ from: "2025-10-01", to: "2026-01-01" });
    expect(periodRange("last_year", now)).toMatchObject({ from: "2025-01-01", to: "2026-01-01", months: 12 });
    expect(periodRange("bogus", now).key).toBe("this_month");
  });
});

describe("commission", () => {
  const plan = cleanCommission({ enabled: true, threshold: 5000, tiers: [{ from: 20000, rate: 15 }, { from: 0, rate: 10 }], people: { u2: { threshold: 0 } } });
  it("sorts bands and pays each band its rate above the threshold", () => {
    expect(plan.tiers).toEqual([
      { from: 0, rate: 10 },
      { from: 20000, rate: 15 },
    ]);
    expect(commissionFor(plan, 30000)).toBe(2750);
    expect(commissionFor(plan, 4000)).toBe(0);
  });
  it("scales the threshold with the period and honours a personal threshold", () => {
    expect(commissionFor(plan, 30000, { months: 3 })).toBe(1500);
    expect(commissionFor(plan, 10000, { userId: "u2" })).toBe(1000);
  });
  it("is off unless enabled, and needs a rate when enabled", () => {
    expect(commissionFor(cleanCommission({ tiers: [{ from: 0, rate: 10 }] }), 1000)).toBeNull();
    expect(cleanCommission({ enabled: true, tiers: [] }).error).toBeTruthy();
  });
});

describe("targets", () => {
  it("keeps known metrics with positive numbers, and scales by months", () => {
    const t = cleanTargets({ team: { placements: "4", bogus: 9, calls: -1 }, people: { u1: { fees: 10000 }, "bad id!": { fees: 1 } } });
    expect(t).toEqual({ team: { placements: 4 }, people: { u1: { fees: 10000 } } });
    expect(scaleTargets(t.team, 3)).toEqual({ placements: 12 });
  });
});

describe("aggregate", () => {
  it("rolls up activity per person, matching activity by name", () => {
    const placements = [
      { recruiter_id: "u1", status: "started", kind: "permanent", fee_amount: 9000, offer_date: "2026-02-03" },
      { recruiter_id: "u1", status: "offered", kind: "permanent", fee_amount: 5000, offer_date: "2026-02-04" },
      { recruiter_id: "u2", status: "accepted", kind: "contract", offer_date: "2026-01-20" },
    ].map((p) => ({ ...p, ...placementInPeriod(p, "2026-02-01", "2026-03-01") }));
    const out = aggregate(
      {
        candidates: [{ recruiter_id: "u1" }, { recruiter_id: "u1" }, { recruiter_id: "u2" }],
        activity: [
          { type: "call_logged", actor: "Sam Lee" },
          { type: "cv_sent_logged", actor: "sam lee" },
          { type: "note_added", actor: "Sam Lee" },
          { type: "call_logged", actor: "Somebody Else" },
        ],
        interviews: [{ created_by: "u2" }],
        placements,
        invoices: [{ recruiter_id: "u1", total: 12000, vat_amount: 2000 }],
      },
      new Map([["sam lee", "u1"]])
    );
    expect(out.get("u1")).toEqual({ cvs_added: 2, calls: 1, cvs_sent: 1, interviews: 0, offers: 2, placements: 1, fees: 9000, cash: 10000 });
    expect(out.get("u2")).toMatchObject({ cvs_added: 1, interviews: 1, offers: 0, placements: 0 });
  });
});
