// lib/mock-data.js
//
// REFERENCE IMPLEMENTATION
// ------------------------
// The real project's lib/mock-data.js was not available while building this
// redesign, so this file documents the exact data shape the new
// AgencyDashboardPage expects: `getMockData()` and `STAGE_LABELS`.
//
// If your existing lib/mock-data.js already exists with different field
// names, you do NOT need to replace it — just align field names, or adjust
// the `normalizeAnalysis()` adapter near the top of AgencyDashboardPage.jsx,
// which is the single place the page translates raw records into the shape
// every dashboard section relies on.

// Stage keys are the source of truth for the pipeline. Order matters — it
// defines the left-to-right order the pipeline is rendered in. Do not add or
// remove stages here without also checking that recruiters using
// /dashboard/pipeline expect the same set.
export const STAGE_LABELS = {
  new: "New",
  review: "Review",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  placed: "Placed",
};

const RECRUITERS = ["Priya Shah", "Marcus Webb", "Elena Torres"];

const ROLES = [
  { jobTitle: "Senior Software Engineer", company: "Nova Systems" },
  { jobTitle: "Product Manager", company: "Fieldstone Health" },
  { jobTitle: "UX Researcher", company: "Brightlane Digital" },
  { jobTitle: "Data Analyst", company: "Nova Systems" },
  { jobTitle: "DevOps Engineer", company: "Vantage Cloud" },
  { jobTitle: "Customer Success Lead", company: "Fieldstone Health" },
];

const CANDIDATES = [
  "Jordan Williams", "Sarah Evans", "Michael Chen", "Aisha Patel",
  "Tom Fletcher", "Priya Nair", "Daniel Osei", "Grace Kim",
  "Liam O'Connor", "Fatima Al-Sayed", "Noah Bergström", "Ruth Adeyemi",
  "Ethan Brooks", "Chloe Martin", "Omar Haddad", "Ines Costa",
  "Jack Sullivan", "Maya Lindqvist", "Ben Carter", "Zara Ahmed",
  "Leo Fontaine", "Amara Okafor",
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

// Deterministic-ish generation so the dashboard has a believable spread of
// scores, stages, statuses and dates across roughly the last three weeks.
function buildAnalyses() {
  const rows = [];
  let id = 1;

  const blueprint = [
    // [daysAgoCreated, status, stage, score, recruiter?]
    [0, "completed", "new", 92, 0],
    [0, "failed", null, null, 1],
    [0, "processing", null, null, 2],
    [1, "completed", "new", 88, 0],
    [1, "completed", "review", 74, 1],
    [1, "completed", "shortlisted", 81, 2],
    [2, "completed", "interview", 69, 0],
    [2, "completed", "new", 54, 1],
    [2, "processing", null, null, 0],
    [3, "completed", "offer", 90, 2],
    [3, "completed", "review", 63, 0],
    [3, "failed", null, null, 1],
    [4, "completed", "placed", 95, 2],
    [4, "completed", "new", 84, 1],
    [4, "completed", "shortlisted", 71, 0],
    [5, "completed", "review", 58, null],
    [5, "completed", "interview", 77, 2],
    [6, "completed", "new", 66, 0],
    [8, "completed", "review", 85, 1],
    [9, "completed", "placed", 89, 0],
    [10, "completed", "new", 47, 2],
    [11, "completed", "shortlisted", 79, 1],
    [12, "completed", "offer", 91, 0],
    [13, "completed", "new", 60, null],
    [14, "completed", "interview", 73, 2],
    [16, "completed", "placed", 97, 1],
    [18, "completed", "review", 55, 0],
    [20, "completed", "new", 82, 2],
  ];

  blueprint.forEach(([age, status, stage, score, recruiterIdx], i) => {
    const role = pick(ROLES, i);
    rows.push({
      id: `an_${String(id).padStart(3, "0")}`,
      candidateName: pick(CANDIDATES, i),
      jobTitle: role.jobTitle,
      company: role.company,
      recruiterName: recruiterIdx === null ? null : pick(RECRUITERS, recruiterIdx),
      status,
      stage,
      score,
      createdAt: daysAgo(age, 8 + (i % 9)),
    });
    id += 1;
  });

  return rows;
}

export function getMockData() {
  const recentAnalyses = buildAnalyses();

  return {
    agency: {
      name: "Bright Path Recruitment",
      plan: {
        name: "Growth",
        analysesUsed: 32,
        analysesLimit: 50,
      },
    },
    recentAnalyses,
  };
}
