import { describe, expect, it } from "vitest";
import { computeCore, computeDeltas, computeTeam, computeTrends, furthestStageIndex, placedAt, resolveRange } from "./analytics-snapshot";

const now = new Date("2026-10-01T12:00:00Z").getTime();
const DAY = 86400000;
const cand = (over) => ({
  id: "c1",
  job_id: "j1",
  created_at: "2026-09-20T10:00:00Z",
  stage: "Screened",
  processing_status: "completed",
  match_score: 70,
  recruiter_id: "u1",
  last_activity_at: "2026-09-30T10:00:00Z",
  ...over,
});
const moved = (to, at = "2026-09-25T10:00:00Z") => ({ created_at: at, meta: { to } });

describe("furthestStageIndex", () => {
  it("counts the furthest stage a rejected candidate reached", () => {
    expect(furthestStageIndex(cand({ stage: "Rejected" }), [moved("Shortlisted"), moved("Interview"), moved("Rejected")])).toBe(2);
  });
  it("treats a rejected candidate with no history as screened", () => {
    expect(furthestStageIndex(cand({ stage: "Rejected" }), [])).toBe(0);
  });
  it("uses the current stage when it's further than the history", () => {
    expect(furthestStageIndex(cand({ stage: "Offer" }), [moved("Shortlisted")])).toBe(3);
  });
  it("leaves never-staged candidates out", () => {
    expect(furthestStageIndex(cand({ stage: null }), [])).toBe(-1);
  });
});

describe("placedAt", () => {
  it("returns the last move into Placed", () => {
    expect(placedAt([moved("Placed", "2026-09-01T00:00:00Z"), moved("Offer"), moved("Placed", "2026-09-10T00:00:00Z")])).toBe("2026-09-10T00:00:00Z");
    expect(placedAt([moved("Offer")])).toBeNull();
  });
});

describe("computeCore", () => {
  it("includes rejected candidates in the conversion rates up to where they got", () => {
    const rows = [
      cand({ id: "a", stage: "Rejected" }),
      cand({ id: "b", stage: "Placed" }),
      cand({ id: "c", stage: "Screened" }),
      cand({ id: "d", stage: "Shortlisted" }),
    ];
    const furthest = new Map([
      ["a", 2],
      ["b", 4],
      ["c", 0],
      ["d", 1],
    ]);
    const core = computeCore(rows, furthest, now);
    expect(core.funnel.map((f) => f.count)).toEqual([4, 3, 2, 1, 1]);
    expect(core.conversion).toEqual({ shortlistRate: 75, interviewRate: 50, offerRate: 25, placementRate: 25 });
  });

  it("measures stalled from the last activity", () => {
    const rows = [
      cand({ id: "a", stage: "Interview", last_activity_at: new Date(now - 2 * DAY).toISOString() }),
      cand({ id: "b", stage: "Interview", last_activity_at: new Date(now - 8 * DAY).toISOString() }),
    ];
    expect(computeCore(rows, new Map(), now).pipeline.stalled).toBe(1);
  });
});

describe("computeTeam", () => {
  it("rolls up the filtered candidates per recruiter", () => {
    const team = computeTeam(
      [cand({ id: "a", stage: "Placed" }), cand({ id: "b", stage: "Interview" }), cand({ id: "c", stage: "Rejected", recruiter_id: "u2" })],
      [
        { id: "u1", name: "Ana" },
        { id: "u2", name: "Ben" },
        { id: "u3", name: "Cat" },
      ]
    );
    expect(team).toEqual([
      { id: "u1", name: "Ana", activeCandidates: 1, placed: 1, total: 2 },
      { id: "u2", name: "Ben", activeCandidates: 0, placed: 0, total: 1 },
    ]);
  });
});

describe("resolveRange", () => {
  it("gives a preset period and the one before it", () => {
    const r = resolveRange({ period: "30d" }, now);
    expect(r.to.getTime()).toBe(now);
    expect(r.from.getTime()).toBe(now - 30 * DAY);
    expect(r.previous.to.getTime()).toBe(now - 30 * DAY);
    expect(r.previous.from.getTime()).toBe(now - 60 * DAY);
  });
  it("includes both days of a custom range and swaps reversed ones", () => {
    const r = resolveRange({ period: "custom", from: "2026-09-10", to: "2026-09-01" }, now);
    expect(r.from.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-09-11T00:00:00.000Z");
    expect(r.days).toBe(10);
    expect(r.previous.from.toISOString()).toBe("2026-08-22T00:00:00.000Z");
  });
  it("has nothing to compare for all time or an open-ended range", () => {
    expect(resolveRange({ period: "all" }, now).previous).toBeNull();
    expect(resolveRange({ period: "custom", from: "2026-09-01" }, now).previous).toBeNull();
    expect(resolveRange({ period: "custom", from: "nope" }, now).from).toBeNull();
  });
});

describe("computeDeltas", () => {
  it("compares with the previous period and skips empty ones", () => {
    const core = (completed, rate) => ({ totals: { completed }, quality: { avgScore: 70, scoredCount: completed }, conversion: { shortlistRate: rate, interviewRate: rate, offerRate: rate, placementRate: rate } });
    expect(computeDeltas(core(10, 40), core(8, 30))).toMatchObject({ completed: 2, shortlistRate: 10, avgScore: 0 });
    expect(computeDeltas(core(10, 40), core(0, 0))).toMatchObject({ completed: 10, shortlistRate: null, avgScore: null });
    expect(computeDeltas(core(10, 40), null)).toBeNull();
  });
});

describe("computeTrends", () => {
  it("buckets by week for short ranges", () => {
    const range = resolveRange({ period: "30d" }, now);
    const t = computeTrends(
      [cand({ created_at: "2026-09-29T10:00:00Z" }), cand({ id: "b", created_at: "2026-09-30T10:00:00Z" }), cand({ id: "c", created_at: "2026-08-01T10:00:00Z" })],
      [{ at: "2026-09-30T09:00:00Z", fee: 5000 }],
      range,
      now
    );
    expect(t.unit).toBe("week");
    const last = t.points[t.points.length - 1];
    expect(last.start).toBe("2026-09-28");
    expect(last).toMatchObject({ analysed: 2, placed: 1, fees: 5000 });
    expect(t.points.reduce((s, p) => s + p.analysed, 0)).toBe(2);
  });

  it("buckets by month for all time, capped at 24 months", () => {
    const t = computeTrends([cand({ created_at: "2020-01-05T00:00:00Z" }), cand({ id: "b" })], [], { from: null, to: null }, now);
    expect(t.unit).toBe("month");
    expect(t.points).toHaveLength(24);
    expect(t.points[t.points.length - 1]).toMatchObject({ start: "2026-10-01", analysed: 0 });
    expect(t.points[t.points.length - 2]).toMatchObject({ start: "2026-09-01", analysed: 1 });
  });
});
