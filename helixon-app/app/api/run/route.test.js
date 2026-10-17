// POST /api/run - screening one CV against a job - called for real against
// an in-memory database. The model calls are stubbed; everything else (the
// checks, what gets written, the clean-up when a step fails) runs as in
// production.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "@/test/fake-db";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const JOB_A = "55555555-5555-4555-8555-55555555555a";
const JOB_B = "55555555-5555-4555-8555-55555555555b";
const JOB_TEXT = "Warehouse operative needed in Leeds. Forklift licence, night shifts, order picking and stock control.";

const state = vi.hoisted(() => ({ db: null, auth: null, limits: [], used: 0 }));
const analyseCV = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return state.db;
  },
}));
vi.mock("@/lib/agency-db", () => ({ agencyDb: async () => state.db }));
vi.mock("@/lib/auth/customer-auth", () => ({ requireCustomerContext: async () => state.auth }));
vi.mock("@/lib/ratelimit", () => ({
  getClientIp: () => "203.0.113.9",
  rateLimit: vi.fn(async (key) => !state.limits.some((prefix) => key.startsWith(prefix))),
}));
vi.mock("@/lib/agency/controls", async (importOriginal) => ({
  ...(await importOriginal()),
  screeningsThisMonth: async () => state.used,
}));
vi.mock("@/lib/cv-analysis", () => ({
  analyseCV: (...args) => analyseCV(...args),
  estimateSalary: () => ({ low: 24000, high: 28000 }),
}));
vi.mock("@/lib/cv-analysis/extraction/cvTextExtractor", () => ({ default: vi.fn(async () => "spec text") }));
vi.mock("@/lib/candidates/duplicates", () => ({ findExistingPerson: async () => null }));
vi.mock("@/lib/clients/core", () => ({ ensureClient: async () => null }));
vi.mock("@/lib/candidates/files", () => ({
  storeCandidateCv: vi.fn(async ({ candidateId }) => ({ path: `cvs/${candidateId}.pdf`, fileName: "cv.pdf" })),
  removeCandidateCvs: vi.fn(),
}));
vi.mock("@/lib/integrations/webhooks", () => ({ emitWebhook: vi.fn(), candidatePayload: (c) => c }));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal()), after: vi.fn() }));

const { POST } = await import("./route");

function form(fields = {}) {
  const data = new FormData();
  const values = {
    cv: new File(["%PDF-1.4 fake"], "cv.pdf", { type: "application/pdf" }),
    jobText: JOB_TEXT,
    lawfulBasisConfirmed: "true",
    ...fields,
  };
  for (const [key, value] of Object.entries(values)) if (value !== undefined) data.append(key, value);
  return data;
}

const run = (fields) => POST(new Request("http://x.test/api/run", { method: "POST", body: form(fields) }));

const ANALYSIS = {
  cvText: "Amy Clarke. Forklift licence, five years picking.",
  extracted: { name: "Amy Clarke", email: "amy@example.com", current_title: "Picker" },
  result: { match_score: 88, recommendation: "Shortlist", strengths: ["Forklift licence"], concerns: [] },
  jobParsed: { title: "Warehouse Operative", required_skills: ["forklift"], role_tier: "entry" },
};

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  state.limits = [];
  state.used = 0;
  state.auth = { ok: true, userId: "user_a", agencyId: A, profile: { id: "p1", first_name: "Alex" }, screeningCap: null };
  state.db = fakeDb({
    candidates: [],
    scores: [],
    candidate_activity: [],
    jobs: [
      { id: JOB_A, agency_id: A, title: "Warehouse Operative", job_text: JOB_TEXT, parsed: { required_skills: ["forklift"] }, is_saved: true, status: "open" },
      { id: JOB_B, agency_id: B, title: "Other agency's job", job_text: JOB_TEXT, parsed: {}, is_saved: true, status: "open" },
    ],
  });
  analyseCV.mockReset();
  analyseCV.mockResolvedValue(ANALYSIS);
});

describe("POST /api/run - refusals before any analysis", () => {
  it("refuses when screening isn't configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect((await run()).status).toBe(500);
  });

  it("refuses an oversized job spec upload before reading it", async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "spec.txt", { type: "text/plain" });
    const res = await run({ jobText: undefined, jobFile: big });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/job spec file is too large/);
    expect(analyseCV).not.toHaveBeenCalled();
  });

  it("refuses a flood from one address", async () => {
    state.limits = ["run-ip:"];
    expect((await run()).status).toBe(429);
  });

  it("passes on a sign-in or subscription refusal", async () => {
    state.auth = { ok: false, status: 402, error: "Subscribe to screen CVs.", upgrade: true };
    const res = await run();
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ ok: false, upgrade: true });
  });

  it("stops at the agency's monthly cap", async () => {
    state.auth.screeningCap = 10;
    state.used = 10;
    const res = await run();
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ capReached: true });
  });

  it.each([
    ["no lawful basis confirmed", { lawfulBasisConfirmed: undefined }],
    ["no CV", { cv: undefined }],
    ["no job description", { jobText: "" }],
    ["an unsupported file", { cv: new File(["x"], "cv.doc", { type: "application/msword" }) }],
    ["a job description under 50 characters", { jobText: "Picker needed." }],
    ["a job description over 50,000 characters", { jobText: "x".repeat(50001) }],
  ])("rejects %s", async (_label, fields) => {
    expect((await run(fields)).status).toBe(400);
    expect(analyseCV).not.toHaveBeenCalled();
  });

  it("counts the hourly allowance only for valid requests, and refuses past it", async () => {
    state.limits = ["run-user:"];
    expect((await run()).status).toBe(429);
    expect(analyseCV).not.toHaveBeenCalled();
  });

  it("won't screen against another agency's saved job, and writes nothing", async () => {
    const res = await run({ jobId: JOB_B });
    expect(res.status).toBe(404);
    expect(analyseCV).not.toHaveBeenCalled();
    expect(state.db.writes()).toEqual([]);
  });
});

describe("POST /api/run - a screening", () => {
  it("saves the candidate, job, score and activity to the member's own agency", async () => {
    const res = await run({ agencyId: B }); // a forged agency in the form is ignored
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, stage: "Screened", duplicate: null });

    const [candidate] = state.db.tables.candidates;
    expect(candidate).toMatchObject({
      id: body.candidateId,
      agency_id: A,
      recruiter_id: "user_a",
      full_name: "Amy Clarke",
      stage: "Screened",
      match_score: 88,
      job_id: body.jobId,
      cv_file_url: `cvs/${body.candidateId}.pdf`,
    });
    const job = state.db.tables.jobs.find((j) => j.id === body.jobId);
    expect(job).toMatchObject({ agency_id: A, title: "Warehouse Operative", role_tier: "entry_level", is_saved: false });
    const [score] = state.db.tables.scores;
    expect(score).toMatchObject({ agency_id: A, candidate_id: candidate.id, job_id: job.id, match_score: 88, stage: "new" });
    expect(score.result.lawful_basis).toMatchObject({ confirmed: true, by: "Alex" });
    expect(state.db.tables.candidate_activity[0]).toMatchObject({ candidate_id: candidate.id, type: "screened" });
  });

  it("reuses a saved job's requirements instead of reading the description again", async () => {
    const res = await run({ jobId: JOB_A });
    const body = await res.json();
    expect(body.jobId).toBe(JOB_A);
    expect(analyseCV.mock.calls[0][2]).toMatchObject({ jobParsed: { required_skills: ["forklift"] } });
    expect(state.db.tables.jobs).toHaveLength(2); // no new job
  });

  it("removes what it created when a later step fails", async () => {
    const realFrom = state.db.from;
    state.db.from = (table) =>
      table === "scores"
        ? { insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { message: "scores insert failed" } }) }) }) }
        : realFrom(table);
    const res = await run();
    expect(res.status).toBe(500);
    expect(state.db.tables.candidates).toEqual([]);
    expect(state.db.tables.jobs.map((j) => j.id)).toEqual([JOB_A, JOB_B]);
  });

  it("explains an unreadable PDF instead of a generic error", async () => {
    analyseCV.mockRejectedValue(new Error("Unable to extract text from PDF"));
    const res = await run();
    expect(res.status).toBe(422);
    expect((await res.json()).error).toMatch(/couldn't read this PDF/);
  });
});

describe("POST /api/run - streamed progress", () => {
  const stream = (fields) =>
    POST(new Request("http://x.test/api/run", { method: "POST", body: form(fields), headers: { "X-Run-Progress": "ndjson" } }));
  const lines = async (res) => (await res.text()).trim().split("\n").map((l) => JSON.parse(l));

  it("sends each stage as it finishes, then the same answer as a plain request", async () => {
    analyseCV.mockImplementation(async (_file, _job, opts) => {
      [1, 2, 3].forEach((s) => opts.onProgress(s));
      return ANALYSIS;
    });
    const res = await stream();
    expect(res.headers.get("content-type")).toContain("ndjson");
    const got = await lines(res);
    expect(got.slice(0, 3)).toEqual([1, 2, 3].map((step) => ({ type: "progress", step })));
    expect(got[3]).toMatchObject({ type: "done", status: 200, body: { ok: true, stage: "Screened" } });
  });

  it("carries a refusal's status in the last line", async () => {
    state.limits = ["run-ip:"];
    const got = await lines(await stream());
    expect(got).toEqual([{ type: "done", status: 429, body: expect.objectContaining({ ok: false }) }]);
  });

  it("answers plain JSON without the header", async () => {
    const res = await run();
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
