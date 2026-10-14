// Fixture answers for the customer API, used by e2e/screens.spec.js to render
// the signed-in screens without a session or a database. One small agency:
// five candidates across the pipeline, three jobs, two clients, interviews,
// a placement and an invoice. Shapes follow the routes (lib/contracts for
// candidates and jobs; the route handlers for the rest). Dates are relative
// to now, so "this week" and "overdue" stay true whenever the test runs.

const DAY = 24 * 60 * 60 * 1000;
const at = (days, hour = 10) => {
  const d = new Date(Date.now() + days * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};
const date = (days) => at(days).slice(0, 10);

const ME = "user_me";
const RECRUITERS = [
  { id: ME, name: "Sam Patel" },
  { id: "user_2", name: "Jo Rivers" },
];

const JOBS = [
  { id: "j1", title: "Senior Software Engineer", client: "Northwind", client_id: "cl1", status: "open", priority: "high", location: "Leeds", employment_type: "Permanent", salary_range: "£65k-£75k", openings: 1, target_date: date(-2), required_skills: ["TypeScript", "React", "Node.js"], created_at: at(-20) },
  { id: "j2", title: "Warehouse Operative", client: "Shopfast", client_id: "cl2", status: "open", priority: "medium", location: "Wakefield", employment_type: "Temporary", salary_range: "£12.60/hr", openings: 6, target_date: date(10), required_skills: ["Order picking", "RF scanner"], created_at: at(-9) },
  { id: "j3", title: "Care Assistant", client: "Northwind", client_id: "cl1", status: "open", priority: null, location: "York", employment_type: "Permanent", salary_range: "£24k", openings: 2, target_date: null, required_skills: ["Personal care"], created_at: at(-4) },
].map((j) => ({ agency_id: "a1", owner_id: ME, user_id: ME, fee_percent: 18, fee_amount: null, published: false, ...j }));

const JOB_COUNTS = {
  j1: { candidateCount: 3, strongMatches: 2, shortlisted: 1, interviewing: 1, offers: 0, placed: 0 },
  j2: { candidateCount: 1, strongMatches: 0, shortlisted: 0, interviewing: 0, offers: 1, placed: 0 },
  j3: { candidateCount: 1, strongMatches: 1, shortlisted: 0, interviewing: 0, offers: 0, placed: 1 },
};

const PEOPLE = [
  { id: "c1", fullName: "Amy Clarke", currentTitle: "Senior Engineer", currentCompany: "Fintrack", jobId: "j1", stage: "Interview", score: 91, location: "Leeds", tags: ["Referral"], skills: ["TypeScript", "React", "Node.js"], days: -1 },
  { id: "c2", fullName: "Jordan Williams", currentTitle: "Full-stack Developer", currentCompany: "Bright Labs", jobId: "j1", stage: "Shortlisted", score: 84, location: "Bradford", tags: [], skills: ["React", "Python"], days: -2 },
  { id: "c3", fullName: "Priya Shah", currentTitle: "Frontend Engineer", currentCompany: "Loop", jobId: "j1", stage: "Screened", score: 62, location: "Manchester", tags: [], skills: ["Vue", "CSS"], days: 0, aiWritten: true },
  { id: "c4", fullName: "Tom Hughes", currentTitle: "Picker Packer", currentCompany: "Parcelco", jobId: "j2", stage: "Offer", score: 78, location: "Wakefield", tags: ["Nights"], skills: ["Order picking"], days: -3 },
  { id: "c5", fullName: "Grace Okafor", currentTitle: "Care Worker", currentCompany: "Hillside Care", jobId: "j3", stage: "Placed", score: 88, location: "York", tags: [], skills: ["Personal care", "Medication"], days: -6 },
];

const job = (id) => JOBS.find((j) => j.id === id);

const LIST_ITEMS = PEOPLE.map((p) => ({
  id: p.id,
  fullName: p.fullName,
  currentTitle: p.currentTitle,
  currentCompany: p.currentCompany,
  location: p.location,
  jobId: p.jobId,
  jobTitle: job(p.jobId).title,
  company: job(p.jobId).client,
  recruiterId: ME,
  recruiterName: "Sam Patel",
  status: "completed",
  stage: p.stage,
  subStage: null,
  score: p.score,
  tags: p.tags,
  nextAction: p.id === "c2" ? { label: "Send to client", dueAt: at(-1), completed: false } : null,
  source: "Upload",
  createdAt: at(p.days - 1),
  lastActivityAt: at(p.days),
  skills: p.skills,
  aiWritten: Boolean(p.aiWritten),
  inTalentPool: p.id === "c3",
  distanceMiles: null,
}));

const STAGE_COUNTS = PEOPLE.reduce((c, p) => ({ ...c, [p.stage]: (c[p.stage] || 0) + 1 }), { all: PEOPLE.length });

const REPORT = {
  score: 91,
  verdict: "Strong match",
  summary: "Seven years building React and Node.js products, four of them leading a team of five. Meets every required skill with evidence in the CV.",
  strengths: ["Led the rebuild of a payments dashboard in React and TypeScript", "Mentors two junior engineers", "Owns the Node.js API for a 40k-user product"],
  concerns: ["No AWS experience mentioned", "Notice period not stated"],
  interviewQuestions: ["Walk me through how you split the payments dashboard into components.", "What would you need to get up to speed on AWS?"],
};

const PROFILE = {
  ...LIST_ITEMS[0],
  email: "amy.clarke@example.com",
  phone: "07700 900123",
  linkedin: null,
  yearsExperience: 7,
  job: job("j1"),
  customFields: {},
  matchSummary: REPORT.summary,
  strengths: REPORT.strengths,
  concerns: REPORT.concerns,
  skills: ["TypeScript", "React", "Node.js", "PostgreSQL"],
  education: [],
  workHistory: [
    { title: "Senior Engineer", company: "Fintrack", start: "2021", end: null, description: null },
    { title: "Software Engineer", company: "Ledgerly", start: "2018", end: null, description: null },
  ],
  resume: { name: "amy-clarke-cv.pdf", uploadedAt: at(-2) },
  hasCvText: true,
  screenedBlind: false,
  analysis: { scoreId: "s1", jobId: "j1", jobTitle: "Senior Software Engineer", jobClient: "Northwind", analysedAt: at(-2), report: REPORT },
  talentPool: null,
  otherRoles: [],
  rejectionReason: null,
  placementFee: null,
  placementCost: null,
  retention30d: null,
  retention90d: null,
  notes: [{ id: "n1", author: "Sam Patel", authorId: ME, createdAt: at(-1), body: "Strong first call. Available in four weeks.", pinnedAt: null }],
  activity: [
    { id: "ac1", type: "stage_changed", actor: "Sam Patel", meta: { from: "Shortlisted", to: "Interview" }, timestamp: at(-1) },
    { id: "ac2", type: "analysed", actor: "Sam Patel", meta: {}, timestamp: at(-2) },
  ],
};
delete PROFILE.inTalentPool;
delete PROFILE.distanceMiles;
delete PROFILE.aiWritten;

const CLIENTS = [
  { id: "cl1", name: "Northwind", industry: "Software", status: "active", feePercent: 18, paymentTermsDays: 30, rebateDays: 90, ownerId: ME, ownerName: "Sam Patel", nextAction: { label: "Call Lisa about the care roles", dueAt: at(-1) }, contacts: 3, openJobs: 2, jobs: 4, placements: 2, fees: 21600 },
  { id: "cl2", name: "Shopfast", industry: "Logistics", status: "active", feePercent: 15, paymentTermsDays: 14, rebateDays: 60, ownerId: "user_2", ownerName: "Jo Rivers", nextAction: null, contacts: 1, openJobs: 1, jobs: 1, placements: 0, fees: 0 },
].map((c) => ({ website: null, address: null, termsNotes: null, customFields: {}, termsSignedAt: null, createdAt: at(-60), updatedAt: at(-3), ...c }));

const INTERVIEWS = [
  { id: "i1", candidateId: "c1", candidateName: "Amy Clarke", jobId: "j1", jobTitle: "Senior Software Engineer", client: "Northwind", round: 2, kind: "video", startsAt: at(1, 14), durationMinutes: 60, status: "scheduled" },
  { id: "i2", candidateId: "c2", candidateName: "Jordan Williams", jobId: "j1", jobTitle: "Senior Software Engineer", client: "Northwind", round: 1, kind: "phone", startsAt: at(2, 11), durationMinutes: 30, status: "scheduled" },
].map((i) => ({ contactId: null, location: null, interviewers: "Lisa Chen", notes: null, outcome: null, invitedAt: at(-1), createdBy: ME, createdAt: at(-1), candidateEmail: null, recruiterName: "Sam Patel", clientId: "cl1", contactName: "Lisa Chen", contactEmail: null, scorecards: [], scorecardSummary: null, ...i }));

const PLACEMENTS = [
  { id: "p1", candidateId: "c5", jobId: "j3", clientId: "cl1", recruiterId: ME, recruiterName: "Sam Patel", candidateName: "Grace Okafor", jobTitle: "Care Assistant", clientName: "Northwind", kind: "permanent", status: "started", currency: "GBP", offerDate: date(-12), startDate: date(-5), endDate: null, salary: 24000, feePercent: 18, feeAmount: 4320, rateUnit: null, payRate: null, chargeRate: null, rebateDays: 90, rebateUntil: date(85), notes: null, splits: null, createdAt: at(-12), invoices: [{ id: "inv1", number: "INV-0007", status: "sent", total: 5184, due_date: date(9) }] },
];

const INVOICES = [{ id: "inv1", number: "INV-0007", status: "sent", client_id: "cl1", client_name: "Northwind", placement_id: "p1", currency: "GBP", subtotal: 4320, vat: 864, total: 5184, issue_date: date(-5), due_date: date(9), created_at: at(-5) }];

const TEAM = RECRUITERS.map((r, i) => ({
  id: r.id,
  name: r.name,
  role: i === 0 ? "owner" : "recruiter",
  presenceRaw: null,
  presence: null,
  lastWorkedAt: at(0),
  screenedToday: 2 - i,
  totalCandidates: i === 0 ? 5 : 0,
  activeCandidates: i === 0 ? 4 : 0,
  awaitingReview: i === 0 ? 1 : 0,
  interviewing: i === 0 ? 1 : 0,
  placed: i === 0 ? 1 : 0,
  overdue: i === 0 ? 1 : 0,
}));

const STATS = {
  agencyName: "Calder Recruitment",
  plan: { name: "Agency", analysesUsed: 214, analysesLimit: null },
  truncated: false,
  analyses: LIST_ITEMS.map((c) => ({
    id: c.id,
    candidateId: c.id,
    candidateName: c.fullName,
    jobId: c.jobId,
    jobTitle: c.jobTitle,
    company: c.company,
    recruiterId: ME,
    recruiterName: "Sam Patel",
    status: "completed",
    stage: c.stage,
    score: c.score,
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt,
    nextAction: c.nextAction,
  })),
};

const OPS = {
  kpis: { openJobs: 3, openings: 9, interviewsThisWeek: 2, interviewsToday: 0, offersOut: 1, placementsThisMonth: 1, feesThisMonth: 4320, outstanding: 5184, overdueCount: 0, overdueTotal: 0 },
  alerts: [{ id: "job-j1", kind: "job_overdue", tone: "amber", title: "Senior Software Engineer is past its fill-by date", detail: "Northwind", href: "/dashboard/jobs/j1", priority: 2.5 }],
  interviews: INTERVIEWS.map((i) => ({ id: i.id, startsAt: i.startsAt, round: i.round, kind: i.kind, candidateId: i.candidateId, candidateName: i.candidateName, jobTitle: i.jobTitle })),
  interviewsTotal: 2,
  activeJobs: JOBS.map((j) => ({ id: j.id, title: j.title, client: j.client, ownerId: ME, priority: j.priority, targetDate: j.target_date, openings: j.openings, candidates: JOB_COUNTS[j.id].candidateCount, interviewing: JOB_COUNTS[j.id].interviewing, offers: JOB_COUNTS[j.id].offers, placed: JOB_COUNTS[j.id].placed, createdAt: j.created_at })),
  activeJobsTotal: 3,
  clientFollowUps: [{ id: "cl1", name: "Northwind", label: "Call Lisa about the care roles", dueAt: at(-1), overdue: true }],
  financialsHidden: false,
};

const TALENT_POOL = {
  total: 1,
  items: [
    {
      id: "c3",
      name: "Priya Shah",
      currentTitle: "Frontend Engineer",
      currentCompany: "Loop",
      location: "Manchester",
      yearsExperience: 5,
      skills: ["Vue", "CSS", "Accessibility"],
      savedAt: at(-5),
      savedBy: "Sam Patel",
      note: "Good frontend, wants hybrid",
      status: "available",
      checkIn: date(20),
      expiresAt: null,
      hasCv: true,
      roles: [{ candidateId: "c3", jobId: "j1", jobTitle: "Senior Software Engineer", client: "Northwind", score: 62, stage: "Screened" }],
      bestMatch: null,
    },
  ],
  stats: { total: 1, available: 1, checkInsDue: 0, addedLast30: 1 },
  topSkills: [{ label: "Vue", count: 1 }, { label: "CSS", count: 1 }, { label: "Accessibility", count: 1 }],
  openJobs: [],
  job: null,
};

const SMS = { configured: false, phone: "+447700900123", messages: [] };

const CUSTOMISATION = { subStages: [], customFields: [], canManage: true };

const PERFORMANCE = {
  period: { key: "month", label: "This month", months: 1, from: date(-13), to: date(0) },
  financialsHidden: false,
  people: [],
  team: { metrics: {}, targets: {} },
  commission: null,
  canManage: true,
};

const ROUTES = {
  "GET /api/auth/me": { ok: true, user: { id: ME, email: "sam@calder.example", firstName: "Sam", agencyName: "Calder Recruitment", agencyId: "a1", plan: "agency", hasAgency: true, paymentIssue: null } },
  "GET /api/dashboard-stats": STATS,
  "GET /api/dashboard-ops": OPS,
  "GET /api/candidates": { items: LIST_ITEMS, total: LIST_ITEMS.length, searchMode: null, page: 1, pageSize: 25, totalPages: 1 },
  "GET /api/candidates/stage-counts": STAGE_COUNTS,
  "GET /api/candidates/c1": PROFILE,
  "GET /api/candidates/c1/feedback-requests": { requests: [] },
  "GET /api/candidates/c1/emails": { messages: [], enrollments: [] },
  "GET /api/candidates/c1/sms": SMS,
  "GET /api/candidates/c1/compliance": { checks: [], references: [], privacy: { consentGivenAt: at(-2), consentSource: "Email", noticeSentAt: at(-2), due: null } },
  "GET /api/candidates/c1/booking-links": { links: [] },
  "GET /api/candidates/c1/portal-link": { link: null },
  "GET /api/signatures": { requests: [] },
  "GET /api/jobs": JOBS.map((j) => ({ ...j, ...JOB_COUNTS[j.id] })),
  "GET /api/clients": { clients: CLIENTS },
  "GET /api/interviews": { interviews: INTERVIEWS },
  "GET /api/placements": { placements: PLACEMENTS, financialsHidden: false },
  "GET /api/invoices": { invoices: INVOICES },
  "GET /api/talent-pool": TALENT_POOL,
  "GET /api/team": TEAM,
  "GET /api/tags": { tags: ["Referral", "Nights", "Relocating"] },
  "GET /api/notifications": { notifications: [], unread: 0 },
  "GET /api/email-sequences": { sequences: [] },
  "GET /api/research": { ok: true, pulseDue: false, optedIn: false },
  "GET /api/site": { announcement: null },
  "GET /api/customisation": CUSTOMISATION,
  "GET /api/performance": PERFORMANCE,
  "GET /api/follow-ups": { items: [], truncated: false },
  "GET /api/placements/p1": { placement: { ...PLACEMENTS[0], margin: null }, invoices: INVOICES, timesheets: [] },
  "GET /api/settings/offices": { offices: [], canManage: true },
  "POST /api/integrations/connections": { providers: [], canManage: true, sms: { configured: false, webhookUrl: null }, site: "http://localhost" },
  "GET /api/integrations/connections": { providers: [], canManage: true, sms: { configured: false, webhookUrl: null }, site: "http://localhost" },
};

/**
 * The fixture answer for a request, or null when there isn't one.
 * @param {string} method
 * @param {string} pathname
 * @returns {{ status: number, body: unknown } | null}
 */
export function apiFixture(method, pathname) {
  const body = ROUTES[`${method} ${pathname}`];
  return body === undefined ? null : { status: 200, body };
}
