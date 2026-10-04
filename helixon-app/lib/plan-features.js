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

export const PLAN_FEATURES = {
  individual: [
    "Unlimited candidate screening",
    "AI match scoring",
    "Red-flag detection",
    "Candidate history",
    "AI email drafting",
  ],
  agency: [
    "Everything in Individual",
    `Up to ${AGENCY_SEATS} team members`,
    "Shared jobs and candidates",
    "Agency workflows",
    "Team analytics",
  ],
};
