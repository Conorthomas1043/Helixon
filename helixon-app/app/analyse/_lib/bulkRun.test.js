import { describe, expect, it } from "vitest";
import { bulkResultRows, leaderboard, oneLine, pendingInRun, serialiseQueue } from "./bulkRun";

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

describe("the AI-writing flag in a bulk run", () => {
  it("is kept when the run is saved and shown in the export", () => {
    const queue = [{ id: "1", file: { name: "a.pdf", size: 1 }, status: "done", candidateId: "c1", score: 80, name: "A", aiWritten: true }];
    expect(serialiseQueue(queue)[0].aiWritten).toBe(true);
    expect(bulkResultRows(queue)[0]["Possibly AI-written"]).toBe("Yes");
    expect(bulkResultRows([{ ...queue[0], aiWritten: false }])[0]["Possibly AI-written"]).toBe("");
  });
});

describe("leaderboard", () => {
  it("puts scored candidates first, best first, then the one being analysed, then the rest in upload order", () => {
    const q = [
      { id: "a", status: "queued" },
      { id: "b", status: "done", score: 71 },
      { id: "c", status: "failed" },
      { id: "d", status: "processing" },
      { id: "e", status: "done", score: 93 },
      { id: "f", status: "queued" },
    ];
    expect(leaderboard(q).map((it) => it.id)).toEqual(["e", "b", "d", "a", "f", "c"]);
  });
});

describe("oneLine", () => {
  it("keeps the first sentence and trims long ones", () => {
    expect(oneLine("Six years leading night shifts. Also drives.")).toBe("Six years leading night shifts.");
    expect(oneLine("x".repeat(200), 20)).toHaveLength(20);
    expect(oneLine("")).toBeNull();
  });
});
