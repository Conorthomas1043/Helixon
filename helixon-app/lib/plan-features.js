// What each paid plan includes, as shown to buyers. Shared by the homepage
// pricing section and /pricing so the two can't promise different things
// (they had drifted: the homepage listed "Priority support", "Shared
// templates" and "Dedicated onboarding", which /pricing never mentioned).
// Kept apart from lib/plans.js because that module reads server-only env
// vars and this one is imported by client components.
// Agency plan seat cap (members plus pending invites). The single source:
// lib/clerk-org.js enforces it, and the plan copy below states it, so
// buyers can see what "team" means before paying.
export const AGENCY_SEATS = 5;

// Plan prices in pounds per month, for copy that does arithmetic with them
// (the per-seat figure, the fee example). Stripe holds the real prices.
export const PLAN_PRICES = { individual: 249, agency: 349 };

// Who each plan is for, so a buyer can pick themselves out instead of
// comparing feature lists line by line (choice overload: Iyengar & Lepper,
// 2000).
export const PLAN_FOR = {
  individual: "For one recruiter running their own desk.",
  agency: `For a team of 2 to ${AGENCY_SEATS} recruiters working the same jobs.`,
};

// Listed as what a recruiter gets done, not as feature names. The old
// Individual list ("Candidate history", "AI email drafting") left out the
// pipeline, clients, shortlists, placements and invoicing that both plans
// include, so the price was judged against a fraction of the product
// (perceived value: Zeithaml, 1988). Agency-only items are the ones the
// app tags "Agency plan" (components/DashboardNav.jsx).
export const PLAN_FEATURES = {
  individual: [
    "Unlimited CV screening, with the reasoning behind every score",
    "Bulk upload: up to 50 CVs against one job",
    "Pipeline, jobs and clients in one place",
    "Client shortlists with one-tap feedback",
    "Interviews, placements and invoices",
    "Right-to-work and compliance checks",
    "Email templates and follow-up sequences",
  ],
  agency: [
    "Everything in Individual",
    `Up to ${AGENCY_SEATS} team members`,
    "Shared jobs, candidates and pipeline",
    "Targets and a team leaderboard",
    "See which teammates are online",
  ],
};

// Agency price per person with a full team: 349 / 5 = £69.80, shown as
// "under £70". Framing a team price per seat makes it comparable with what
// buyers already pay per user for other tools (Thaler, 1985: mental
// accounting).
export function agencyPerSeatNote() {
  const perSeat = PLAN_PRICES.agency / AGENCY_SEATS;
  return `Under £${Math.ceil(perSeat)} per recruiter with a team of ${AGENCY_SEATS}.`;
}

// An anchor against the money a placement brings in, with the arithmetic
// shown so it reads as an example rather than a claim. 15% is the low end
// of typical UK permanent-placement fees. Anchoring: Tversky & Kahneman,
// 1974.
const EXAMPLE_SALARY = 30000;
const EXAMPLE_FEE_RATE = 0.15;
export function placementFeeExample() {
  const fee = EXAMPLE_SALARY * EXAMPLE_FEE_RATE;
  const months = Math.floor(fee / PLAN_PRICES.individual);
  const money = (n) => `£${n.toLocaleString("en-GB")}`;
  return `For scale: one placement on a ${money(EXAMPLE_SALARY)} salary at a ${EXAMPLE_FEE_RATE * 100}% fee earns ${money(fee)}, enough to pay for Individual for ${months} months.`;
}
