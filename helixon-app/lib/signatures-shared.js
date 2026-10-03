// E-signature labels and starting-point wording, shared by the server
// (lib/signatures.js) and the browser (components/dashboard/SignaturesCard).

export const SIGNATURE_KINDS = { terms: "Terms of business", offer: "Offer letter", contract: "Contract", other: "Document" };
export const SIGNATURE_STATUSES = { sent: "Waiting to be signed", signed: "Signed", declined: "Declined", void: "Withdrawn" };
const money = (n, currency = "GBP") =>
  n == null || n === "" ? null : new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(n));
const day = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null);

// Starting-point terms of business from the client's agreed terms. The
// agency edits it before sending - it isn't legal advice.
export function termsOfBusinessText({ agencyName, clientName, feePercent, paymentTermsDays, rebateDays, termsNotes }) {
  const agency = agencyName || "the Agency";
  const client = clientName || "the Client";
  const lines = [
    `These terms are between ${agency} ("the Agency") and ${client} ("the Client") for the introduction of candidates for permanent employment.`,
    "",
    "1. Introductions",
    "An introduction is made when the Agency gives the Client a candidate's details. Any engagement of an introduced candidate by the Client within 12 months of the introduction is covered by these terms.",
    "",
    "2. Fees",
    feePercent != null
      ? `The fee is ${feePercent}% of the candidate's first-year base salary, payable when the candidate starts.`
      : "The fee is a percentage of the candidate's first-year base salary, as agreed for each role, payable when the candidate starts.",
    "",
    "3. Payment",
    paymentTermsDays != null ? `Invoices are payable within ${paymentTermsDays} days of the invoice date.` : "Invoices are payable within 30 days of the invoice date.",
    "",
    "4. Rebate",
    rebateDays != null && rebateDays > 0
      ? `If the candidate leaves within ${rebateDays} days of starting, the Agency will find a replacement or refund part of the fee, provided the fee was paid on time.`
      : "Any rebate or replacement period is as agreed in writing for each role.",
    "",
    "5. Confidentiality",
    "Candidate details are confidential and may only be used to consider the candidate for the role. Passing them to a third party who then engages the candidate makes the Client liable for the fee.",
    "",
    "6. Data protection",
    "Both parties will handle candidates' personal data in line with UK GDPR and the Data Protection Act 2018.",
  ];
  if (termsNotes) lines.push("", "7. Additional terms", termsNotes);
  return lines.join("\n");
}

export function offerLetterText({ agencyName, candidateName, jobTitle, clientName, salary, currency = "GBP", startDate, kind = "permanent", payRate, chargeRate, rateUnit, endDate }) {
  const who = candidateName || "Candidate";
  const role = jobTitle || "the role";
  const employer = clientName || "our client";
  if (kind === "contract") {
    return [
      `Dear ${who},`,
      "",
      `We're pleased to confirm your assignment as ${role} with ${employer}.`,
      "",
      startDate ? `Start date: ${day(startDate)}` : null,
      endDate ? `Expected end date: ${day(endDate)}` : null,
      payRate != null ? `Pay rate: ${money(payRate, currency)} per ${rateUnit || "hour"}` : null,
      "",
      "Please sign below to confirm you accept the assignment on these terms. Timesheets are submitted weekly and paid once approved.",
      "",
      `${agencyName || "The agency"}`,
    ]
      .filter((l) => l !== null)
      .join("\n");
  }
  return [
    `Dear ${who},`,
    "",
    `Congratulations - ${employer} would like to offer you the position of ${role}.`,
    "",
    salary != null ? `Salary: ${money(salary, currency)} per year` : null,
    startDate ? `Start date: ${day(startDate)}` : null,
    "",
    "Your contract of employment will come from your new employer. Please sign below to confirm you accept this offer so we can let them know.",
    "",
    `${agencyName || "The agency"}`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}
