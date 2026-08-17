// Deterministic mock data generator for the dashboard.
// Swap this out for real API calls later — the shape is what matters.

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
  { id: "r1", name: "Priya Shah" },
  { id: "r2", name: "Tom Ellery" },
  { id: "r3", name: "Nadia Osei" },
];

const JOBS = [
  { id: "j1", title: "Senior Frontend Engineer", company: "Fenwick & Co", seniority: "Senior", location: "London, UK" },
  { id: "j2", title: "Product Manager", company: "Northbridge", seniority: "Mid", location: "Remote" },
  { id: "j3", title: "Data Analyst", company: "Harlow Group", seniority: "Junior", location: "Manchester, UK" },
  { id: "j4", title: "DevOps Engineer", company: "Coriolis Systems", seniority: "Senior", location: "Bristol, UK" },
];

const FIRST_NAMES = ["Amara", "Liam", "Sofia", "Kwame", "Elena", "Marcus", "Priya", "Daniel", "Yuki", "Oscar", "Freya", "Idris", "Chloe", "Ravi", "Maya", "Callum", "Isla", "Noah", "Zara", "Theo"];
const LAST_NAMES = ["Osei", "Bennett", "Ricci", "Adeyemi", "Novak", "Turner", "Nair", "Hughes", "Sato", "Wallace", "Grant", "Farouk", "Dubois", "Malhotra", "Byrne", "Mensah", "Larsen", "Coleman", "Petrov", "Fitzgerald"];
const CITIES = ["London, UK", "Manchester, UK", "Bristol, UK", "Leeds, UK", "Edinburgh, UK", "Remote", "Birmingham, UK", "Cardiff, UK"];
const SOURCES = ["LinkedIn", "Referral", "Job board", "Agency network", "Direct application"];
const SKILLS_POOL = ["React", "TypeScript", "Node.js", "Python", "SQL", "AWS", "Figma", "Product strategy", "SEO", "Data visualization", "GraphQL", "Docker", "Kubernetes", "Excel", "Stakeholder management", "A/B testing", "CI/CD", "Terraform"];
const STANDOUT_POOL = ["Led a team of 5+ engineers", "Shipped a major feature in under a quarter", "Strong portfolio of relevant work", "Excellent communication in screening call", "Directly relevant industry experience", "Consistently exceeded targets in previous role"];
const GAPS_POOL = ["Limited experience at this seniority level", "No direct industry background", "Salary expectation above range", "Notice period longer than ideal", "Gap in employment history", "Skills lean junior for this role"];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }
function pickMany(rand, arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
}

const STAGE_WEIGHTS = [
  ["new", 20], ["screened", 18], ["shortlisted", 14], ["submitted_to_client", 12],
  ["interviewing", 10], ["offer", 6], ["placed", 12], ["rejected", 8],
];
function weightedStage(rand) {
  const total = STAGE_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [stage, w] of STAGE_WEIGHTS) { if ((r -= w) <= 0) return stage; }
  return "new";
}

function buildAnalyses() {
  const rand = mulberry32(42);
  const analyses = [];
  let counter = 1;

  JOBS.forEach((job) => {
    const count = 8 + Math.floor(rand() * 6); // 8–13 per job
    for (let i = 0; i < count; i++) {
      const id = `a${counter++}`;
      const recruiter = pick(rand, RECRUITERS);
      const failed = rand() < 0.06;
      const status = failed ? "failed" : "completed";
      const score = failed ? null : Math.round(35 + rand() * 60);
      const stage = failed ? "new" : weightedStage(rand);
      const daysAgo = Math.floor(Math.pow(rand(), 1.5) * 110); // skew recent
      const createdAt = new Date(Date.now() - daysAgo * 86400000).toISOString();
      const first = pick(rand, FIRST_NAMES);
      const last = pick(rand, LAST_NAMES);
      const name = `${first} ${last}`;
      const skills = pickMany(rand, SKILLS_POOL, 3 + Math.floor(rand() * 4));

      const scoreBreakdown = failed ? null : {
        skillsMatch: Math.min(100, Math.max(0, Math.round(score + (rand() * 20 - 10)))),
        experienceMatch: Math.min(100, Math.max(0, Math.round(score + (rand() * 20 - 10)))),
        educationMatch: Math.min(100, Math.max(0, Math.round(score + (rand() * 20 - 10)))),
        seniorityMatch: Math.min(100, Math.max(0, Math.round(score + (rand() * 20 - 10)))),
      };

      analyses.push({
        id,
        createdAt,
        status,
        errorMessage: failed ? "Could not parse resume file — unsupported format or corrupted upload." : null,
        stage,
        score,
        scoreBreakdown,
        recruiterId: recruiter.id,
        recruiterName: recruiter.name,
        job: { id: job.id, title: job.title, company: job.company, seniority: job.seniority, location: job.location },
        daysToPlacement: stage === "placed" ? 12 + Math.floor(rand() * 70) : undefined,
        timeInStageDays: Math.floor(rand() * 25),
        standoutFactors: failed ? [] : pickMany(rand, STANDOUT_POOL, 2),
        gaps: failed ? [] : pickMany(rand, GAPS_POOL, 1 + Math.floor(rand() * 2)),
        draftEmail: failed ? null : `Hi ${first},\n\nThanks for applying to the ${job.title} role at ${job.company}. Your background in ${skills[0]} stood out and we'd love to set up a quick call this week — does Wednesday or Thursday afternoon work?\n\nBest,\n${recruiter.name}`,
        candidate: {
          name,
          email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`,
          phone: `+44 7${Math.floor(100000000 + rand() * 899999999)}`,
          location: pick(rand, CITIES),
          currentTitle: job.title.replace("Senior ", "").replace("Lead ", ""),
          currentEmployer: `${pick(rand, LAST_NAMES)} ${pick(rand, ["Ltd", "Group", "Partners", "Studio"])}`,
          yearsExperience: 1 + Math.floor(rand() * 14),
          noticePeriod: pick(rand, ["Immediate", "2 weeks", "1 month", "3 months"]),
          salaryExpectation: `£${(35 + Math.floor(rand() * 55)) * 1000}`,
          source: pick(rand, SOURCES),
          linkedinUrl: rand() > 0.15 ? `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}` : null,
          skills,
          resumeUrl: `https://example.com/resumes/${id}.pdf`,
        },
      });
    }
  });

  return analyses;
}

const RECENT_ANALYSES = buildAnalyses();

export function getMockData() {
  return {
    email: "you@helixon.io",
    jobs: JOBS,
    recruiters: RECRUITERS,
    recentAnalyses: RECENT_ANALYSES,
  };
}

export function getAnalysisById(id) {
  return RECENT_ANALYSES.find((a) => a.id === id) ?? null;
}
