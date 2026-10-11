// The routes with a response contract (lib/contracts/), called for real
// against an in-memory database, and their answers parsed with the contract.
// The contracts are what lib/api-client and the pages are typed against, so
// a route that renames, drops or adds a key fails here.
//
// fakeDb doesn't resolve embedded selects (`jobs(...)`, `candidates(...)`),
// so the rows below carry them already, the way PostgREST returns them.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeDb } from "@/test/fake-db";
import { BillingSummarySchema } from "@/lib/contracts/billing";
import { JobListSchema, JobWithCountsSchema } from "@/lib/contracts/jobs";
import { CandidateListPageSchema, CandidateProfileSchema, StageCountsSchema } from "@/lib/contracts/candidates";
import { ApiErrorBodySchema } from "@/lib/contracts/common";
import { adaptJob } from "@/lib/api-client/jobs";
import { shapeCandidate } from "@/lib/candidates/shape";

const A = "00000000-0000-4000-8000-00000000000a";
const JOB = "55555555-5555-4555-8555-55555555555a";
const CAND = "11111111-1111-4111-8111-11111111111a";
const CAND_2 = "11111111-1111-4111-8111-11111111112a";
const SCORE = "66666666-6666-4666-8666-66666666666a";

const state = vi.hoisted(() => ({ db: null, auth: null, context: null, access: null }));

vi.mock("@/lib/supabase", () => ({
  get supabase() {
    return state.db;
  },
}));
vi.mock("@/lib/agency-db", () => ({ agencyDb: async () => state.db }));
vi.mock("@/lib/auth/customer-auth", () => ({
  requireCustomerContext: async () => state.auth,
  getCustomerContext: async () => state.context,
}));
vi.mock("@/lib/agency/permissions", async (importOriginal) => ({
  ...(await importOriginal()),
  getAccess: async () => state.access,
  candidateHidden: async () => false,
  scopeCandidateQuery: (q) => q,
}));
vi.mock("@/lib/billing/plan", () => ({ getAgencyPlan: async () => "agency" }));
vi.mock("@/lib/agency/recruiter-directory", () => ({
  recruiterDisplayName: () => "Ada",
  resolveRecruiterNames: async (_db, ids) => new Map(ids.filter(Boolean).map((id) => [id, "Ada Lovelace"])),
}));
vi.mock("@/lib/report-error", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));

const billing = await import("./billing/route");
const jobs = await import("./jobs/route");
const job = await import("./jobs/[id]/route");
const candidates = await import("./candidates/route");
const stageCounts = await import("./candidates/stage-counts/route");
const candidate = await import("./candidates/[id]/route");

const call = (handler, { id, query = "" } = {}) =>
  handler(new Request(`http://x.test/api/thing${query}`), { params: Promise.resolve({ id }) });

const JOB_ROW = {
  id: JOB,
  agency_id: A,
  user_id: "user_a",
  owner_id: null,
  title: "Senior Data Engineer",
  client: "Acme",
  client_id: null,
  client_email: null,
  contact_id: null,
  status: "open",
  is_saved: true,
  location: "Leeds",
  employment_type: "Permanent",
  seniority: "Senior",
  salary_range: "£70k-£80k",
  required_skills: ["SQL", "Python"],
  preferred_skills: [],
  min_years_experience: 5,
  published: false,
  published_at: null,
  public_title: null,
  public_description: null,
  hide_client: true,
  show_salary: true,
  openings: 1,
  fee_percent: 20,
  fee_amount: null,
  priority: null,
  target_date: null,
  office_id: null,
  job_text: "A long enough description of the role.",
  parsed: {},
  created_at: "2026-10-01T09:00:00.000Z",
};

beforeEach(() => {
  state.auth = { ok: true, agencyId: A, userId: "user_a", profile: { id: "pa" } };
  state.context = { user: { id: "user_a" }, agencyId: A, profile: { id: "pa", agency_id: A } };
  state.access = { canSeeFinancials: true, seesAllCandidates: true };
  state.db = fakeDb({
    agencies: [{ id: A, name: "Northgate", plan_name: "agency", analyses_used: 4, settings: {} }],
    subscriptions: [{ user_id: "pa", plan: "agency", status: "active", stripe_customer_id: "cus_A", updated_at: "2026-10-01T00:00:00" }],
    jobs: [
      {
        ...JOB_ROW,
        candidates: [
          { id: CAND, processing_status: "completed", stage: "Shortlisted", match_score: 86 },
          { id: CAND_2, processing_status: "completed", stage: "Screened", match_score: null },
        ],
      },
    ],
    candidates: [
      {
        id: CAND,
        agency_id: A,
        full_name: "Grace Hopper",
        name: "Grace Hopper",
        email: "grace@example.com",
        phone: null,
        linkedin: null,
        current_title: "Data Engineer",
        current_company: "Initech",
        location: "Leeds",
        processing_status: "completed",
        stage: "Shortlisted",
        sub_stage: null,
        match_score: 86,
        match_summary: "Strong SQL and pipeline work.",
        strengths: ["SQL"],
        concerns: [],
        tags: ["tag-1"],
        next_action: { label: "Call back", dueAt: null, completed: false },
        recruiter_id: "user_a",
        job_id: JOB,
        source: "LinkedIn",
        custom_fields: {},
        cv_text: "CV text",
        cv_file_url: "agency/cand.pdf",
        cv_filename: "grace.pdf",
        extracted: { skills: ["SQL", "Python"], education: ["BSc Maths"], positions: [{ title: "Data Engineer", company: "Initech", duration: "2019-2026" }] },
        skills: ["SQL", "Python"],
        // What the list's extracted->ai_writing select returns.
        ai_writing: { likelihood: "high", signals: ["Stock phrasing", "No figures"] },
        pooled_from_id: null,
        talent_pool_at: null,
        rejection_reason: null,
        placement_fee: null,
        placement_cost: null,
        retention_30d: null,
        retention_90d: null,
        lat: null,
        lng: null,
        created_at: "2026-10-02T09:00:00.000Z",
        last_activity_at: "2026-10-03T09:00:00.000Z",
        jobs: JOB_ROW,
      },
    ],
    scores: [
      {
        id: SCORE,
        agency_id: A,
        candidate_id: CAND,
        job_id: JOB,
        created_at: "2026-10-02T09:00:00.000Z",
        result: { match_score: 86, recommendation: "Shortlist", summary: "Strong SQL.", strengths: ["SQL"], blind_mode: false },
        jobs: { title: JOB_ROW.title, client: JOB_ROW.client },
      },
    ],
    candidate_notes: [
      { id: "note-1", candidate_id: CAND, author_id: "user_a", author_name: "Ada", note: "Keen to move.", created_at: "2026-10-03T09:00:00.000Z", pinned_at: null },
    ],
    candidate_activity: [{ id: "act-1", candidate_id: CAND, type: "screened", actor: "Ada", meta: { job_id: JOB }, created_at: "2026-10-02T09:00:00.000Z" }],
  });
});

describe("GET /api/billing matches BillingSummary", () => {
  it("for a member of an agency", async () => {
    const res = await billing.GET();
    expect(res.status).toBe(200);
    const body = BillingSummarySchema.parse(await res.json());
    expect(body).toEqual({
      ok: true,
      agencyName: "Northgate",
      plan: "agency",
      analysesUsed: 4,
      subscription: { plan: "agency", status: "active", updatedAt: "2026-10-01T00:00:00", hasStripeCustomer: true },
    });
  });

  it("for a teammate with no subscription of their own", async () => {
    state.context.profile = { id: "pz", agency_id: A };
    const body = BillingSummarySchema.parse(await (await billing.GET()).json());
    expect(body.subscription).toBeNull();
    expect(body.plan).toBe("agency");
  });

  it("for someone not yet in an agency", async () => {
    state.context.agencyId = null;
    BillingSummarySchema.parse(await (await billing.GET()).json());
  });
});

describe("jobs match JobWithCounts", () => {
  it("GET /api/jobs", async () => {
    const res = await call(jobs.GET);
    expect(res.status).toBe(200);
    const [row] = JobListSchema.parse(await res.json());
    expect(row).toMatchObject({ id: JOB, candidateCount: 2, strongMatches: 1, shortlisted: 1 });
    expect(row).not.toHaveProperty("candidates");
  });

  it("GET /api/jobs/[id], with money hidden from a member who can't see it", async () => {
    state.access = { canSeeFinancials: false, seesAllCandidates: true };
    const res = await call(job.GET, { id: JOB });
    expect(res.status).toBe(200);
    const row = JobWithCountsSchema.parse(await res.json());
    expect(row).toMatchObject({ fee_percent: null, financialsHidden: true, candidateCount: 2 });
  });

  it("a missing job is an error body", async () => {
    const res = await call(job.GET, { id: "nope" });
    expect(res.status).toBe(404);
    ApiErrorBodySchema.parse(await res.json());
  });

  it("adaptJob reads the contract's columns", async () => {
    const [row] = JobListSchema.parse(await (await call(jobs.GET)).json());
    expect(adaptJob(row)).toMatchObject({ company: "Acme", requiredSkills: ["SQL", "Python"], feePercent: 20, hideClient: true, candidateCount: 2 });
  });
});

describe("candidates match their contracts", () => {
  it("GET /api/candidates", async () => {
    const res = await call(candidates.GET, { query: "?page=1&pageSize=20" });
    expect(res.status).toBe(200);
    const page = CandidateListPageSchema.parse(await res.json());
    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 20, totalPages: 1, searchMode: null });
    expect(page.items[0]).toMatchObject({ fullName: "Grace Hopper", jobTitle: "Senior Data Engineer", company: "Acme", recruiterName: "Ada Lovelace", skills: ["SQL", "Python"], aiWritten: true });
  });

  it("GET /api/candidates/stage-counts", async () => {
    const res = await call(stageCounts.GET);
    expect(res.status).toBe(200);
    const counts = StageCountsSchema.parse(await res.json());
    expect(counts).toMatchObject({ all: 1, Shortlisted: 1 });
  });

  it("GET /api/candidates/[id]", async () => {
    const res = await call(candidate.GET, { id: CAND });
    expect(res.status).toBe(200);
    const profile = CandidateProfileSchema.parse(await res.json());
    expect(profile).toMatchObject({
      fullName: "Grace Hopper",
      resume: { name: "grace.pdf" },
      analysis: { scoreId: SCORE, jobTitle: "Senior Data Engineer" },
      notes: [{ body: "Keen to move." }],
      activity: [{ type: "screened" }],
    });
    expect(shapeCandidate(profile).job?.company).toBe("Acme");
  });

  it("a candidate in no agency of yours is an error body", async () => {
    const res = await call(candidate.GET, { id: "nope" });
    expect(res.status).toBe(404);
    ApiErrorBodySchema.parse(await res.json());
  });
});
