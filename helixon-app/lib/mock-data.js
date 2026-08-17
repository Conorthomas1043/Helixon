// lib/mock-data.js
//
// REFERENCE IMPLEMENTATION
// ------------------------
// Built against two real consumers now confirmed from your project:
//   - app/analyse/[id]/page.jsx  → needs getAnalysisById(id), and reads
//     analysis.candidate.{name,currentTitle,...} and analysis.job.{title,...}
//     UNCONDITIONALLY (outside any status check), so every record — even
//     failed ones — must carry a candidate object, and every non-failed
//     record must carry a job object.
//   - AgencyDashboardPage.jsx    → needs getMockData() + STAGE_LABELS, and
//     reads candidate/job either flat (candidateName, jobTitle, company) or
//     nested (candidate.name, job.title, job.company) via its
//     normalizeAnalysis() adapter. This file uses the nested shape, which
//     that adapter already prefers as a fallback — no dashboard changes
//     needed.
//
// If your real lib/mock-data.js differs from this, merge field names rather
// than replacing the whole file, and paste it here if you'd like it aligned
// exactly.

export const STAGE_LABELS = {
  new: "New",
  review: "Review",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  placed: "Placed",
};

const RECRUITERS = ["Priya Shah", "Marcus Webb", "Elena Torres"];

const JOBS = [
  { title: "Senior Software Engineer", company: "Nova Systems", seniority: "Senior", location: "London, UK" },
  { title: "Product Manager", company: "Fieldstone Health", seniority: "Mid-level", location: "Manchester, UK" },
  { title: "UX Researcher", company: "Brightlane Digital", seniority: "Mid-level", location: "Remote (UK)" },
  { title: "Data Analyst", company: "Nova Systems", seniority: "Junior", location: "London, UK" },
  { title: "DevOps Engineer", company: "Vantage Cloud", seniority: "Senior", location: "Bristol, UK" },
  { title: "Customer Success Lead", company: "Fieldstone Health", seniority: "Mid-level", location: "Remote (UK)" },
];

const CANDIDATES = [
  "Jordan Williams", "Sarah Evans", "Michael Chen", "Aisha Patel",
  "Tom Fletcher", "Priya Nair", "Daniel Osei", "Grace Kim",
  "Liam O'Connor", "Fatima Al-Sayed", "Noah Bergstrom", "Ruth Adeyemi",
  "Ethan Brooks", "Chloe Martin", "Omar Haddad", "Ines Costa",
  "Jack Sullivan", "Maya Lindqvist",
];

const TITLES = [
  "Software Engineer", "Senior Developer", "Product Analyst", "UX Designer",
  "Platform Engineer", "Support Lead", "Data Engineer", "Engineering Manager",
];

const SKILL_POOL = [
  "JavaScript", "TypeScript", "React", "Node.js", "AWS", "SQL", "Python",
  "Product strategy", "Stakeholder management", "User research", "Figma",
  "Kubernetes", "Docker", "CI/CD", "Terraform", "Data visualisation",
  "A/B testing", "Salesforce", "Roadmapping", "GraphQL",
];

const SOURCES = ["LinkedIn", "Referral", "Job board", "Agency database"];
const NOTICE_PERIODS = ["Immediate", "2 weeks", "1 month", "3 months"];

const ERROR_MESSAGES = [
  "Unable to parse the uploaded resume — the file appears to be corrupted or password protected.",
  "No matching job requisition was found for this analysis. Re-run once the role is linked.",
];

function daysAgo(n, hour = 9) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").trim().replace(/\s+/g, "-");
}

function buildCandidate(i, { full }) {
  const name = pick(CANDIDATES, i);
  const slug = slugify(name);

  if (!full) {
    // Failed analyses: we know who was uploaded, not much else.
    return {
      name,
      currentTitle: pick(TITLES, i),
      currentEmployer: null,
      email: null,
      phone: null,
      location: null,
      yearsExperience: null,
      noticePeriod: null,
      salaryExpectation: null,
      source: pick(SOURCES, i),
      linkedinUrl: null,
      skills: [],
      resumeUrl: "#",
    };
  }

  return {
    name,
    currentTitle: pick(TITLES, i),
    currentEmployer: pick(JOBS, i + 2).company,
    email: `${slug}@example.com`,
    phone: `+44 7${String(100000000 + i * 137).slice(0, 9)}`,
    location: pick(JOBS, i).location,
    yearsExperience: 2 + (i % 12),
    noticePeriod: pick(NOTICE_PERIODS, i),
    salaryExpectation: `£${45 + (i % 8) * 5}k - £${55 + (i % 8) * 5}k`,
    source: pick(SOURCES, i),
    linkedinUrl: `https://www.linkedin.com/in/${slug}`,
    skills: [0, 1, 2, 3].map((offset) => pick(SKILL_POOL, i + offset)).filter((s, idx, arr) => arr.indexOf(s) === idx),
    resumeUrl: "#",
  };
}

function buildScoreBreakdown(score, i) {
  const jitter = (n) => Math.max(10, Math.min(100, n + (((i * 7) % 11) - 5)));
  return {
    skillsMatch: jitter(score + 4),
    experienceMatch: jitter(score - 6),
    culturalFit: jitter(score + 2),
    availability: jitter(score - 2),
  };
}

function buildStandoutFactors(score, i) {
  const pool = [
    "Directly relevant experience for this role's core responsibilities",
    "Progressed quickly through similar roles at comparable companies",
    "Strong overlap with the must-have skills on the job spec",
    "Available on short notice, matching the role's urgency",
    "Referred by an existing employee at the hiring company",
  ];
  const count = score >= 80 ? 3 : 2;
  return Array.from({ length: count }, (_, k) => pool[(i + k) % pool.length]);
}

function buildGaps(score, i) {
  const pool = [
    "Limited exposure to the specific tech stack listed in the job spec",
    "Notice period is longer than the hiring manager's stated timeline",
    "No direct experience at this company's scale",
    "Salary expectation sits above the advertised band",
  ];
  const count = score >= 80 ? 1 : 2;
  return Array.from({ length: count }, (_, k) => pool[(i + k) % pool.length]);
}

function buildDraftEmail(candidateName, job) {
  const firstName = candidateName.split(" ")[0];
  return `Hi ${firstName},

I came across your profile while recruiting for the ${job.title} role at ${job.company}, and your background looks like a strong fit.

Would you be open to a short call this week to talk through the role and see whether it's the right next step for you?

Best,
Your recruiter`;
}

// Deterministic-ish generation so the dashboard has a believable spread of
// scores, stages, statuses and dates across roughly the last three weeks.
// [daysAgoCreated, status, stage, score, recruiterIdx, jobIdx]
const BLUEPRINT = [
  [0, "completed", "new", 92, 0, 0],
  [0, "failed", "new", null, 1, null],
  [0, "processing", "new", null, 2, 1],
  [1, "completed", "new", 88, 0, 0],
  [1, "completed", "review", 74, 1, 1],
  [1, "completed", "shortlisted", 81, 2, 2],
  [2, "completed", "interview", 69, 0, 3],
  [2, "completed", "new", 54, 1, 4],
  [2, "processing", "new", null, 0, 5],
  [3, "completed", "offer", 90, 2, 0],
  [3, "completed", "review", 63, 0, 1],
  [3, "failed", "new", null, 1, null],
  [4, "completed", "placed", 95, 2, 2],
  [4, "completed", "new", 84, 1, 3],
  [4, "completed", "shortlisted", 71, 0, 4],
  [5, "completed", "review", 58, null, 5],
  [5, "completed", "interview", 77, 2, 0],
  [6, "completed", "new", 66, 0, 1],
  [8, "completed", "review", 85, 1, 2],
  [9, "completed", "placed", 89, 0, 3],
  [10, "completed", "new", 47, 2, 4],
  [11, "completed", "shortlisted", 79, 1, 5],
  [12, "completed", "offer", 91, 0, 0],
  [13, "completed", "new", 60, null, 1],
  [14, "completed", "interview", 73, 2, 2],
  [16, "completed", "placed", 97, 1, 3],
  [18, "completed", "review", 55, 0, 4],
  [20, "completed", "new", 82, 2, 5],
];

let _errorIdx = 0;

function buildAnalyses() {
  return BLUEPRINT.map(([age, status, stage, score, recruiterIdx, jobIdx], i) => {
    const id = `an_${String(i + 1).padStart(3, "0")}`;
    const full = status !== "failed";
    const candidate = buildCandidate(i, { full });
    const job = status === "failed" ? null : pick(JOBS, jobIdx ?? i);
    const recruiterName = recruiterIdx === null || recruiterIdx === undefined ? null : pick(RECRUITERS, recruiterIdx);

    const base = {
      id,
      candidate,
      job,
      recruiterName,
      status,
      stage,
      score,
      createdAt: daysAgo(age, 8 + (i % 9)),
    };

    if (status === "failed") {
      return {
        ...base,
        errorMessage: ERROR_MESSAGES[_errorIdx++ % ERROR_MESSAGES.length],
        scoreBreakdown: null,
        standoutFactors: [],
        gaps: [],
        draftEmail: null,
      };
    }

    if (status === "processing") {
      return {
        ...base,
        scoreBreakdown: null,
        standoutFactors: [],
        gaps: [],
        draftEmail: null,
      };
    }

    // completed
    return {
      ...base,
      scoreBreakdown: buildScoreBreakdown(score, i),
      standoutFactors: buildStandoutFactors(score, i),
      gaps: buildGaps(score, i),
      draftEmail: buildDraftEmail(candidate.name, job),
    };
  });
}

// Generated once and cached so every caller (the dashboard via
// getMockData(), a detail page via getAnalysisById()) sees the exact same
// records rather than a freshly-randomised set on every call.
let _cachedData = null;

function loadData() {
  if (!_cachedData) {
    _cachedData = {
      agency: {
        name: "Bright Path Recruitment",
        plan: {
          name: "Growth",
          analysesUsed: 32,
          analysesLimit: 50,
        },
      },
      recentAnalyses: buildAnalyses(),
    };
  }
  return _cachedData;
}

export function getMockData() {
  return loadData();
}

// Used by app/analyse/[id]/page.jsx. Returns the full nested record —
// candidate.name/currentTitle are read unconditionally by that page (even
// for failed analyses), so every record here always carries a candidate
// object; job is only required for non-failed statuses.
export function getAnalysisById(id) {
  const { recentAnalyses } = loadData();
  return recentAnalyses.find((a) => a.id === id) ?? null;
}
