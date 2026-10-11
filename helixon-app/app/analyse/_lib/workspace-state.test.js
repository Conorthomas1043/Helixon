import { describe, expect, it } from "vitest";
import { initialWorkspace, roleModeFor, workspaceReducer } from "./workspace-state";

const run = (actions, from = initialWorkspace) => actions.reduce(workspaceReducer, from);
const JOB = { id: "job-1", title: "Data Engineer", job_text: "A saved description of the data engineer role.", client_email: "hm@acme.test" };
const ANSWER = {
  result: { match_score: 82, recommendation: "Shortlist" },
  candidateId: "cand-1",
  jobId: "job-9",
  scoreId: "score-1",
  job: { title: "Data Engineer" },
  duplicate: { candidateId: "cand-0", matchedOn: "email" },
};

describe("the job", () => {
  it("shows saved jobs first when there are any, until a method is picked", () => {
    expect(roleModeFor(initialWorkspace, 0)).toBe("paste");
    expect(roleModeFor(initialWorkspace, 3)).toBe("saved");
    expect(roleModeFor(run([{ type: "roleMode", mode: "build" }]), 3)).toBe("build");
  });

  it("selecting a saved job fills the text and an empty client email", () => {
    const s = run([{ type: "selectSavedJob", job: JOB }]);
    expect(s).toMatchObject({ existingJobId: "job-1", jobText: JOB.job_text, clientEmail: "hm@acme.test", jobFile: null });
    const typed = run([{ type: "set", field: "clientEmail", value: "me@x.test" }, { type: "selectSavedJob", job: JOB }]);
    expect(typed.clientEmail).toBe("me@x.test");
  });

  it("editing the text, choosing a file or switching method detaches the saved job", () => {
    const saved = run([{ type: "selectSavedJob", job: JOB }]);
    expect(run([{ type: "roleText", text: "edited" }], saved)).toMatchObject({ existingJobId: null, jobText: "edited" });
    expect(run([{ type: "jobFile", file: { name: "spec.pdf" } }], saved)).toMatchObject({ existingJobId: null, jobText: "", jobFile: { name: "spec.pdf" } });
    expect(run([{ type: "roleMode", mode: "paste" }], saved)).toMatchObject({ existingJobId: null, roleMode: "paste" });
    expect(run([{ type: "roleMode", mode: "saved" }], saved).existingJobId).toBe("job-1");
  });

  it("a text spec lands in the text box in paste mode", () => {
    const s = run([{ type: "jobFile", file: null }, { type: "jobTextFromFile", text: "From the file" }]);
    expect(s).toMatchObject({ jobText: "From the file", roleMode: "paste", jobFile: null });
  });

  it("a job opened from its page is preselected", () => {
    expect(run([{ type: "prefillJob", job: JOB }])).toMatchObject({ prefilledJob: JOB, roleMode: "saved", existingJobId: "job-1" });
  });
});

describe("a run", () => {
  it("starts clean, ticks up to the last step, and keeps an error", () => {
    let s = run([{ type: "set", field: "error", value: "old" }, { type: "runStarted" }]);
    expect(s).toMatchObject({ loading: true, step: 0, error: null });
    s = run([{ type: "tick", lastStep: 2 }, { type: "tick", lastStep: 2 }, { type: "tick", lastStep: 2 }], s);
    expect(s.step).toBe(2);
    s = run([{ type: "runFailed", error: "Too large" }, { type: "runFinished" }], s);
    expect(s).toMatchObject({ loading: false, error: "Too large" });
  });

  it("a finished analysis holds the report and resets feedback and re-scoring", () => {
    const s = run([
      { type: "feedbackSent", rating: "up", reason: null },
      { type: "set", field: "rerunning", value: true },
      { type: "analysed", data: ANSWER },
    ]);
    expect(s).toMatchObject({
      result: ANSWER.result,
      candidateId: "cand-1",
      jobId: "job-9",
      scoreId: "score-1",
      jobTitle: "Data Engineer",
      duplicate: ANSWER.duplicate,
      rerunning: false,
      feedback: { sent: false, rating: null, reason: null },
    });
  });

  it("a CV goes to the comparison slot while comparing", () => {
    const s = run([{ type: "cvFile", file: "a.pdf" }, { type: "set", field: "comparing", value: true }, { type: "cvFile", file: "b.pdf" }]);
    expect(s).toMatchObject({ file: "a.pdf", compareFile: "b.pdf" });
    expect(run([{ type: "stopComparing" }], s)).toMatchObject({ comparing: false, compareFile: null, file: "a.pdf" });
  });
});

describe("starting again", () => {
  const reported = run([
    { type: "roleText", text: "A pasted description of the role, long enough to screen." },
    { type: "cvFile", file: "a.pdf" },
    { type: "set", field: "reference", value: "Jane" },
    { type: "analysed", data: ANSWER },
  ]);

  it("Screen another CV clears the report and the CV, and keeps the job", () => {
    const s = run([{ type: "startNew" }], reported);
    expect(s).toMatchObject({ result: null, candidateId: null, jobId: null, file: null, reference: "", jobText: reported.jobText });
  });

  it("Next candidate attaches to the job the last analysis created", () => {
    expect(run([{ type: "nextCandidate", savedJobIds: [] }], reported)).toMatchObject({ result: null, existingJobId: "job-9", roleMode: null });
    expect(run([{ type: "nextCandidate", savedJobIds: ["job-9"] }], reported).roleMode).toBe("saved");
  });

  it("refuses fields that have knock-on effects, and unknown actions", () => {
    expect(() => workspaceReducer(initialWorkspace, { type: "set", field: "jobText", value: "x" })).toThrow();
    expect(() => workspaceReducer(initialWorkspace, { type: "nope" })).toThrow();
  });
});
