// The privacy notice an agency gives candidates. The template (with
// [bracketed] blanks) is on /dashboard/privacy to copy; the filled version
// is published with the agency's jobs page (/jobs/<slug>/privacy) and
// linked from the application form.

export const NOTICE_TEMPLATE = `How [Agency name] uses your personal data

We process the CV and details you send us to find and put you forward for roles. Our lawful basis is our legitimate interest in providing recruitment services (and, where we put you forward to a client, taking steps at your request before a contract).

We use Helixon, a recruitment software provider, to organise applications and to help assess how your CV matches a role's requirements. Helixon's AI produces a match score and summary; a recruiter always reviews it, and no decision about you is made by software alone. You can ask for a person to review any assessment.

We keep your data for [12] months after our last contact with you, unless you agree to stay in our talent pool for future roles, and then delete it.

You can ask us for a copy of your data, to correct it, to delete it, or to object to how we use it, by contacting [email address]. You can also complain to the Information Commissioner's Office (ico.org.uk).`;

// The template with the agency's details filled in. A custom notice the
// agency wrote themselves wins.
export function fillNotice({ agencyName, retentionMonths, contactEmail, custom }) {
  if (custom && custom.trim()) return custom.trim();
  return NOTICE_TEMPLATE.replace("[Agency name]", agencyName || "We")
    .replace("[12]", String(retentionMonths || 12))
    .replace("[email address]", contactEmail || "the email address on our website");
}
