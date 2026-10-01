// An agency's public jobs page (/jobs/<slug>) and the jobs on it - see
// supabase/migrations/20261001030000_careers_and_applications.sql.

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/;

// Paths under /jobs that can't be agency slugs.
const RESERVED = new Set(["admin", "api", "apply", "feed", "new", "search", "dashboard", "helixon", "www"]);

export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
}

export function validSlug(slug) {
  return SLUG_RE.test(slug || "") && !RESERVED.has(slug);
}

// ?src= on an application link -> the candidate's source bucket
// (candidates.source / job_channels.channel) and a detail label.
const SOURCES = {
  linkedin: "linkedin",
  "linkedin-post": "linkedin",
  "linkedin-jobs": "linkedin",
  indeed: "job_board",
  totaljobs: "job_board",
  reed: "job_board",
  cvlibrary: "job_board",
  "cv-library": "job_board",
  glassdoor: "job_board",
  monster: "job_board",
  google: "job_board",
  jobboard: "job_board",
  referral: "referral",
  email: "direct_sourcing",
  newsletter: "direct_sourcing",
  facebook: "other",
  instagram: "other",
  x: "other",
  twitter: "other",
};

export function sourceFromParam(param) {
  const detail = String(param || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
  if (!detail) return { source: "careers_page", detail: null };
  return { source: SOURCES[detail] ?? "other", detail };
}

// The links a recruiter shares for a job, one per channel.
export const SHARE_CHANNELS = [
  { src: "", label: "Your jobs page" },
  { src: "linkedin", label: "LinkedIn" },
  { src: "indeed", label: "Indeed" },
  { src: "totaljobs", label: "Totaljobs" },
  { src: "reed", label: "Reed" },
  { src: "referral", label: "Referrals" },
  { src: "email", label: "Email / newsletter" },
];

// What the public sees of a job: never the internal description, notes or
// (unless allowed) the client.
export function toPublicJob(row) {
  return {
    id: row.id,
    title: row.public_title || row.title || "Job",
    client: row.hide_client ? null : row.client || null,
    location: row.location || null,
    employmentType: row.employment_type || null,
    seniority: row.seniority || null,
    salary: row.show_salary ? row.salary_range || null : null,
    description: row.public_description || "",
    publishedAt: row.published_at || row.created_at,
  };
}

// The job is live when it's published, open and on a public jobs page.
export function isLive(job, agency) {
  return Boolean(job?.published && job.status === "open" && agency?.careers_enabled && agency?.careers_slug && !agency?.suspended_at);
}

const EMPLOYMENT_TYPES = [
  [/contract|interim|freelance|temp/i, "CONTRACTOR"],
  [/part[\s-]?time/i, "PART_TIME"],
  [/intern/i, "INTERN"],
  [/full[\s-]?time|perm/i, "FULL_TIME"],
];

function employmentType(text) {
  for (const [re, value] of EMPLOYMENT_TYPES) if (re.test(text || "")) return value;
  return undefined;
}

// schema.org JobPosting, so Google for Jobs (and others) can list it.
export function jobPostingJsonLd(job, agency, url) {
  const ld = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: job.title,
    description: (job.description || job.title).replace(/\n/g, "<br>"),
    datePosted: String(job.publishedAt || "").slice(0, 10),
    hiringOrganization: { "@type": "Organization", name: job.client || agency.name, ...(agency.careers_website ? { sameAs: agency.careers_website } : {}) },
    directApply: true,
    url,
  };
  const type = employmentType(job.employmentType);
  if (type) ld.employmentType = type;
  if (job.location) {
    ld.jobLocation = { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: job.location, addressCountry: "GB" } };
    if (/remote/i.test(job.location)) ld.jobLocationType = "TELECOMMUTE";
  }
  return ld;
}

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(s) {
  return `<![CDATA[${String(s ?? "").replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;
}

// An Indeed-style XML job feed - the format most aggregators accept.
export function jobsFeedXml(jobs, agency, siteUrl) {
  const items = jobs
    .map((j) => {
      const url = `${siteUrl}/jobs/${agency.careers_slug}/${j.id}?src=indeed`;
      return [
        "  <job>",
        `    <title>${cdata(j.title)}</title>`,
        `    <date>${xmlEscape(new Date(j.publishedAt).toUTCString())}</date>`,
        `    <referencenumber>${xmlEscape(j.id)}</referencenumber>`,
        `    <url>${xmlEscape(url)}</url>`,
        `    <company>${cdata(j.client || agency.name)}</company>`,
        `    <sourcename>${cdata(agency.name)}</sourcename>`,
        `    <city>${cdata(j.location || "")}</city>`,
        "    <country>GB</country>",
        j.salary ? `    <salary>${cdata(j.salary)}</salary>` : null,
        j.employmentType ? `    <jobtype>${cdata(j.employmentType)}</jobtype>` : null,
        `    <description>${cdata(j.description)}</description>`,
        "  </job>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>\n<source>\n  <publisher>${cdata(agency.name)}</publisher>\n  <publisherurl>${xmlEscape(`${siteUrl}/jobs/${agency.careers_slug}`)}</publisherurl>\n${items}\n</source>\n`;
}
