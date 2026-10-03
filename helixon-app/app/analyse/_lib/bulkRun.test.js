import { describe, expect, it } from "vitest";
import { bulkResultRows, pendingInRun, serialiseQueue } from "./bulkRun";

const file = (name) => ({ name, size: 2048, isBlob: true });
const queue = [
  { id: 0, file: file("a.pdf"), status: "done", candidateId: "c1", score: 62, name: "Ana", errorMessage: null, duplicate: null },
  { id: 1, file: file("b.pdf"), status: "processing", candidateId: null, score: null, name: null, errorMessage: null },
  { id: 2, file: file("c.pdf"), status: "failed", candidateId: null, score: null, name: null, errorMessage: "Couldn't read it" },
  { id: 3, file: file("d.pdf"), status: "done", candidateId: "c4", score: 88, name: "Dan", duplicate: { sameJobCandidateId: "x" } },
];

describe("serialiseQueue", () => {
  it("keeps files still to analyse, and only the name of finished ones", () => {
    const saved = serialiseQueue(queue);
    expect(saved[0].file).toEqual({ name: "a.pdf", size: 2048 });
    expect(saved[1].file).toBe(queue[1].file);
    expect(saved[1].status).toBe("queued");
    expect(saved[2].status).toBe("failed");
    expect(pendingInRun({ queue: saved })).toBe(2);
  });
});

describe("bulkResultRows", () => {
  it("ranks by score and explains the rest", () => {
    const rows = bulkResultRows(queue, "https://app.test");
    expect(rows.map((r) => [r.Rank, r.Candidate, r.Score])).toEqual([
      [1, "Dan", 88],
      [2, "Ana", 62],
      ["", "", ""],
      ["", "", ""],
    ]);
    expect(rows[0].Note).toBe("Already in this job's pipeline");
    expect(rows[0].Link).toBe("https://app.test/dashboard/candidates/c4");
    expect(rows.find((r) => r.File === "c.pdf")).toMatchObject({ Status: "Failed", Note: "Couldn't read it" });
  });
});
