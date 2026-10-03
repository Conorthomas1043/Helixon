// The running-the-desk half of the Overview (app/api/dashboard-ops): open
// jobs, interviews coming up, offers out, placements and fees this month,
// cash owed, and the money and compliance risks that need someone today.
// Pure, so the rules are tested; the route only loads rows.

import { creditShares } from "./placements";
import { jobOwnerId, priorityRank } from "./job-details";

const DAY = 86400000;
const PLACED = ["accepted", "started", "completed"];

const isoDay = (t) => new Date(t).toISOString().slice(0, 10);

// rows: { jobs, interviews, placements, invoices, timesheets, checks, clients }
//   jobs:        { id, title, client, status, owner_id, user_id, priority,
//                  target_date, openings, created_at, candidates: [{ stage }] }
//   interviews:  { id, starts_at, status, round, kind, created_by,
//                  candidate_id, candidates: { full_name, name, recruiter_id }, jobs: { title } }
//   placements:  { id, status, kind, fee_amount, currency, offer_date, created_at,
//                  start_date, end_date, rebate_until, recruiter_id, splits,
//                  candidate_id, candidate_name, client_name }
//   invoices:    { id, number, status, total, currency, due_on, client_id, bill_to }
//   timesheets:  { id, status, week_starting, placement_id, placements: { candidate_name } }
//   checks:      { id, kind, label, status, expires_on, candidate_id, candidates: { full_name, name } }
//   clients:     { id, name, owner_id, next_action }
// opts: { now, myId, mine } - mine narrows people-owned things to myId.
export function buildOps(rows, { now = Date.now(), myId = null, mine = false } = {}) {
  const today = isoDay(now);
  const in7 = isoDay(now + 7 * DAY);
  const in14 = isoDay(now + 14 * DAY);
  const in30 = isoDay(now + 30 * DAY);
  const monthStart = `${today.slice(0, 7)}-01`;
  const mineFilter = (id) => !mine || !myId || id === myId;
  const shareOf = (p) => {
    if (!mine || !myId) return 1;
    return creditShares(p).find((s) => s.id === myId)?.share ?? 0;
  };

  const jobs = (rows.jobs || []).filter((j) => mineFilter(jobOwnerId(j)));
  const openJobs = jobs.filter((j) => j.status === "open");

  const interviews = (rows.interviews || [])
    .filter((i) => i.status === "scheduled" && mineFilter(i.created_by || i.candidates?.recruiter_id))
    .filter((i) => i.starts_at >= new Date(now - 2 * 3600000).toISOString() && i.starts_at < `${in7}T23:59:59Z`)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  const placements = (rows.placements || []).filter((p) => shareOf(p) > 0);
  const offerDay = (p) => String(p.offer_date || p.created_at || "").slice(0, 10);
  const offersOut = placements.filter((p) => p.status === "offered");
  const placedThisMonth = placements.filter((p) => PLACED.includes(p.status) && offerDay(p) >= monthStart && offerDay(p) <= today);
  const feesThisMonth = placedThisMonth
    .filter((p) => p.kind === "permanent" && p.fee_amount != null)
    .reduce((n, p) => n + Number(p.fee_amount) * shareOf(p), 0);

  const invoices = rows.invoices || [];
  const unpaid = invoices.filter((i) => i.status === "sent");
  const overdueInvoices = unpaid.filter((i) => i.due_on && i.due_on < today);
  const sumTotal = (list) => Math.round(list.reduce((n, i) => n + Number(i.total || 0), 0) * 100) / 100;

  const alerts = [];
  for (const inv of overdueInvoices) {
    const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${inv.due_on}T00:00:00Z`)) / DAY);
    alerts.push({
      id: `invoice-${inv.id}`,
      kind: "invoice_overdue",
      tone: "red",
      title: `Invoice ${inv.number} is ${days} day${days === 1 ? "" : "s"} overdue`,
      detail: inv.bill_to?.name || null,
      amount: Number(inv.total || 0),
      currency: inv.currency || "GBP",
      href: "/dashboard/placements?tab=invoices",
      priority: 0,
      sortKey: inv.due_on,
    });
  }
  for (const c of rows.checks || []) {
    if (!c.expires_on || c.expires_on > in30) continue;
    const expired = c.expires_on < today;
    alerts.push({
      id: `check-${c.id}`,
      kind: expired ? "check_expired" : "check_expiring",
      tone: expired ? "red" : "amber",
      title: `${c.label || CHECK_LABELS[c.kind] || "Check"} ${expired ? "expired" : "expires"} ${formatDay(c.expires_on)}`,
      detail: c.candidates?.full_name || c.candidates?.name || null,
      href: `/dashboard/candidates/${c.candidate_id}`,
      priority: expired ? 0.5 : 2,
      sortKey: c.expires_on,
    });
  }
  for (const t of rows.timesheets || []) {
    if (t.status !== "submitted") continue;
    alerts.push({
      id: `timesheet-${t.id}`,
      kind: "timesheet_pending",
      tone: "amber",
      title: `Timesheet to approve - week of ${formatDay(t.week_starting)}`,
      detail: t.placements?.candidate_name || null,
      href: "/dashboard/placements?kind=contract",
      priority: 1,
      sortKey: t.week_starting,
    });
  }
  for (const p of placements) {
    if (p.kind === "contract" && p.status === "started" && p.end_date && p.end_date >= today && p.end_date <= in14) {
      alerts.push({
        id: `contract-${p.id}`,
        kind: "contract_ending",
        tone: "amber",
        title: `Contract ends ${formatDay(p.end_date)} - extend or redeploy`,
        detail: [p.candidate_name, p.client_name].filter(Boolean).join(" · ") || null,
        href: `/dashboard/candidates/${p.candidate_id}`,
        priority: 1.5,
        sortKey: p.end_date,
      });
    }
    if (p.kind !== "contract" && PLACED.includes(p.status) && p.rebate_until && p.rebate_until >= today && p.rebate_until <= in14) {
      alerts.push({
        id: `rebate-${p.id}`,
        kind: "rebate_ending",
        tone: "neutral",
        title: `Rebate period ends ${formatDay(p.rebate_until)} - check in before it does`,
        detail: [p.candidate_name, p.client_name].filter(Boolean).join(" · ") || null,
        href: `/dashboard/candidates/${p.candidate_id}`,
        priority: 3,
        sortKey: p.rebate_until,
      });
    }
  }
  for (const j of openJobs) {
    if (j.target_date && j.target_date < today) {
      alerts.push({
        id: `job-${j.id}`,
        kind: "job_overdue",
        tone: "amber",
        title: `${j.title} is past its fill-by date`,
        detail: j.client || null,
        href: `/dashboard/jobs/${j.id}`,
        priority: 2.5,
        sortKey: j.target_date,
      });
    }
  }
  alerts.sort((a, b) => a.priority - b.priority || String(a.sortKey).localeCompare(String(b.sortKey)));

  const clientFollowUps = (rows.clients || [])
    .filter((c) => c.next_action?.label && mineFilter(c.next_action.ownerId || c.owner_id))
    .filter((c) => !c.next_action.dueAt || c.next_action.dueAt.slice(0, 10) <= today)
    .map((c) => ({ id: c.id, name: c.name, label: c.next_action.label, dueAt: c.next_action.dueAt || null, overdue: Boolean(c.next_action.dueAt && c.next_action.dueAt.slice(0, 10) < today) }))
    .sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || ""));

  const activeJobs = openJobs
    .map((j) => {
      const cands = j.candidates || [];
      return {
        id: j.id,
        title: j.title,
        client: j.client || null,
        ownerId: jobOwnerId(j),
        priority: j.priority || null,
        targetDate: j.target_date || null,
        openings: j.openings || null,
        candidates: cands.length,
        interviewing: cands.filter((c) => c.stage === "Interview").length,
        offers: cands.filter((c) => c.stage === "Offer").length,
        placed: cands.filter((c) => c.stage === "Placed").length,
        createdAt: j.created_at,
      };
    })
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (a.targetDate || "9999").localeCompare(b.targetDate || "9999") || String(b.createdAt).localeCompare(String(a.createdAt)));

  return {
    kpis: {
      openJobs: openJobs.length,
      openings: openJobs.reduce((n, j) => n + (j.openings || 1), 0),
      interviewsThisWeek: interviews.length,
      interviewsToday: interviews.filter((i) => i.starts_at.slice(0, 10) === today).length,
      offersOut: offersOut.length,
      placementsThisMonth: Math.round(placedThisMonth.reduce((n, p) => n + shareOf(p), 0) * 100) / 100,
      feesThisMonth: Math.round(feesThisMonth * 100) / 100,
      outstanding: sumTotal(unpaid),
      overdueCount: overdueInvoices.length,
      overdueTotal: sumTotal(overdueInvoices),
    },
    alerts,
    interviews: interviews.slice(0, 8).map((i) => ({
      id: i.id,
      startsAt: i.starts_at,
      round: i.round,
      kind: i.kind,
      candidateId: i.candidate_id,
      candidateName: i.candidates?.full_name || i.candidates?.name || "Candidate",
      jobTitle: i.jobs?.title || null,
    })),
    interviewsTotal: interviews.length,
    activeJobs: activeJobs.slice(0, 6),
    activeJobsTotal: activeJobs.length,
    clientFollowUps,
  };
}

const CHECK_LABELS = { right_to_work: "Right to work", dbs: "DBS check", identity: "ID check", qualification: "Qualification", licence: "Licence", other: "Check" };

function formatDay(day) {
  return new Date(`${String(day).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}
