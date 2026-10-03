import { describe, expect, it } from "vitest";
import { computeCandidateStats } from "./dashboard-model";

const now = new Date("2026-10-01T12:00:00Z").getTime();
const row = (over) => ({
  id: "s1",
  candidateId: "c1",
  candidateName: "Ana",
  jobTitle: "Dev",
  status: "completed",
  stage: "Interview",
  score: 70,
  createdAt: new Date(now - 86400000),
  nextAction: null,
  ...over,
});

describe("computeCandidateStats - overdue follow-ups", () => {
  it("flags an overdue next action once per candidate", () => {
    const due = { label: "Call back", dueAt: "2026-09-29T09:00:00Z" };
    const stats = computeCandidateStats([row({ nextAction: due }), row({ id: "s2", nextAction: due })], now);
    const overdue = stats.attentionItemsAll.filter((i) => i.reasonLabel.startsWith("Overdue"));
    expect(overdue).toHaveLength(1);
    expect(overdue[0].reasonLabel).toBe("Overdue · Call back");
    expect(stats.attentionItemsAll[0]).toBe(overdue[0]);
  });

  it("ignores follow-ups not yet due or without a date", () => {
    const stats = computeCandidateStats(
      [row({ nextAction: { label: "Later", dueAt: "2026-10-09T09:00:00Z" } }), row({ id: "s2", candidateId: "c2", nextAction: { label: "Whenever", dueAt: null } })],
      now
    );
    expect(stats.attentionItemsAll.some((i) => i.reasonLabel.startsWith("Overdue"))).toBe(false);
  });
});

describe("computeCandidateStats - stalled and duplicates", () => {
  it("measures stalled from the last activity, not the analysis date", () => {
    const old = new Date(now - 10 * 86400000);
    const stats = computeCandidateStats(
      [
        row({ id: "a", candidateId: "a", createdAt: old, lastActivityAt: new Date(now - 86400000) }),
        row({ id: "b", candidateId: "b", createdAt: old, lastActivityAt: new Date(now - 7 * 86400000) }),
        row({ id: "c", candidateId: "c", createdAt: old, lastActivityAt: null }),
      ],
      now
    );
    const stalled = stats.attentionItemsAll.filter((i) => i.reasonLabel.startsWith("Stalled")).map((i) => i.id);
    expect(stalled.sort()).toEqual(["b-stalled", "c-stalled"]);
  });

  it("counts a pipeline entry once even if it appears more than once", () => {
    const stats = computeCandidateStats(
      [row({ id: "s1", candidateId: "c1" }), row({ id: "s2", candidateId: "c1", createdAt: new Date(now - 2 * 86400000) }), row({ id: "s3", candidateId: "c2" })],
      now
    );
    expect(stats.totals.total).toBe(2);
    expect(stats.totals.inPipeline).toBe(2);
    expect(stats.stageCounts.Interview).toBe(2);
  });
});
