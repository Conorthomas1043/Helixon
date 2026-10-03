import { describe, expect, it } from "vitest";
import { buildOps } from "./dashboard-ops";

const now = Date.parse("2026-10-15T10:00:00Z");

const rows = {
  jobs: [
    { id: "j1", title: "Dev", client: "Acme", status: "open", owner_id: "me", priority: "urgent", target_date: "2026-10-10", openings: 2, created_at: "2026-09-01", candidates: [{ stage: "Interview" }, { stage: "Offer" }] },
    { id: "j2", title: "QA", status: "open", owner_id: null, user_id: "other", created_at: "2026-09-05", candidates: [] },
    { id: "j3", title: "Old", status: "closed", owner_id: "me", created_at: "2026-01-01", candidates: [] },
  ],
  interviews: [
    { id: "i1", status: "scheduled", starts_at: "2026-10-15T14:00:00Z", created_by: "me", candidate_id: "c1", candidates: { full_name: "Ana" }, jobs: { title: "Dev" } },
    { id: "i2", status: "scheduled", starts_at: "2026-10-20T09:00:00Z", created_by: "other", candidate_id: "c2", candidates: { full_name: "Ben" } },
    { id: "i3", status: "scheduled", starts_at: "2026-11-30T09:00:00Z", created_by: "me", candidate_id: "c3" },
    { id: "i4", status: "cancelled", starts_at: "2026-10-16T09:00:00Z", created_by: "me", candidate_id: "c4" },
  ],
  placements: [
    { id: "p1", status: "offered", kind: "permanent", recruiter_id: "me", created_at: "2026-10-12" },
    { id: "p2", status: "accepted", kind: "permanent", fee_amount: 10000, offer_date: "2026-10-03", recruiter_id: "me", splits: [{ recruiterId: "me", percent: 50 }, { recruiterId: "other", percent: 50 }] },
    { id: "p3", status: "started", kind: "contract", end_date: "2026-10-20", recruiter_id: "other", candidate_id: "c5", candidate_name: "Cat" },
    { id: "p4", status: "started", kind: "permanent", fee_amount: 5000, offer_date: "2026-08-01", rebate_until: "2026-10-25", recruiter_id: "other", candidate_id: "c6" },
  ],
  invoices: [
    { id: "v1", number: "INV-1", status: "sent", total: 1200, due_on: "2026-10-01", bill_to: { name: "Acme" } },
    { id: "v2", number: "INV-2", status: "sent", total: 800, due_on: "2026-10-30" },
    { id: "v3", number: "INV-3", status: "paid", total: 999, due_on: "2026-09-01" },
  ],
  timesheets: [{ id: "t1", status: "submitted", week_starting: "2026-10-05", placements: { candidate_name: "Cat" } }, { id: "t2", status: "approved", week_starting: "2026-09-28" }],
  checks: [
    { id: "k1", kind: "right_to_work", expires_on: "2026-10-01", candidate_id: "c7", candidates: { full_name: "Dee" } },
    { id: "k2", kind: "dbs", expires_on: "2026-11-01", candidate_id: "c8" },
    { id: "k3", kind: "dbs", expires_on: "2027-06-01", candidate_id: "c9" },
  ],
  clients: [
    { id: "cl1", name: "Acme", owner_id: "me", next_action: { label: "Call Sam", dueAt: "2026-10-14T09:00:00Z" } },
    { id: "cl2", name: "Beta", owner_id: "me", next_action: { label: "Later", dueAt: "2026-10-30T09:00:00Z" } },
  ],
};

describe("buildOps - team", () => {
  const ops = buildOps(rows, { now });
  it("counts the business numbers", () => {
    expect(ops.kpis).toMatchObject({
      openJobs: 2,
      openings: 3,
      interviewsThisWeek: 2,
      interviewsToday: 1,
      offersOut: 1,
      placementsThisMonth: 1,
      feesThisMonth: 10000,
      outstanding: 2000,
      overdueCount: 1,
      overdueTotal: 1200,
    });
  });
  it("raises money and compliance alerts, most urgent first", () => {
    expect(ops.alerts.map((a) => a.kind)).toEqual(["invoice_overdue", "check_expired", "timesheet_pending", "contract_ending", "check_expiring", "job_overdue", "rebate_ending"]);
    expect(ops.alerts[0].title).toBe("Invoice INV-1 is 14 days overdue");
  });
  it("lists active jobs by priority and due client follow-ups", () => {
    expect(ops.activeJobs.map((j) => j.id)).toEqual(["j1", "j2"]);
    expect(ops.activeJobs[0]).toMatchObject({ interviewing: 1, offers: 1, ownerId: "me" });
    expect(ops.activeJobs[1].ownerId).toBe("other");
    expect(ops.clientFollowUps).toEqual([{ id: "cl1", name: "Acme", label: "Call Sam", dueAt: "2026-10-14T09:00:00Z", overdue: true }]);
  });
});

describe("buildOps - mine", () => {
  it("narrows to my jobs, interviews and my share of placements", () => {
    const ops = buildOps(rows, { now, myId: "me", mine: true });
    expect(ops.kpis.openJobs).toBe(1);
    expect(ops.kpis.interviewsThisWeek).toBe(1);
    expect(ops.kpis.placementsThisMonth).toBe(0.5);
    expect(ops.kpis.feesThisMonth).toBe(5000);
    expect(ops.alerts.some((a) => a.kind === "contract_ending")).toBe(false);
  });
});
