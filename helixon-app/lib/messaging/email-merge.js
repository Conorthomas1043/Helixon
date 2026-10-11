// Merge fields for email templates and sequences: {{candidate.first_name}}
// and friends. Rendering reports any field it couldn't fill, so the
// compose screen can warn before something goes out saying "Hi ,".

export const MERGE_FIELDS = {
  "candidate.first_name": "Candidate's first name",
  "candidate.name": "Candidate's full name",
  "candidate.current_title": "Candidate's current title",
  "candidate.current_company": "Candidate's current employer",
  "job.title": "Job title",
  "job.client": "Client (company)",
  "job.location": "Job location",
  "job.salary": "Salary range",
  "contact.first_name": "Client contact's first name",
  "contact.name": "Client contact's full name",
  "recruiter.first_name": "Your first name",
  "recruiter.name": "Your full name",
  "agency.name": "Agency name",
};

const FIELD_RE = /\{\{\s*([a-z_]+\.[a-z_]+)\s*\}\}/gi;

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

// The values for one recipient. Any argument may be null.
export function mergeContext({ candidate, job, contact, recruiter, agencyName }) {
  const candidateName = candidate?.full_name || candidate?.name || candidate?.fullName || "";
  const recruiterName = [recruiter?.first_name, recruiter?.last_name].filter(Boolean).join(" ") || recruiter?.name || "";
  return {
    "candidate.first_name": firstName(candidateName),
    "candidate.name": candidateName,
    "candidate.current_title": candidate?.current_title || candidate?.currentTitle || "",
    "candidate.current_company": candidate?.current_company || candidate?.currentCompany || "",
    "job.title": job?.title || "",
    "job.client": job?.client || "",
    "job.location": job?.location || "",
    "job.salary": job?.salary_range || job?.salaryRange || "",
    "contact.first_name": firstName(contact?.name),
    "contact.name": contact?.name || "",
    "recruiter.first_name": recruiter?.first_name || firstName(recruiterName),
    "recruiter.name": recruiterName,
    "agency.name": agencyName || "",
  };
}

// { text, missing: [field] } - unknown fields are left as typed and listed
// too, so a typo like {{candiate.name}} is caught rather than sent.
export function renderTemplate(text, context) {
  const missing = new Set();
  const out = String(text ?? "").replace(FIELD_RE, (whole, key) => {
    const k = key.toLowerCase();
    if (!(k in MERGE_FIELDS)) {
      missing.add(k);
      return whole;
    }
    const value = context?.[k];
    if (!value) {
      missing.add(k);
      return "";
    }
    return value;
  });
  return { text: out, missing: [...missing] };
}
