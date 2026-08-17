// ═══════════════════════════════════════════════════════════════════════════
// Shared mock data for the agency dashboard suite. Every dashboard page
// imports from here so numbers stay consistent across pages. Replace
// `getMockData()` with a real fetch to your API once the backend exists —
// every page consuming this keeps the same shape, so swapping is a
// one-line change per page.
// ═══════════════════════════════════════════════════════════════════════════

export const STAGES = [
  "new",
  "screened",
  "shortlisted",
  "submitted_to_client",
  "interviewing",
  "offer",
  "placed",
  "rejected",
];

export const STAGE_LABELS = {
  new: "New",
  screened: "Screened",
  shortlisted: "Shortlisted",
  submitted_to_client: "Submitted to client",
  interviewing: "Interviewing",
  offer: "Offer",
  placed: "Placed",
  rejected: "Rejected",
};

const RECRUITERS = [
  { id: "rec_1", name: "Aisha Bello" },
  { id: "rec_2", name: "Conor Reyes" },
  { id: "rec_3", name: "Marcus Webb" },
];

const JOBS = [
  { id: "job_1", title: "Senior Platform Engineer", company: "Acme Robotics", seniority: "Senior", location: "Remote (UK)" },
  { id: "job_2", title: "Backend Engineer", company: "Northwind Logistics", seniority: "Mid", location: "Leeds, UK (Hybrid)" },
  { id: "job_3", title: "DevOps Engineer", company: "Acme Robotics", seniority: "Mid", location: "Remote" },
  { id: "job_4", title: "Frontend Engineer", company: "Marlow Retail", seniority: "Mid", location: "London, UK (Hybrid)" },
  { id: "job_5", title: "Engineering Manager", company: "Vertex Systems", seniority: "Lead", location: "Remote (UK)" },
];

const FIRST_NAMES = ["Priya", "Tom", "Elena", "Jamal", "Sofia", "Liam", "Chidi", "Rosa", "Kenji", "Freya", "Omar", "Nadia", "Callum", "Ines", "Declan"];
const LAST_NAMES = ["Nandakumar", "Ashworth", "Volkov", "Idris", "Marino", "Osei", "Reyes", "Tanaka", "Fitzgerald", "Haddad", "Byrne", "Solano"];
const SKILLS_POOL = ["Kubernetes", "Go", "Terraform", "AWS", "PostgreSQL", "CI/CD", "Node.js", "React", "TypeScript", "Python", "Docker", "GCP", "GraphQL", "Redis", "Kafka"];
const SOURCES = ["Direct upload", "Email intake", "LinkedIn import", "Referral"];

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function pickN(rand, arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
}

function buildAnalyses() {
  const rand = seededRandom(42);
  const now = new Date("2026-08-17T09:00:00Z").getTime();
  const analyses = [];

  for (let i = 0; i < 86; i++) {
    const daysAgo = Math.floor(rand() * 90); // last 90 days
    const createdAt = new Date(now - daysAgo * 86400000 - Math.floor(rand() * 86400000)).toISOString();
    const job = pick(rand, JOBS);
    const recruiter = pick(rand, RECRUITERS);
    const failed = rand() < 0.05;
    const score = failed ? null : Math.round(30 + rand() * 68);
    const stage = failed ? "rejected" : pick(rand, STAGES.filter((s) => s !== "new" || rand() < 0.3));
    const placed = stage === "placed";
    const daysToStage = placed ? Math.round(8 + rand() * 34) : null;

    analyses.push({
      id: `an_${1000 + i}`,
      status: failed ? "failed" : "completed",
      stage,
      createdAt,
      score,
      scoreBreakdown: score
        ? {
            skillsMatch: Math.min(100, Math.round(score + (rand() * 20 - 10))),
            experienceMatch: Math.min(100, Math.round(score + (rand() * 20 - 10))),
            educationMatch: Math.min(100, Math.round(score + (rand() * 20 - 10))),
            seniorityFit: Math.min(100, Math.round(score + (rand() * 20 - 10))),
          }
        : null,
      standoutFactors: failed ? [] : pickN(rand, [
        "Direct experience with the exact stack",
        "Led a small engineering team",
        "Strong open-source contribution history",
        "Prior experience at a company of similar scale",
        "Excellent written communication in cover letter",
      ], 1 + Math.floor(rand() * 3)),
      gaps: failed ? [] : pickN(rand, [
        "No formal certification in required area",
        "Limited experience with one core requirement",
        "Career gap in last 2 years",
        "Slightly under years-of-experience threshold",
      ], Math.floor(rand() * 2)),
      errorMessage: failed ? "Could not parse resume — corrupted or password-protected file" : undefined,
      recruiterId: recruiter.id,
      recruiterName: recruiter.name,
      daysToPlacement: placed ? daysToStage : null,
      timeInStageDays: Math.round(1 + rand() * 12),
      job,
      candidate: {
        name: `${pick(rand, FIRST_NAMES)} ${pick(rand, LAST_NAMES)}`,
        email: "candidate@example.com",
        phone: "+44 7700 900123",
        location: pick(rand, ["Manchester, UK", "Leeds, UK", "London, UK", "Bristol, UK", "Remote"]),
        currentTitle: pick(rand, ["Software Engineer", "Platform Engineer II", "Senior Developer", "DevOps Engineer", "Engineering Lead"]),
        currentEmployer: pick(rand, ["Vertex Systems", "Bramwell Digital", "Northlake Co", "Fenwick Tech", "Independent / Freelance"]),
        yearsExperience: Math.round((1 + rand() * 12) * 10) / 10,
        noticePeriod: pick(rand, ["Immediate", "2 weeks", "1 month", "4 weeks", "3 months"]),
        salaryExpectation: `£${30 + Math.round(rand() * 60)}k–£${40 + Math.round(rand() * 70)}k`,
        linkedinUrl: "https://linkedin.com/in/example",
        resumeUrl: "/files/resume.pdf",
        skills: pickN(rand, SKILLS_POOL, 3 + Math.floor(rand() * 4)),
        source: pick(rand, SOURCES),
      },
      draftEmail: failed ? "" : "Hi there, your background looks like a strong match for this role...",
      recruiterNotes: "",
    });
  }

  return analyses.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export function getMockData() {
  const recentAnalyses = buildAnalyses();
  return {
    agencyName: "Your Agency",
    email: "you@example.com",
    plan: "trial",
    analysesUsed: recentAnalyses.length,
    analysesLimit: 150,
    recruiters: RECRUITERS,
    jobs: JOBS,
    recentAnalyses,
  };
}

export function getAnalysisById(id) {
  const { recentAnalyses } = getMockData();
  return recentAnalyses.find((a) => a.id === id) || null;
}
