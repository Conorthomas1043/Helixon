// CSV import: which columns mean what, for candidates, clients (with a
// contact) and jobs. Header aliases include the column names Bullhorn,
// Vincere, JobAdder, Recruit CRM and plain spreadsheets export, so most
// files map themselves. Pure - used in the browser for the preview and on
// the server (app/api/import) to validate again.

export const IMPORT_TYPES = {
  candidates: {
    label: "Candidates",
    fields: [
      { key: "full_name", label: "Full name", aliases: ["name", "full name", "candidate name", "candidate", "fullname", "display name"] },
      { key: "first_name", label: "First name", aliases: ["first name", "firstname", "forename", "given name", "first"] },
      { key: "last_name", label: "Last name", aliases: ["last name", "lastname", "surname", "family name", "last"] },
      { key: "email", label: "Email", aliases: ["email", "email address", "e-mail", "email 1", "primary email", "personal email", "email1"] },
      { key: "phone", label: "Phone", aliases: ["phone", "mobile", "mobile phone", "phone number", "telephone", "cell", "mobile number", "phone 1", "home phone", "work phone"] },
      { key: "linkedin", label: "LinkedIn", aliases: ["linkedin", "linkedin url", "linkedin profile", "linked in"] },
      { key: "location", label: "Location", aliases: ["location", "city", "town", "address city", "current location", "region"] },
      { key: "current_title", label: "Current job title", aliases: ["current title", "job title", "title", "occupation", "current position", "position", "current job title", "headline"] },
      { key: "current_company", label: "Current employer", aliases: ["current company", "company", "employer", "current employer", "company name", "organisation"] },
      { key: "skills", label: "Skills", aliases: ["skills", "skill set", "key skills", "skillset", "specialisms"] },
      { key: "notes", label: "Notes", aliases: ["notes", "comments", "summary", "description", "general comments"] },
      { key: "source", label: "Source", aliases: ["source", "lead source", "candidate source", "origin"] },
      { key: "last_activity_at", label: "Last contacted (date)", aliases: ["last contacted", "last contact", "last activity", "date last modified", "last modified", "last updated"] },
    ],
  },
  clients: {
    label: "Clients & contacts",
    fields: [
      { key: "name", label: "Company name", required: true, aliases: ["company", "company name", "client", "client name", "account", "account name", "organisation", "organization"] },
      { key: "industry", label: "Industry", aliases: ["industry", "sector", "business sector"] },
      { key: "website", label: "Website", aliases: ["website", "web", "url", "company website", "web address"] },
      { key: "address", label: "Address", aliases: ["address", "company address", "address 1", "street", "billing address"] },
      { key: "fee_percent", label: "Fee %", aliases: ["fee", "fee %", "fee percent", "fee percentage", "placement fee %", "perm fee"] },
      { key: "payment_terms_days", label: "Payment terms (days)", aliases: ["payment terms", "terms", "payment days"] },
      { key: "contact_name", label: "Contact name", aliases: ["contact", "contact name", "client contact", "hiring manager", "full name", "name"] },
      { key: "contact_title", label: "Contact job title", aliases: ["contact title", "job title", "title", "position", "contact position"] },
      { key: "contact_email", label: "Contact email", aliases: ["contact email", "email", "email address", "e-mail"] },
      { key: "contact_phone", label: "Contact phone", aliases: ["contact phone", "phone", "telephone", "mobile", "direct dial"] },
    ],
  },
  jobs: {
    label: "Jobs",
    fields: [
      { key: "title", label: "Job title", required: true, aliases: ["title", "job title", "position", "role", "vacancy", "job"] },
      { key: "client", label: "Client", aliases: ["client", "company", "client name", "company name", "account", "employer"] },
      { key: "location", label: "Location", aliases: ["location", "city", "address city", "job location"] },
      { key: "salary_range", label: "Salary", aliases: ["salary", "salary range", "pay", "rate", "remuneration", "compensation"] },
      { key: "employment_type", label: "Employment type", aliases: ["type", "employment type", "job type", "contract type"] },
      { key: "seniority", label: "Seniority", aliases: ["seniority", "level", "grade"] },
      { key: "required_skills", label: "Required skills", aliases: ["skills", "required skills", "key skills"] },
      { key: "job_text", label: "Description", aliases: ["description", "job description", "public description", "details", "spec", "job spec"] },
      { key: "status", label: "Status (open/closed)", aliases: ["status", "job status", "state"] },
    ],
  },
};

export function normaliseHeader(h) {
  return String(h || "")
    .toLowerCase()
    .replace(/[_\-.:()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// { fieldKey: columnIndex } from a header row - exact alias matches first,
// each column used at most once.
export function guessMapping(headers, type) {
  const def = IMPORT_TYPES[type];
  const mapping = {};
  const used = new Set();
  const norm = (headers || []).map(normaliseHeader);
  for (const field of def.fields) {
    const idx = norm.findIndex((h, i) => !used.has(i) && (h === field.key.replace(/_/g, " ") || field.aliases.includes(h)));
    if (idx >= 0) {
      mapping[field.key] = idx;
      used.add(idx);
    }
  }
  return mapping;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = ["referral", "job_board", "linkedin", "direct_sourcing", "agency_database", "careers_page", "other"];

function str(v, max) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function list(v) {
  return String(v ?? "")
    .split(/[;,|\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((s) => s.slice(0, 100));
}

function sourceOf(v) {
  const s = str(v, 60).toLowerCase();
  if (!s) return null;
  if (SOURCES.includes(s)) return s;
  if (/linked/.test(s)) return "linkedin";
  if (/refer/.test(s)) return "referral";
  if (/(indeed|totaljobs|reed|monster|cv.?library|board|advert)/.test(s)) return "job_board";
  if (/(website|careers)/.test(s)) return "careers_page";
  return "other";
}

function dateOf(v) {
  const s = str(v, 40);
  if (!s) return null;
  // dd/mm/yyyy (UK exports) as well as ISO.
  const uk = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  const d = uk ? new Date(Date.UTC(+uk[3], +uk[2] - 1, +uk[1])) : new Date(s);
  return Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86400000 ? null : d.toISOString();
}

function number(v, min, max) {
  const s = str(v, 20).replace(/[%£$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
}

// One CSV row (array of cells) -> { record, errors } using `mapping`.
export function mapRow(cells, mapping, type) {
  const get = (key) => (mapping[key] === undefined ? "" : cells[mapping[key]] ?? "");
  const errors = [];

  if (type === "candidates") {
    const name = str(get("full_name"), 200) || str(`${get("first_name")} ${get("last_name")}`, 200);
    if (!name) errors.push("No name");
    const email = str(get("email"), 254).toLowerCase();
    if (email && !EMAIL_RE.test(email)) errors.push("Invalid email");
    return {
      errors,
      record: {
        full_name: name,
        email: email && EMAIL_RE.test(email) ? email : null,
        phone: str(get("phone"), 40) || null,
        linkedin: str(get("linkedin"), 200) || null,
        location: str(get("location"), 200) || null,
        current_title: str(get("current_title"), 200) || null,
        current_company: str(get("current_company"), 200) || null,
        skills: list(get("skills")),
        notes: String(get("notes") ?? "").trim().slice(0, 5000) || null,
        source: sourceOf(get("source")),
        last_activity_at: dateOf(get("last_activity_at")),
      },
    };
  }

  if (type === "clients") {
    const name = str(get("name"), 200);
    if (!name) errors.push("No company name");
    const fee = number(get("fee_percent"), 0, 100);
    if (fee === undefined) errors.push("Fee isn't a percentage");
    const terms = number(get("payment_terms_days"), 0, 365);
    if (terms === undefined) errors.push("Payment terms aren't 0–365 days");
    const email = str(get("contact_email"), 254).toLowerCase();
    if (email && !EMAIL_RE.test(email)) errors.push("Invalid contact email");
    return {
      errors,
      record: {
        name,
        industry: str(get("industry"), 120) || null,
        website: str(get("website"), 300) || null,
        address: str(get("address"), 500) || null,
        fee_percent: fee ?? null,
        payment_terms_days: terms === undefined || terms === null ? null : Math.round(terms),
        contact_name: str(get("contact_name"), 200) || (email ? email.split("@")[0] : null),
        contact_title: str(get("contact_title"), 200) || null,
        contact_email: email && EMAIL_RE.test(email) ? email : null,
        contact_phone: str(get("contact_phone"), 40) || null,
      },
    };
  }

  // jobs
  const title = str(get("title"), 160);
  if (!title) errors.push("No job title");
  const status = str(get("status"), 20).toLowerCase();
  return {
    errors,
    record: {
      title,
      client: str(get("client"), 160) || null,
      location: str(get("location"), 160) || null,
      salary_range: str(get("salary_range"), 80) || null,
      employment_type: str(get("employment_type"), 60) || null,
      seniority: str(get("seniority"), 60) || null,
      required_skills: list(get("required_skills")),
      job_text: String(get("job_text") ?? "").trim().slice(0, 20000) || null,
      status: /(closed|filled|cancel|lost|archiv)/.test(status) ? "closed" : "open",
    },
  };
}

export const MAX_IMPORT_ROWS = 5000;
export const IMPORT_BATCH = 250;
