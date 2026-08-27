/* ------------------------------------------------------------------------
 * lib/mock-data.js
 * ------------------------------------------------------------------------
 * WHAT THIS FILE IS
 * A single in-memory "database" standing in for a real backend, plus a
 * set of functions shaped like the API this app will eventually call:
 *
 *   getMockData()              → GET /api/agency/me            (existing)
 *   getCandidates(query)       → GET /api/candidates
 *   getCandidateById(id)       → GET /api/candidates/:id
 *   getJobs()                  → GET /api/jobs
 *   getJobById(id)             → GET /api/jobs/:id
 *   getJobCandidates(id)       → GET /api/jobs/:id/candidates
 *   getRecruiters()            → GET /api/team
 *   getTagCatalog()            → GET /api/tags
 *   updateCandidateStage(...)  → PATCH /api/candidates/:id/stage
 *   assignCandidate(...)       → PATCH /api/candidates/:id/assignment
 *   addCandidateNote(...)      → POST  /api/candidates/:id/notes
 *   addCandidateTag(...)       → POST  /api/candidates/:id/tags
 *   removeCandidateTag(...)    → DELETE /api/candidates/:id/tags/:tagId
 *   setCandidateNextAction(...)→ PATCH /api/candidates/:id/next-action
 *   completeNextAction(...)    → PATCH /api/candidates/:id/next-action
 *
 * WHY THIS SHAPE
 * Every "mutation" below mutates the module-level CANDIDATES array in
 * place and appends an activity entry, so the app behaves consistently
 * across pages for the lifetime of the session - without a database.
 * When a real backend exists, each function's *body* is what gets
 * replaced with a `fetch()` call; the call sites in the UI (which only
 * know about the function signatures below) should not need to change.
 * `getCandidates` in particular is written as if it were a server-side
 * filter/sort/paginate query, for the same reason: swapping its body for
 * `fetch("/api/candidates?" + new URLSearchParams(query))` should be a
 * one-file change.
 *
 * WHAT'S DELIBERATELY NOT HERE
 * Auth/permissions, jobs CRUD, team CRUD, notifications, and analytics
 * aggregation are out of scope for this pass - see ASSUMPTIONS.md in this
 * delivery for the full list of what's built vs. deferred.
 * ---------------------------------------------------------------------- */

const DAY = 86400000;
const NOW = Date.now();

function agoISO(daysAgo, hour = 9, minute = 0) {
  const d = new Date(NOW - daysAgo * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/* ------------------------------------------------------------------------
 * Pipeline stages - single source of truth for ordering everywhere
 * (dashboard, candidate list, candidate profile, job rankings).
 * ---------------------------------------------------------------------- */

export const STAGE_LABELS = {
  new: "New",
  reviewing: "Reviewing",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  placed: "Placed",
};

export const STAGE_ORDER = Object.keys(STAGE_LABELS);

/* ------------------------------------------------------------------------
 * Tag catalogue - small and backend-driven in spirit: the UI reads from
 * this list rather than hard-coding tag names inline.
 * ---------------------------------------------------------------------- */

export const TAG_CATALOG = [
  { id: "strong-technical", label: "Strong technical" },
  { id: "urgent", label: "Urgent" },
  { id: "client-ready", label: "Client-ready" },
  { id: "remote-only", label: "Remote only" },
  { id: "senior-profile", label: "Senior profile" },
  { id: "follow-up", label: "Needs follow-up" },
  { id: "referral", label: "Referral" },
];

function tagLabel(id) {
  return TAG_CATALOG.find((t) => t.id === id)?.label ?? id;
}

/* ------------------------------------------------------------------------
 * Recruiters
 * ---------------------------------------------------------------------- */

const RECRUITERS = [
  { id: "rec-1", name: "Sarah Evans", email: "sarah.evans@helixon.io", role: "manager" },
  { id: "rec-2", name: "Conor Walsh", email: "conor.walsh@helixon.io", role: "recruiter" },
  { id: "rec-3", name: "Priya Anand", email: "priya.anand@helixon.io", role: "recruiter" },
  { id: "rec-4", name: "Tom Baxter", email: "tom.baxter@helixon.io", role: "recruiter" },
];

function recruiterName(id) {
  return RECRUITERS.find((r) => r.id === id)?.name ?? null;
}

/* ------------------------------------------------------------------------
 * Jobs - real entities (not derived from analyses) so job requirements,
 * status and candidate counts have somewhere honest to live.
 * ---------------------------------------------------------------------- */

const JOBS = [
  {
    id: "job-1",
    title: "Senior Software Engineer",
    company: "Acme Ltd",
    location: "Cardiff (Hybrid)",
    employmentType: "Full-time",
    seniority: "Senior",
    salaryRange: "£70,000 – £90,000",
    status: "open",
    requiredSkills: ["React", "TypeScript", "Node.js"],
    preferredSkills: ["GraphQL", "AWS", "Team leadership"],
    minYearsExperience: 5,
    createdAt: agoISO(52),
  },
  {
    id: "job-2",
    title: "Product Designer",
    company: "Brightline Studio",
    location: "Remote (UK)",
    employmentType: "Full-time",
    seniority: "Mid-Senior",
    salaryRange: "£55,000 – £70,000",
    status: "open",
    requiredSkills: ["Figma", "Design systems", "UX research"],
    preferredSkills: ["Prototyping", "Accessibility"],
    minYearsExperience: 4,
    createdAt: agoISO(38),
  },
  {
    id: "job-3",
    title: "Data Analyst",
    company: "Northfield Retail",
    location: "Bristol (Hybrid)",
    employmentType: "Full-time",
    seniority: "Mid",
    salaryRange: "£40,000 – £50,000",
    status: "open",
    requiredSkills: ["SQL", "Excel", "Data visualisation"],
    preferredSkills: ["Python", "Power BI"],
    minYearsExperience: 2,
    createdAt: agoISO(60),
  },
  {
    id: "job-4",
    title: "Customer Success Manager",
    company: "Vantage Cloud",
    location: "London (Hybrid)",
    employmentType: "Full-time",
    seniority: "Mid",
    salaryRange: "£45,000 – £58,000",
    status: "open",
    requiredSkills: ["SaaS account management", "Renewals"],
    preferredSkills: ["Salesforce", "Onboarding programmes"],
    minYearsExperience: 3,
    createdAt: agoISO(30),
  },
  {
    id: "job-5",
    title: "DevOps Engineer",
    company: "Acme Ltd",
    location: "Cardiff (Hybrid)",
    employmentType: "Full-time",
    seniority: "Senior",
    salaryRange: "£75,000 – £95,000",
    status: "open",
    requiredSkills: ["AWS", "Kubernetes", "Terraform"],
    preferredSkills: ["CI/CD pipelines", "Security hardening"],
    minYearsExperience: 5,
    createdAt: agoISO(45),
  },
  {
    id: "job-6",
    title: "Marketing Manager",
    company: "Solstice Health",
    location: "Remote (UK)",
    employmentType: "Full-time",
    seniority: "Mid-Senior",
    salaryRange: "£48,000 – £62,000",
    status: "open",
    requiredSkills: ["B2B marketing", "Content strategy"],
    preferredSkills: ["Marketing automation", "SEO"],
    minYearsExperience: 4,
    createdAt: agoISO(25),
  },
];

function jobById(id) {
  return JOBS.find((j) => j.id === id) ?? null;
}

/* ------------------------------------------------------------------------
 * Candidates - the core dataset. `stage`/`score` are null for candidates
 * whose analysis hasn't completed (status: "processing" | "failed"),
 * matching the existing dashboard's normalizeAnalysis contract.
 * ---------------------------------------------------------------------- */

function activity(type, daysAgo, hour, minute, actor, meta) {
  return { id: `act-${Math.random().toString(36).slice(2, 9)}`, type, actor, timestamp: agoISO(daysAgo, hour, minute), meta: meta ?? null };
}

function note(author, daysAgo, hour, minute, body) {
  return { id: `note-${Math.random().toString(36).slice(2, 9)}`, author, createdAt: agoISO(daysAgo, hour, minute), body };
}

function resumeFor(name, daysAgo, sizeKb) {
  return { name: `${name.replace(/\s+/g, "-")}-CV.pdf`, sizeKb, uploadedAt: agoISO(daysAgo) };
}

const RAW_CANDIDATES = [
  {
    id: "cand-01",
    fullName: "Jordan Williams",
    email: "jordan.williams@example.com",
    phone: "+44 7700 900123",
    location: "Cardiff, UK",
    linkedin: "linkedin.com/in/jordanwilliams",
    currentTitle: "Software Engineer",
    currentCompany: "Meridian Systems",
    yearsExperience: 6,
    jobId: "job-1",
    recruiterId: "rec-1",
    status: "completed",
    stage: "shortlisted",
    score: 94,
    matchSummary:
      "Strong alignment with the Senior Software Engineer requirements - six years building React/TypeScript products, including two as a lead on a SaaS platform comparable in scale to Acme's.",
    strengths: ["React", "TypeScript", "SaaS product experience", "5+ years"],
    concerns: ["2 month notice period", "Limited people-management experience"],
    skills: ["React", "TypeScript", "Node.js", "GraphQL", "AWS"],
    education: [{ school: "Cardiff University", degree: "BSc Computer Science", years: "2015 – 2018" }],
    workHistory: [
      { title: "Software Engineer", company: "Meridian Systems", start: "2021", end: "Present", description: "Leads the checkout squad on a B2B SaaS platform; owns the React/TypeScript front end." },
      { title: "Software Engineer", company: "Fenwick Digital", start: "2018", end: "2021", description: "Full-stack development on a Node.js/React booking platform." },
    ],
    resume: resumeFor("Jordan-Williams", 14, 212),
    tags: ["strong-technical"],
    notes: [note("Sarah Evans", 6, 10, 32, "Strong technical profile. Check notice period before submitting.")],
    nextAction: { id: "na-01", label: "Send CV to Acme hiring manager", dueAt: agoISO(-1), completed: false },
    createdAt: agoISO(14),
    lastActivityAt: agoISO(6),
    activityLog: [
      activity("cv_uploaded", 14, 9, 10, "System"),
      activity("analysis_completed", 14, 9, 40, "System", { score: 94 }),
      activity("stage_changed", 9, 14, 5, "Sarah Evans", { from: "new", to: "reviewing" }),
      activity("stage_changed", 6, 10, 40, "Sarah Evans", { from: "reviewing", to: "shortlisted" }),
      activity("note_added", 6, 10, 32, "Sarah Evans"),
    ],
  },
  {
    id: "cand-02",
    fullName: "Alex Morgan",
    email: "alex.morgan@example.com",
    phone: "+44 7700 900124",
    location: "Bristol, UK",
    linkedin: "linkedin.com/in/alexmorgan-dev",
    currentTitle: "Backend Engineer",
    currentCompany: "Ferro Finance",
    yearsExperience: 5,
    jobId: "job-1",
    recruiterId: "rec-2",
    status: "completed",
    stage: "interview",
    score: 87,
    matchSummary: "Solid TypeScript/Node background from fintech, with strong testing discipline. Front-end React exposure is real but lighter than the role calls for.",
    strengths: ["TypeScript", "Node.js", "5 years fintech"],
    concerns: ["No AWS experience yet"],
    skills: ["TypeScript", "Node.js", "PostgreSQL", "React"],
    education: [{ school: "University of the West of England", degree: "BSc Software Engineering", years: "2016 – 2019" }],
    workHistory: [{ title: "Backend Engineer", company: "Ferro Finance", start: "2019", end: "Present", description: "Payments API team; TypeScript/Node services handling card processing." }],
    resume: resumeFor("Alex-Morgan", 9, 189),
    tags: [],
    notes: [],
    nextAction: { id: "na-02", label: "Confirm interview slot with client", dueAt: agoISO(-2), completed: false },
    createdAt: agoISO(9),
    lastActivityAt: agoISO(2),
    activityLog: [
      activity("cv_uploaded", 9, 8, 50, "System"),
      activity("analysis_completed", 9, 9, 5, "System", { score: 87 }),
      activity("stage_changed", 5, 11, 0, "Conor Walsh", { from: "reviewing", to: "shortlisted" }),
      activity("stage_changed", 2, 13, 15, "Conor Walsh", { from: "shortlisted", to: "interview" }),
    ],
  },
  {
    id: "cand-03",
    fullName: "Nadia Hussain",
    email: "nadia.hussain@example.com",
    phone: "+44 7700 900125",
    location: "Cardiff, UK",
    linkedin: null,
    currentTitle: "Software Developer",
    currentCompany: "Loop Retail",
    yearsExperience: 4,
    jobId: "job-1",
    recruiterId: "rec-1",
    status: "completed",
    stage: "new",
    score: 81,
    matchSummary: "Good React/TypeScript foundation from an e-commerce platform. Hasn't yet worked at the scale Acme's role implies, but the trajectory is right.",
    strengths: ["React", "TypeScript", "E-commerce domain"],
    concerns: ["Smaller-scale systems to date"],
    skills: ["React", "TypeScript", "Redux", "Jest"],
    education: [{ school: "Swansea University", degree: "BSc Computer Science", years: "2017 – 2020" }],
    workHistory: [{ title: "Software Developer", company: "Loop Retail", start: "2020", end: "Present", description: "Front-end team on a mid-size e-commerce platform." }],
    resume: resumeFor("Nadia-Hussain", 1, 175),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(1),
    lastActivityAt: agoISO(1),
    activityLog: [activity("cv_uploaded", 1, 9, 0, "System"), activity("analysis_completed", 1, 9, 20, "System", { score: 81 })],
  },
  {
    id: "cand-04",
    fullName: "Ben Carter",
    email: "ben.carter@example.com",
    phone: "+44 7700 900126",
    location: "Newport, UK",
    linkedin: "linkedin.com/in/bencarter",
    currentTitle: "Junior Developer",
    currentCompany: "Harborview Software",
    yearsExperience: 2,
    jobId: "job-1",
    recruiterId: "rec-4",
    status: "completed",
    stage: "reviewing",
    score: 68,
    matchSummary: "Capable React developer but junior relative to the seniority this role needs - worth keeping warm for a mid-level opening rather than this one.",
    strengths: ["React", "Willing to relocate"],
    concerns: ["Below the role's seniority bar", "No backend experience"],
    skills: ["React", "JavaScript", "CSS"],
    education: [{ school: "University of South Wales", degree: "BSc Computing", years: "2019 – 2022" }],
    workHistory: [{ title: "Junior Developer", company: "Harborview Software", start: "2022", end: "Present", description: "Front-end maintenance on an internal tools suite." }],
    resume: resumeFor("Ben-Carter", 5, 143),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(5),
    lastActivityAt: agoISO(3),
    activityLog: [activity("cv_uploaded", 5, 9, 0, "System"), activity("analysis_completed", 5, 9, 15, "System", { score: 68 }), activity("stage_changed", 3, 15, 0, "Tom Baxter", { from: "new", to: "reviewing" })],
  },
  {
    id: "cand-05",
    fullName: "Leah Kowalski",
    email: "leah.kowalski@example.com",
    phone: "+44 7700 900127",
    location: "Cardiff, UK",
    linkedin: null,
    currentTitle: "Web Developer",
    currentCompany: "Freelance",
    yearsExperience: 4,
    jobId: "job-1",
    recruiterId: "rec-2",
    status: "completed",
    stage: "reviewing",
    score: 58,
    matchSummary: "Freelance web development background without TypeScript, and a two-year career gap the CV doesn't explain - likely not a fit for this role as written.",
    strengths: ["Client-facing experience"],
    concerns: ["No TypeScript", "Unexplained 2-year gap"],
    skills: ["JavaScript", "WordPress", "PHP"],
    education: [{ school: "Cardiff Metropolitan University", degree: "BA Digital Media", years: "2013 – 2016" }],
    workHistory: [{ title: "Web Developer", company: "Freelance", start: "2020", end: "Present", description: "Small-business websites and WordPress builds." }],
    resume: resumeFor("Leah-Kowalski", 20, 98),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(20),
    lastActivityAt: agoISO(9),
    activityLog: [activity("cv_uploaded", 20, 9, 0, "System"), activity("analysis_completed", 20, 9, 30, "System", { score: 58 }), activity("stage_changed", 9, 12, 0, "Conor Walsh", { from: "new", to: "reviewing" })],
  },
  {
    id: "cand-06",
    fullName: "Sophie Nguyen",
    email: "sophie.nguyen@example.com",
    phone: "+44 7700 900128",
    location: "Remote (UK)",
    linkedin: "linkedin.com/in/sophienguyen",
    currentTitle: "Product Designer",
    currentCompany: "Kestrel Health",
    yearsExperience: 5,
    jobId: "job-2",
    recruiterId: "rec-3",
    status: "completed",
    stage: "shortlisted",
    score: 91,
    matchSummary: "Excellent design-systems background and a strong UX research portfolio. Has worked mostly with smaller B2C products rather than enterprise SaaS.",
    strengths: ["Design systems", "Figma", "UX research"],
    concerns: ["Limited enterprise SaaS exposure"],
    skills: ["Figma", "Design systems", "UX research", "Prototyping"],
    education: [{ school: "Loughborough University", degree: "BA User Experience Design", years: "2014 – 2017" }],
    workHistory: [{ title: "Product Designer", company: "Kestrel Health", start: "2020", end: "Present", description: "Owns the design system for a patient-facing health app." }],
    resume: resumeFor("Sophie-Nguyen", 10, 231),
    tags: ["client-ready"],
    notes: [note("Priya Anand", 4, 15, 10, "Portfolio is excellent - client should love this one.")],
    nextAction: { id: "na-06", label: "Share portfolio with Brightline hiring panel", dueAt: agoISO(-1), completed: false },
    createdAt: agoISO(10),
    lastActivityAt: agoISO(4),
    activityLog: [
      activity("cv_uploaded", 10, 9, 0, "System"),
      activity("analysis_completed", 10, 9, 25, "System", { score: 91 }),
      activity("stage_changed", 6, 11, 0, "Priya Anand", { from: "reviewing", to: "shortlisted" }),
      activity("note_added", 4, 15, 10, "Priya Anand"),
      activity("tag_added", 4, 15, 12, "Priya Anand", { tag: "Client-ready" }),
    ],
  },
  {
    id: "cand-07",
    fullName: "Marcus Webb",
    email: "marcus.webb@example.com",
    phone: "+44 7700 900129",
    location: "Bristol, UK",
    linkedin: "linkedin.com/in/marcuswebb",
    currentTitle: "UX/UI Designer",
    currentCompany: "Halcyon Studio",
    yearsExperience: 4,
    jobId: "job-2",
    recruiterId: "rec-3",
    status: "completed",
    stage: "interview",
    score: 84,
    matchSummary: "Well-rounded UX/UI designer with agency breadth across several SaaS clients. Design-systems experience is present but not this candidate's specialism.",
    strengths: ["UX research", "Cross-client SaaS experience"],
    concerns: ["Design systems more generalist than specialist"],
    skills: ["Figma", "UX research", "Prototyping", "Accessibility"],
    education: [{ school: "Falmouth University", degree: "BA Graphic Design", years: "2015 – 2018" }],
    workHistory: [{ title: "UX/UI Designer", company: "Halcyon Studio", start: "2018", end: "Present", description: "Agency designer across several SaaS client accounts." }],
    resume: resumeFor("Marcus-Webb", 7, 204),
    tags: [],
    notes: [],
    nextAction: { id: "na-07", label: "Prep for second-round interview", dueAt: agoISO(-3), completed: false },
    createdAt: agoISO(7),
    lastActivityAt: agoISO(1),
    activityLog: [activity("cv_uploaded", 7, 9, 0, "System"), activity("analysis_completed", 7, 9, 20, "System", { score: 84 }), activity("stage_changed", 3, 10, 0, "Priya Anand", { from: "shortlisted", to: "interview" })],
  },
  {
    id: "cand-08",
    fullName: "Freya Adams",
    email: "freya.adams@example.com",
    phone: "+44 7700 900130",
    location: "Remote (UK)",
    linkedin: null,
    currentTitle: "Junior Product Designer",
    currentCompany: "Nimbus Apps",
    yearsExperience: 2,
    jobId: "job-2",
    recruiterId: "rec-4",
    status: "completed",
    stage: "new",
    score: 73,
    matchSummary: "Promising junior designer with a clean Figma portfolio, but under the role's four-year experience bar.",
    strengths: ["Figma", "Clean visual craft"],
    concerns: ["Below required experience level"],
    skills: ["Figma", "UI design"],
    education: [{ school: "Bath Spa University", degree: "BA Graphic Communication", years: "2019 – 2022" }],
    workHistory: [{ title: "Junior Product Designer", company: "Nimbus Apps", start: "2022", end: "Present", description: "UI design for a consumer mobile app." }],
    resume: resumeFor("Freya-Adams", 2, 156),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(2),
    lastActivityAt: agoISO(2),
    activityLog: [activity("cv_uploaded", 2, 9, 0, "System"), activity("analysis_completed", 2, 9, 15, "System", { score: 73 })],
  },
  {
    id: "cand-09",
    fullName: "Owen Bright",
    email: "owen.bright@example.com",
    phone: "+44 7700 900131",
    location: "Manchester, UK",
    linkedin: "linkedin.com/in/owenbright",
    currentTitle: "Senior Product Designer",
    currentCompany: "Alder Financial",
    yearsExperience: 7,
    jobId: "job-2",
    recruiterId: "rec-3",
    status: "completed",
    stage: "offer",
    score: 89,
    matchSummary: "Senior designer with strong enterprise fintech background and a track record of shipping design systems used by hundreds of internal users.",
    strengths: ["Design systems", "Enterprise SaaS", "7 years"],
    concerns: ["Current salary expectations above initial range"],
    skills: ["Figma", "Design systems", "Accessibility", "Prototyping"],
    education: [{ school: "University of Leeds", degree: "BA Product Design", years: "2012 – 2015" }],
    workHistory: [{ title: "Senior Product Designer", company: "Alder Financial", start: "2019", end: "Present", description: "Leads the design system for Alder's internal banking tools." }],
    resume: resumeFor("Owen-Bright", 16, 267),
    tags: ["urgent", "client-ready"],
    notes: [note("Priya Anand", 3, 9, 45, "Client wants to move fast on this one - chase offer approval today.")],
    nextAction: { id: "na-09", label: "Chase offer sign-off with Brightline", dueAt: agoISO(1), completed: false },
    createdAt: agoISO(16),
    lastActivityAt: agoISO(3),
    activityLog: [
      activity("cv_uploaded", 16, 9, 0, "System"),
      activity("analysis_completed", 16, 9, 25, "System", { score: 89 }),
      activity("stage_changed", 10, 10, 0, "Priya Anand", { from: "shortlisted", to: "interview" }),
      activity("stage_changed", 4, 11, 30, "Priya Anand", { from: "interview", to: "offer" }),
      activity("note_added", 3, 9, 45, "Priya Anand"),
    ],
  },
  {
    id: "cand-10",
    fullName: "Daniel Price",
    email: "daniel.price@example.com",
    phone: "+44 7700 900132",
    location: "Bristol, UK",
    linkedin: "linkedin.com/in/danielprice",
    currentTitle: "Data Analyst",
    currentCompany: "Fenwick Retail Group",
    yearsExperience: 3,
    jobId: "job-3",
    recruiterId: "rec-1",
    status: "completed",
    stage: "interview",
    score: 76,
    matchSummary: "Solid SQL and Excel fundamentals from a retail analytics role. Power BI experience is limited to dashboards built from templates rather than from scratch.",
    strengths: ["SQL", "Retail analytics domain"],
    concerns: ["Power BI experience is light"],
    skills: ["SQL", "Excel", "Power BI", "Data visualisation"],
    education: [{ school: "University of Bristol", degree: "BSc Mathematics", years: "2016 – 2019" }],
    workHistory: [{ title: "Data Analyst", company: "Fenwick Retail Group", start: "2019", end: "Present", description: "Sales and stock analytics across 40+ retail stores." }],
    resume: resumeFor("Daniel-Price", 6, 167),
    tags: [],
    notes: [],
    nextAction: { id: "na-10", label: "Send interview questions to client", dueAt: agoISO(-1), completed: false },
    createdAt: agoISO(6),
    lastActivityAt: agoISO(2),
    activityLog: [activity("cv_uploaded", 6, 9, 0, "System"), activity("analysis_completed", 6, 9, 15, "System", { score: 76 }), activity("stage_changed", 2, 10, 0, "Sarah Evans", { from: "shortlisted", to: "interview" })],
  },
  {
    id: "cand-11",
    fullName: "Emily Jones",
    email: "emily.jones@example.com",
    phone: "+44 7700 900133",
    location: "Bristol, UK",
    linkedin: null,
    currentTitle: "Reporting Assistant",
    currentCompany: "Colmore Logistics",
    yearsExperience: 1,
    jobId: "job-3",
    recruiterId: "rec-4",
    status: "completed",
    stage: "reviewing",
    score: 61,
    matchSummary: "Early-career candidate with basic SQL and strong Excel skills, but under the role's two-year experience threshold.",
    strengths: ["Excel", "Fast learner"],
    concerns: ["Below required experience", "No Power BI or Python"],
    skills: ["Excel", "SQL (basic)"],
    education: [{ school: "University of the West of England", degree: "BSc Business Analytics", years: "2020 – 2023" }],
    workHistory: [{ title: "Reporting Assistant", company: "Colmore Logistics", start: "2023", end: "Present", description: "Weekly reporting for the logistics operations team." }],
    resume: resumeFor("Emily-Jones", 11, 132),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(11),
    lastActivityAt: agoISO(8),
    activityLog: [activity("cv_uploaded", 11, 9, 0, "System"), activity("analysis_completed", 11, 9, 20, "System", { score: 61 }), activity("stage_changed", 8, 13, 0, "Tom Baxter", { from: "new", to: "reviewing" })],
  },
  {
    id: "cand-12",
    fullName: "Ravi Patel",
    email: "ravi.patel@example.com",
    phone: "+44 7700 900134",
    location: "Bristol, UK",
    linkedin: "linkedin.com/in/ravipatel",
    currentTitle: "Data Analyst",
    currentCompany: "Northbridge Insurance",
    yearsExperience: 3,
    jobId: "job-3",
    recruiterId: "rec-2",
    status: "completed",
    stage: "new",
    score: 79,
    matchSummary: "Good all-round SQL and Python analyst with insurance-sector reporting experience, close to Northfield's requirements.",
    strengths: ["SQL", "Python", "3 years analytics"],
    concerns: ["No retail-sector experience"],
    skills: ["SQL", "Python", "Excel", "Tableau"],
    education: [{ school: "University of Bath", degree: "BSc Economics", years: "2017 – 2020" }],
    workHistory: [{ title: "Data Analyst", company: "Northbridge Insurance", start: "2020", end: "Present", description: "Claims reporting and pricing analytics." }],
    resume: resumeFor("Ravi-Patel", 0, 178),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(0, 9, 10),
    lastActivityAt: agoISO(0, 9, 10),
    activityLog: [activity("cv_uploaded", 0, 9, 0, "System"), activity("analysis_completed", 0, 9, 10, "System", { score: 79 })],
  },
  {
    id: "cand-13",
    fullName: "Chloe Dean",
    email: "chloe.dean@example.com",
    phone: "+44 7700 900135",
    location: "Bristol, UK",
    linkedin: "linkedin.com/in/chloedean",
    currentTitle: "Senior Data Analyst",
    currentCompany: "Northfield Retail",
    yearsExperience: 5,
    jobId: "job-3",
    recruiterId: "rec-1",
    status: "completed",
    stage: "placed",
    score: 88,
    matchSummary: "Placed. Strong SQL/Power BI skillset with direct retail-sector experience - a near-perfect fit that moved through the pipeline in under three weeks.",
    strengths: ["SQL", "Power BI", "Retail domain expert"],
    concerns: [],
    skills: ["SQL", "Power BI", "Excel", "Python"],
    education: [{ school: "Cardiff University", degree: "BSc Statistics", years: "2014 – 2017" }],
    workHistory: [{ title: "Senior Data Analyst", company: "Northfield Retail", start: "2024", end: "Present", description: "Placed via Helixon; leads store-performance reporting." }],
    resume: resumeFor("Chloe-Dean", 40, 199),
    tags: ["referral"],
    notes: [note("Sarah Evans", 5, 16, 0, "Great placement - client already asking if she knows anyone else like her.")],
    nextAction: null,
    createdAt: agoISO(40),
    lastActivityAt: agoISO(5),
    activityLog: [
      activity("cv_uploaded", 40, 9, 0, "System"),
      activity("analysis_completed", 40, 9, 20, "System", { score: 88 }),
      activity("stage_changed", 30, 10, 0, "Sarah Evans", { from: "shortlisted", to: "interview" }),
      activity("stage_changed", 22, 14, 0, "Sarah Evans", { from: "interview", to: "offer" }),
      activity("stage_changed", 5, 16, 0, "Sarah Evans", { from: "offer", to: "placed" }),
      activity("note_added", 5, 16, 0, "Sarah Evans"),
    ],
  },
  {
    id: "cand-14",
    fullName: "Megan Ferris",
    email: "megan.ferris@example.com",
    phone: "+44 7700 900136",
    location: "London, UK",
    linkedin: "linkedin.com/in/meganferris",
    currentTitle: "Account Manager",
    currentCompany: "Cirrus SaaS",
    yearsExperience: 4,
    jobId: "job-4",
    recruiterId: "rec-4",
    status: "completed",
    stage: "shortlisted",
    score: 82,
    matchSummary: "Strong SaaS account-management background with a proven renewals track record. Hasn't used Salesforce specifically, but the CRM concepts transfer directly.",
    strengths: ["SaaS renewals", "Client relationship management"],
    concerns: ["No direct Salesforce experience"],
    skills: ["SaaS account management", "Renewals", "HubSpot"],
    education: [{ school: "University of Surrey", degree: "BA Business Management", years: "2016 – 2019" }],
    workHistory: [{ title: "Account Manager", company: "Cirrus SaaS", start: "2021", end: "Present", description: "Owns renewals for a book of 60 mid-market accounts." }],
    resume: resumeFor("Megan-Ferris", 8, 154),
    tags: ["follow-up"],
    notes: [],
    nextAction: { id: "na-14", label: "Follow up on client feedback", dueAt: agoISO(2), completed: false },
    createdAt: agoISO(8),
    lastActivityAt: agoISO(1),
    activityLog: [activity("cv_uploaded", 8, 9, 0, "System"), activity("analysis_completed", 8, 9, 20, "System", { score: 82 }), activity("stage_changed", 4, 10, 0, "Tom Baxter", { from: "reviewing", to: "shortlisted" }), activity("tag_added", 1, 11, 0, "Tom Baxter", { tag: "Needs follow-up" })],
  },
  {
    id: "cand-15",
    fullName: "Harry Lennox",
    email: "harry.lennox@example.com",
    phone: "+44 7700 900137",
    location: "London, UK",
    linkedin: null,
    currentTitle: "Customer Support Lead",
    currentCompany: "Fenwick Digital",
    yearsExperience: 3,
    jobId: "job-4",
    recruiterId: "rec-2",
    status: "completed",
    stage: "reviewing",
    score: 64,
    matchSummary: "Support-side background rather than account management - strong on customer relationships, thinner on renewals and commercial ownership.",
    strengths: ["Customer relationships", "Support operations"],
    concerns: ["No renewals ownership experience"],
    skills: ["Customer support", "Zendesk"],
    education: [{ school: "Oxford Brookes University", degree: "BA Business", years: "2015 – 2018" }],
    workHistory: [{ title: "Customer Support Lead", company: "Fenwick Digital", start: "2020", end: "Present", description: "Leads a 4-person support team for a B2B platform." }],
    resume: resumeFor("Harry-Lennox", 13, 141),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(13),
    lastActivityAt: agoISO(7),
    activityLog: [activity("cv_uploaded", 13, 9, 0, "System"), activity("analysis_completed", 13, 9, 15, "System", { score: 64 }), activity("stage_changed", 7, 10, 0, "Conor Walsh", { from: "new", to: "reviewing" })],
  },
  {
    id: "cand-16",
    fullName: "Isla Grant",
    email: "isla.grant@example.com",
    phone: "+44 7700 900138",
    location: "London, UK",
    linkedin: "linkedin.com/in/islagrant",
    currentTitle: "Customer Success Associate",
    currentCompany: "Pinboard",
    yearsExperience: 2,
    jobId: "job-4",
    recruiterId: "rec-1",
    status: "completed",
    stage: "new",
    score: 70,
    matchSummary: "Junior CS profile with genuine SaaS onboarding experience, but under the role's three-year requirement.",
    strengths: ["SaaS onboarding", "Customer-facing"],
    concerns: ["Below required experience level"],
    skills: ["Onboarding", "SaaS account management"],
    education: [{ school: "University of Portsmouth", degree: "BA Marketing", years: "2019 – 2022" }],
    workHistory: [{ title: "Customer Success Associate", company: "Pinboard", start: "2022", end: "Present", description: "Onboards new customers onto a project-management SaaS." }],
    resume: resumeFor("Isla-Grant", 3, 122),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(3),
    lastActivityAt: agoISO(3),
    activityLog: [activity("cv_uploaded", 3, 9, 0, "System"), activity("analysis_completed", 3, 9, 15, "System", { score: 70 })],
  },
  {
    id: "cand-17",
    fullName: "Callum Reid",
    email: "callum.reid@example.com",
    phone: "+44 7700 900139",
    location: "London, UK",
    linkedin: "linkedin.com/in/callumreid",
    currentTitle: "Customer Success Manager",
    currentCompany: "Orbital SaaS",
    yearsExperience: 4,
    jobId: "job-4",
    recruiterId: "rec-4",
    status: "completed",
    stage: "interview",
    score: 85,
    matchSummary: "Direct CSM experience at a comparable SaaS company, including Salesforce use and a renewals quota - a close fit on paper.",
    strengths: ["Salesforce", "SaaS renewals", "Direct CSM experience"],
    concerns: [],
    skills: ["Salesforce", "SaaS account management", "Renewals", "Onboarding"],
    education: [{ school: "University of Kent", degree: "BA Business Administration", years: "2016 – 2019" }],
    workHistory: [{ title: "Customer Success Manager", company: "Orbital SaaS", start: "2021", end: "Present", description: "Owns renewals and onboarding for a portfolio of enterprise accounts." }],
    resume: resumeFor("Callum-Reid", 4, 163),
    tags: [],
    notes: [],
    nextAction: { id: "na-17", label: "Schedule second interview", dueAt: agoISO(-2), completed: false },
    createdAt: agoISO(4),
    lastActivityAt: agoISO(1),
    activityLog: [activity("cv_uploaded", 4, 9, 0, "System"), activity("analysis_completed", 4, 9, 15, "System", { score: 85 }), activity("stage_changed", 1, 11, 0, "Tom Baxter", { from: "shortlisted", to: "interview" })],
  },
  {
    id: "cand-18",
    fullName: "Aaron Fitzgerald",
    email: "aaron.fitzgerald@example.com",
    phone: "+44 7700 900140",
    location: "Cardiff, UK",
    linkedin: "linkedin.com/in/aaronfitzgerald",
    currentTitle: "Platform Engineer",
    currentCompany: "Ferro Finance",
    yearsExperience: 6,
    jobId: "job-5",
    recruiterId: "rec-1",
    status: "completed",
    stage: "shortlisted",
    score: 90,
    matchSummary: "Strong AWS/Kubernetes/Terraform background from a regulated fintech environment - directly transferable to Acme's infrastructure.",
    strengths: ["Kubernetes", "Terraform", "AWS", "Security-conscious"],
    concerns: ["Currently on a visa - sponsorship needs confirming"],
    skills: ["AWS", "Kubernetes", "Terraform", "CI/CD pipelines"],
    education: [{ school: "Queen's University Belfast", degree: "BEng Computer Engineering", years: "2013 – 2017" }],
    workHistory: [{ title: "Platform Engineer", company: "Ferro Finance", start: "2019", end: "Present", description: "Owns the Kubernetes platform for a regulated payments environment." }],
    resume: resumeFor("Aaron-Fitzgerald", 17, 224),
    tags: ["strong-technical", "senior-profile"],
    notes: [note("Sarah Evans", 7, 9, 30, "Excellent technically - just need to confirm sponsorship status with him directly.")],
    nextAction: { id: "na-18", label: "Confirm visa sponsorship status", dueAt: agoISO(1), completed: false },
    createdAt: agoISO(17),
    lastActivityAt: agoISO(7),
    activityLog: [
      activity("cv_uploaded", 17, 9, 0, "System"),
      activity("analysis_completed", 17, 9, 25, "System", { score: 90 }),
      activity("stage_changed", 12, 10, 0, "Sarah Evans", { from: "reviewing", to: "shortlisted" }),
      activity("note_added", 7, 9, 30, "Sarah Evans"),
    ],
  },
  {
    id: "cand-19",
    fullName: "Grace Whitfield",
    email: "grace.whitfield@example.com",
    phone: "+44 7700 900141",
    location: "Cardiff, UK",
    linkedin: null,
    currentTitle: "Cloud Support Engineer",
    currentCompany: "Northbridge Insurance",
    yearsExperience: 3,
    jobId: "job-5",
    recruiterId: "rec-2",
    status: "completed",
    stage: "new",
    score: 66,
    matchSummary: "Solid AWS support background but limited hands-on Terraform/Kubernetes ownership - more operations than platform engineering so far.",
    strengths: ["AWS", "Incident response"],
    concerns: ["Limited Terraform/Kubernetes ownership"],
    skills: ["AWS", "Linux", "Monitoring"],
    education: [{ school: "Cardiff Metropolitan University", degree: "BSc Computer Networking", years: "2018 – 2021" }],
    workHistory: [{ title: "Cloud Support Engineer", company: "Northbridge Insurance", start: "2021", end: "Present", description: "Tier 2/3 AWS support and incident response." }],
    resume: resumeFor("Grace-Whitfield", 1, 137),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(1),
    lastActivityAt: agoISO(1),
    activityLog: [activity("cv_uploaded", 1, 9, 0, "System"), activity("analysis_completed", 1, 9, 15, "System", { score: 66 })],
  },
  {
    id: "cand-20",
    fullName: "Sam O'Connell",
    email: "sam.oconnell@example.com",
    phone: "+44 7700 900142",
    location: "Cardiff, UK",
    linkedin: "linkedin.com/in/samoconnell",
    currentTitle: "DevOps Engineer",
    currentCompany: "Acme Ltd",
    yearsExperience: 7,
    jobId: "job-5",
    recruiterId: "rec-1",
    status: "completed",
    stage: "placed",
    score: 93,
    matchSummary: "Placed. Near-exact match on required and preferred skills, with prior experience at a company of comparable scale to Acme.",
    strengths: ["Kubernetes", "Terraform", "AWS", "CI/CD pipelines"],
    concerns: [],
    skills: ["AWS", "Kubernetes", "Terraform", "CI/CD pipelines", "Security hardening"],
    education: [{ school: "University of Bath", degree: "BEng Computer Systems", years: "2013 – 2017" }],
    workHistory: [{ title: "DevOps Engineer", company: "Acme Ltd", start: "2025", end: "Present", description: "Placed via Helixon; owns the platform team's CI/CD pipelines." }],
    resume: resumeFor("Sam-OConnell", 35, 218),
    tags: ["strong-technical"],
    notes: [],
    nextAction: null,
    createdAt: agoISO(35),
    lastActivityAt: agoISO(12),
    activityLog: [
      activity("cv_uploaded", 35, 9, 0, "System"),
      activity("analysis_completed", 35, 9, 20, "System", { score: 93 }),
      activity("stage_changed", 26, 10, 0, "Sarah Evans", { from: "shortlisted", to: "interview" }),
      activity("stage_changed", 18, 14, 0, "Sarah Evans", { from: "interview", to: "offer" }),
      activity("stage_changed", 12, 16, 0, "Sarah Evans", { from: "offer", to: "placed" }),
    ],
  },
  {
    id: "cand-21",
    fullName: "Naomi Clarke",
    email: "naomi.clarke@example.com",
    phone: "+44 7700 900143",
    location: "Remote (UK)",
    linkedin: "linkedin.com/in/naomiclarke",
    currentTitle: "Marketing Manager",
    currentCompany: "Vantage Cloud",
    yearsExperience: 6,
    jobId: "job-6",
    recruiterId: "rec-3",
    status: "completed",
    stage: "offer",
    score: 86,
    matchSummary: "Strong B2B marketing background with direct content-strategy ownership at a SaaS company of similar size to Solstice Health.",
    strengths: ["B2B marketing", "Content strategy", "SaaS experience"],
    concerns: ["Notice period may run long"],
    skills: ["B2B marketing", "Content strategy", "SEO", "Marketing automation"],
    education: [{ school: "University of Manchester", degree: "BA Marketing", years: "2015 – 2018" }],
    workHistory: [{ title: "Marketing Manager", company: "Vantage Cloud", start: "2021", end: "Present", description: "Owns content strategy and demand generation." }],
    resume: resumeFor("Naomi-Clarke", 15, 148),
    tags: ["client-ready"],
    notes: [],
    nextAction: { id: "na-21", label: "Confirm start date with client", dueAt: agoISO(-1), completed: false },
    createdAt: agoISO(15),
    lastActivityAt: agoISO(2),
    activityLog: [activity("cv_uploaded", 15, 9, 0, "System"), activity("analysis_completed", 15, 9, 20, "System", { score: 86 }), activity("stage_changed", 9, 10, 0, "Priya Anand", { from: "interview", to: "offer" })],
  },
  {
    id: "cand-22",
    fullName: "Ethan Brooks",
    email: "ethan.brooks@example.com",
    phone: "+44 7700 900144",
    location: "Remote (UK)",
    linkedin: null,
    currentTitle: "Marketing Executive",
    currentCompany: "Colmore Logistics",
    yearsExperience: 2,
    jobId: "job-6",
    recruiterId: "rec-4",
    status: "completed",
    stage: "reviewing",
    score: 59,
    matchSummary: "Generalist marketing executive without a clear content-strategy specialism - likely under-qualified for this role's seniority.",
    strengths: ["Social media", "Campaign execution"],
    concerns: ["Below required seniority", "No content-strategy ownership"],
    skills: ["Social media", "Email marketing"],
    education: [{ school: "Coventry University", degree: "BA Marketing", years: "2020 – 2023" }],
    workHistory: [{ title: "Marketing Executive", company: "Colmore Logistics", start: "2023", end: "Present", description: "Runs paid social campaigns and email newsletters." }],
    resume: resumeFor("Ethan-Brooks", 22, 119),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(22),
    lastActivityAt: agoISO(10),
    activityLog: [activity("cv_uploaded", 22, 9, 0, "System"), activity("analysis_completed", 22, 9, 15, "System", { score: 59 }), activity("stage_changed", 10, 11, 0, "Tom Baxter", { from: "new", to: "reviewing" })],
  },
  {
    id: "cand-23",
    fullName: "Zara Malik",
    email: "zara.malik@example.com",
    phone: "+44 7700 900145",
    location: "Remote (UK)",
    linkedin: "linkedin.com/in/zaramalik",
    currentTitle: "Content Marketing Specialist",
    currentCompany: "Pinboard",
    yearsExperience: 4,
    jobId: "job-6",
    recruiterId: "rec-3",
    status: "completed",
    stage: "new",
    score: 77,
    matchSummary: "Genuine content-strategy specialist with SEO chops; marketing automation experience is limited to templated workflows.",
    strengths: ["Content strategy", "SEO"],
    concerns: ["Limited marketing automation depth"],
    skills: ["Content strategy", "SEO", "Copywriting"],
    education: [{ school: "University of Leeds", degree: "BA English & Media", years: "2016 – 2019" }],
    workHistory: [{ title: "Content Marketing Specialist", company: "Pinboard", start: "2021", end: "Present", description: "Owns the blog and SEO strategy for a project-management SaaS." }],
    resume: resumeFor("Zara-Malik", 2, 128),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(2),
    lastActivityAt: agoISO(2),
    activityLog: [activity("cv_uploaded", 2, 9, 0, "System"), activity("analysis_completed", 2, 9, 15, "System", { score: 77 })],
  },
  {
    id: "cand-24",
    fullName: "Petra Lindqvist",
    email: "petra.lindqvist@example.com",
    phone: "+44 7700 900146",
    location: "Remote (UK)",
    linkedin: "linkedin.com/in/petralindqvist",
    currentTitle: "Product Designer",
    currentCompany: "Solari Studio",
    yearsExperience: 5,
    jobId: "job-2",
    recruiterId: "rec-3",
    status: "processing",
    stage: null,
    score: null,
    matchSummary: null,
    strengths: [],
    concerns: [],
    skills: ["Figma", "Design systems"],
    education: [{ school: "Kingston University", degree: "BA Design", years: "2014 – 2017" }],
    workHistory: [{ title: "Product Designer", company: "Solari Studio", start: "2019", end: "Present", description: "Design systems and UX research." }],
    resume: resumeFor("Petra-Lindqvist", 0, 201),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(0, 15, 0),
    lastActivityAt: agoISO(0, 15, 0),
    activityLog: [activity("cv_uploaded", 0, 15, 0, "System"), activity("analysis_completed", 0, 15, 1, "System", { note: "Analysis in progress" })],
  },
  {
    id: "cand-25",
    fullName: "Youssef Amrani",
    email: "youssef.amrani@example.com",
    phone: "+44 7700 900147",
    location: "Cardiff, UK",
    linkedin: "linkedin.com/in/youssefamrani",
    currentTitle: "Software Engineer",
    currentCompany: "Loop Retail",
    yearsExperience: 5,
    jobId: "job-1",
    recruiterId: "rec-1",
    status: "processing",
    stage: null,
    score: null,
    matchSummary: null,
    strengths: [],
    concerns: [],
    skills: ["React", "Node.js"],
    education: [{ school: "Cardiff University", degree: "BSc Computer Science", years: "2015 – 2018" }],
    workHistory: [{ title: "Software Engineer", company: "Loop Retail", start: "2020", end: "Present", description: "Full-stack development on an e-commerce platform." }],
    resume: resumeFor("Youssef-Amrani", 0, 195),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(0, 21, 0),
    lastActivityAt: agoISO(0, 21, 0),
    activityLog: [activity("cv_uploaded", 0, 21, 0, "System")],
  },
  {
    id: "cand-26",
    fullName: "Ian Baxter",
    email: "ian.baxter@example.com",
    phone: "+44 7700 900148",
    location: "London, UK",
    linkedin: null,
    currentTitle: "Customer Success Associate",
    currentCompany: "Orbital SaaS",
    yearsExperience: 3,
    jobId: "job-4",
    recruiterId: "rec-4",
    status: "failed",
    stage: null,
    score: null,
    matchSummary: null,
    strengths: [],
    concerns: [],
    skills: [],
    education: [],
    workHistory: [],
    resume: resumeFor("Ian-Baxter", 1, 0),
    tags: [],
    notes: [],
    nextAction: null,
    createdAt: agoISO(1, 10, 0),
    lastActivityAt: agoISO(1, 10, 0),
    activityLog: [activity("cv_uploaded", 1, 10, 0, "System"), activity("analysis_completed", 1, 10, 2, "System", { note: "Analysis failed - unreadable CV file" })],
  },
];

// Mutable in-memory "table". Cloned from RAW_CANDIDATES once at module load
// so repeated getCandidates()/mutation calls operate on live, shared state
// for the lifetime of the server/session - same trade-off any in-memory
// mock API makes. A real backend replaces this whole block.
const CANDIDATES = RAW_CANDIDATES.map((c) => ({ ...c, tags: [...c.tags], notes: [...c.notes], activityLog: [...c.activityLog] }));

/* ------------------------------------------------------------------------
 * Existing dashboard contract - unchanged shape, now sourced from the
 * richer CANDIDATES table instead of its own separate fixtures.
 * ---------------------------------------------------------------------- */

export async function getMockData() {
  return {
    agency: {
      name: "Northgate Recruitment",
      plan: { name: "Growth", analysesUsed: 63, analysesLimit: 150 },
    },
    recentAnalyses: CANDIDATES.map((c) => ({
      id: c.id,
      candidateName: c.fullName,
      jobTitle: jobById(c.jobId)?.title ?? "Unspecified role",
      company: jobById(c.jobId)?.company ?? null,
      recruiterName: recruiterName(c.recruiterId),
      status: c.status,
      stage: c.stage,
      score: c.score,
      createdAt: c.createdAt,
    })),
  };
}

/* ------------------------------------------------------------------------
 * Candidate queries
 * ---------------------------------------------------------------------- */

function candidateToSummary(c) {
  return {
    id: c.id,
    fullName: c.fullName,
    location: c.location,
    currentTitle: c.currentTitle,
    currentCompany: c.currentCompany,
    jobId: c.jobId,
    jobTitle: jobById(c.jobId)?.title ?? "Unspecified role",
    company: jobById(c.jobId)?.company ?? null,
    recruiterId: c.recruiterId,
    recruiterName: recruiterName(c.recruiterId),
    status: c.status,
    stage: c.stage,
    score: c.score,
    skills: c.skills,
    tags: c.tags,
    nextAction: c.nextAction,
    createdAt: c.createdAt,
    lastActivityAt: c.lastActivityAt,
  };
}

const DATE_RANGE_DAYS = { today: 1, "7d": 7, "30d": 30 };

/**
 * getCandidates - filter, sort and paginate the candidate table.
 * Written as if `query` were serialised onto a GET /api/candidates request,
 * so swapping the body for a real fetch() later shouldn't change call sites.
 */
export function getCandidates(query = {}) {
  const {
    search = "",
    stage = "all",
    scoreBand = "all",
    status = "all",
    recruiterId = "all",
    jobId = "all",
    tagIds = [],
    dateRange = "all",
    sortBy = "score_desc",
    page = 1,
    pageSize = 8,
  } = query;

  let items = CANDIDATES.map(candidateToSummary);

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((c) =>
      [c.fullName, c.jobTitle, c.company, c.recruiterName, ...(c.tags.map(tagLabel)), ...c.skills]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(q))
    );
  }

  if (stage !== "all") items = items.filter((c) => c.stage === stage);
  if (status !== "all") items = items.filter((c) => c.status === status);
  if (recruiterId !== "all") items = items.filter((c) => c.recruiterId === recruiterId);
  if (jobId !== "all") items = items.filter((c) => c.jobId === jobId);
  if (scoreBand !== "all") items = items.filter((c) => scoreBandOfLocal(c.score) === scoreBand);
  if (tagIds.length > 0) items = items.filter((c) => tagIds.every((t) => c.tags.includes(t)));
  if (dateRange !== "all" && DATE_RANGE_DAYS[dateRange]) {
    const cutoff = NOW - DATE_RANGE_DAYS[dateRange] * DAY;
    items = items.filter((c) => new Date(c.createdAt).getTime() >= cutoff);
  }

  const comparators = {
    score_desc: (a, b) => (b.score ?? -1) - (a.score ?? -1),
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    recent_activity: (a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt),
    stage: (a, b) => STAGE_ORDER.indexOf(b.stage) - STAGE_ORDER.indexOf(a.stage),
    recruiter: (a, b) => (a.recruiterName ?? "").localeCompare(b.recruiterName ?? ""),
    job: (a, b) => (a.jobTitle ?? "").localeCompare(b.jobTitle ?? ""),
  };
  items.sort(comparators[sortBy] ?? comparators.score_desc);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

/**
 * getStageCounts - candidate counts per stage under the current filters
 * (ignoring the stage filter itself and pagination), for the filter-pill
 * badges on the candidate database page. A real backend would return this
 * as a `facets` block alongside the main /api/candidates response rather
 * than requiring a second call.
 */
export function getStageCounts(query = {}) {
  const { stage, page, pageSize, ...rest } = query;
  const all = getCandidates({ ...rest, stage: "all", page: 1, pageSize: Number.MAX_SAFE_INTEGER }).items;
  const counts = { all: all.length };
  STAGE_ORDER.forEach((s) => {
    counts[s] = all.filter((c) => c.stage === s).length;
  });
  return counts;
}

function scoreBandOfLocal(score) {
  if (score === null || score === undefined) return null;
  if (score >= 80) return "80+";
  if (score >= 60) return "60-79";
  return "<60";
}

export function getCandidateById(id) {
  const c = CANDIDATES.find((x) => x.id === id);
  if (!c) return null;
  const job = jobById(c.jobId);
  return {
    ...c,
    jobTitle: job?.title ?? "Unspecified role",
    company: job?.company ?? null,
    job,
    recruiterName: recruiterName(c.recruiterId),
    activity: [...c.activityLog].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
  };
}

/** All candidates in the same fixed order used for prev/next navigation on
 * the candidate profile page. Kept simple (id order) rather than trying to
 * reconstruct whatever filter/sort the recruiter arrived from. */
export function getAdjacentCandidateIds(id) {
  const ids = CANDIDATES.map((c) => c.id);
  const idx = ids.indexOf(id);
  if (idx === -1) return { prevId: null, nextId: null };
  return {
    prevId: idx > 0 ? ids[idx - 1] : null,
    nextId: idx < ids.length - 1 ? ids[idx + 1] : null,
  };
}

/* ------------------------------------------------------------------------
 * Jobs
 * ---------------------------------------------------------------------- */

export function getJobs() {
  return JOBS.map((job) => {
    const candidates = CANDIDATES.filter((c) => c.jobId === job.id);
    const completed = candidates.filter((c) => c.status === "completed");
    return {
      ...job,
      candidateCount: candidates.length,
      strongMatches: completed.filter((c) => c.score !== null && c.score >= 80).length,
      shortlisted: completed.filter((c) => c.stage === "shortlisted").length,
      interviewing: completed.filter((c) => c.stage === "interview").length,
      offers: completed.filter((c) => c.stage === "offer").length,
      placed: completed.filter((c) => c.stage === "placed").length,
    };
  });
}

export function getJobById(id) {
  const job = jobById(id);
  if (!job) return null;
  const jobs = getJobs();
  return jobs.find((j) => j.id === id) ?? null;
}

export function getJobCandidates(jobId) {
  return CANDIDATES.filter((c) => c.jobId === jobId)
    .map(candidateToSummary)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
}

/* ------------------------------------------------------------------------
 * Recruiters / team
 * ---------------------------------------------------------------------- */

export function getRecruiters() {
  return RECRUITERS.map((r) => {
    const owned = CANDIDATES.filter((c) => c.recruiterId === r.id);
    const completed = owned.filter((c) => c.status === "completed");
    return {
      ...r,
      activeCandidates: completed.filter((c) => c.stage !== "placed").length,
      awaitingReview: completed.filter((c) => c.stage === "new" || c.stage === "reviewing").length,
      interviewing: completed.filter((c) => c.stage === "interview").length,
      placed: completed.filter((c) => c.stage === "placed").length,
      overdue: owned.filter((c) => c.nextAction && !c.nextAction.completed && new Date(c.nextAction.dueAt).getTime() < NOW).length,
    };
  });
}

export function getTagCatalog() {
  return TAG_CATALOG;
}

/**
 * getAnalyticsSnapshot - aggregate funnel/quality/pipeline/team metrics
 * for the analytics page. Computed client-side over the mock dataset
 * (26 candidates) for now; a real backend should aggregate this
 * server-side rather than shipping the full candidate table to compute
 * it in the browser (see the brief's note on analytics architecture at
 * production scale).
 */
export function getAnalyticsSnapshot() {
  const completed = CANDIDATES.filter((c) => c.status === "completed");
  const processing = CANDIDATES.filter((c) => c.status === "processing").length;
  const failed = CANDIDATES.filter((c) => c.status === "failed").length;

  const funnel = STAGE_ORDER.map((key, idx) => ({
    key,
    label: STAGE_LABELS[key],
    // "Reached this stage or further" - a true funnel, not just a
    // point-in-time headcount per stage.
    count: completed.filter((c) => STAGE_ORDER.indexOf(c.stage) >= idx).length,
  }));

  const scored = completed.filter((c) => c.score !== null);
  const avgScore = scored.length ? Math.round(scored.reduce((s, c) => s + c.score, 0) / scored.length) : 0;
  const strong = scored.filter((c) => c.score >= 80).length;
  const moderate = scored.filter((c) => c.score >= 60 && c.score < 80).length;
  const weak = scored.filter((c) => c.score < 60).length;

  const stageCounts = {};
  STAGE_ORDER.forEach((k) => (stageCounts[k] = completed.filter((c) => c.stage === k).length));

  const midStages = STAGE_ORDER.slice(1, -1);
  const stalled = completed.filter(
    (c) => midStages.includes(c.stage) && new Date(c.lastActivityAt).getTime() < NOW - 5 * DAY
  ).length;

  const placed = completed.filter((c) => c.stage === "placed").length;
  const shortlistedOrFurther = completed.filter((c) => STAGE_ORDER.indexOf(c.stage) >= STAGE_ORDER.indexOf("shortlisted")).length;
  const interviewedOrFurther = completed.filter((c) => STAGE_ORDER.indexOf(c.stage) >= STAGE_ORDER.indexOf("interview")).length;
  const offeredOrFurther = completed.filter((c) => STAGE_ORDER.indexOf(c.stage) >= STAGE_ORDER.indexOf("offer")).length;

  return {
    totals: {
      totalCandidates: CANDIDATES.length,
      completed: completed.length,
      processing,
      failed,
      totalJobs: JOBS.length,
      openJobs: JOBS.filter((j) => j.status === "open").length,
    },
    funnel,
    quality: { avgScore, strong, moderate, weak, scoredCount: scored.length },
    pipeline: { stageCounts, stalled },
    conversion: {
      shortlistRate: completed.length ? Math.round((shortlistedOrFurther / completed.length) * 100) : 0,
      interviewRate: completed.length ? Math.round((interviewedOrFurther / completed.length) * 100) : 0,
      offerRate: completed.length ? Math.round((offeredOrFurther / completed.length) * 100) : 0,
      placementRate: completed.length ? Math.round((placed / completed.length) * 100) : 0,
    },
    team: getRecruiters(),
  };
}

/* ------------------------------------------------------------------------
 * Mutations - mock stand-ins for PATCH/POST endpoints. Each returns the
 * updated candidate (via getCandidateById) so callers can just re-read
 * state rather than manually reconciling a partial response.
 * ---------------------------------------------------------------------- */

function findMutable(id) {
  return CANDIDATES.find((c) => c.id === id) ?? null;
}

function touch(candidate) {
  candidate.lastActivityAt = new Date().toISOString();
}

export function updateCandidateStage(id, newStage, actor = "You") {
  const c = findMutable(id);
  if (!c || !STAGE_LABELS[newStage]) return null;
  const from = c.stage;
  c.stage = newStage;
  touch(c);
  c.activityLog.push({ id: `act-${Date.now()}`, type: "stage_changed", actor, timestamp: c.lastActivityAt, meta: { from, to: newStage } });
  return getCandidateById(id);
}

export function assignCandidate(id, recruiterId, actor = "You") {
  const c = findMutable(id);
  if (!c) return null;
  const from = recruiterName(c.recruiterId);
  c.recruiterId = recruiterId;
  touch(c);
  c.activityLog.push({ id: `act-${Date.now()}`, type: "assigned", actor, timestamp: c.lastActivityAt, meta: { from, to: recruiterName(recruiterId) } });
  return getCandidateById(id);
}

export function addCandidateNote(id, body, author = "You") {
  const c = findMutable(id);
  if (!c || !body.trim()) return null;
  const n = { id: `note-${Date.now()}`, author, createdAt: new Date().toISOString(), body: body.trim() };
  c.notes = [n, ...c.notes];
  touch(c);
  c.activityLog.push({ id: `act-${Date.now()}`, type: "note_added", actor: author, timestamp: c.lastActivityAt, meta: null });
  return getCandidateById(id);
}

export function addCandidateTag(id, tagId, actor = "You") {
  const c = findMutable(id);
  if (!c || c.tags.includes(tagId)) return c ? getCandidateById(id) : null;
  c.tags = [...c.tags, tagId];
  touch(c);
  c.activityLog.push({ id: `act-${Date.now()}`, type: "tag_added", actor, timestamp: c.lastActivityAt, meta: { tag: tagLabel(tagId) } });
  return getCandidateById(id);
}

export function removeCandidateTag(id, tagId, actor = "You") {
  const c = findMutable(id);
  if (!c) return null;
  c.tags = c.tags.filter((t) => t !== tagId);
  touch(c);
  c.activityLog.push({ id: `act-${Date.now()}`, type: "tag_removed", actor, timestamp: c.lastActivityAt, meta: { tag: tagLabel(tagId) } });
  return getCandidateById(id);
}

export function setCandidateNextAction(id, { label, dueAt }, actor = "You") {
  const c = findMutable(id);
  if (!c || !label?.trim()) return null;
  c.nextAction = { id: `na-${Date.now()}`, label: label.trim(), dueAt: dueAt ?? null, completed: false };
  touch(c);
  c.activityLog.push({ id: `act-${Date.now()}`, type: "next_action_set", actor, timestamp: c.lastActivityAt, meta: { label: c.nextAction.label } });
  return getCandidateById(id);
}

export function completeNextAction(id, actor = "You") {
  const c = findMutable(id);
  if (!c || !c.nextAction) return null;
  const label = c.nextAction.label;
  c.nextAction = null;
  touch(c);
  c.activityLog.push({ id: `act-${Date.now()}`, type: "next_action_completed", actor, timestamp: c.lastActivityAt, meta: { label } });
  return getCandidateById(id);
}
