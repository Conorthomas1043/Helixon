// Single source of truth for internal plan id <-> Stripe Price id.
// api/checkout uses PRICE_IDS to start a Checkout Session for a plan the
// user picked; the Stripe webhook uses planForPriceId (the reverse lookup)
// to figure out which plan a subscription is actually on *after* Stripe
// tells us it changed (upgrade/downgrade via the self-service Billing
// Portal, or a Dashboard-side change) - see app/api/webhooks/stripe.
// Keeping both directions in one file means adding/renaming a plan can't
// leave one side out of sync with the other.
export const PRICE_IDS = {
  individual: process.env.STRIPE_PRICE_INDIVIDUAL, // £249/mo - matches the "Individual" product in Stripe
  agency:     process.env.STRIPE_PRICE_AGENCY,      // £349/mo - matches the "Agency" product in Stripe (was "team")
};

export function planForPriceId(priceId) {
  if (!priceId) return null;
  const match = Object.entries(PRICE_IDS).find(([, id]) => id === priceId);
  return match ? match[0] : null;
}

// Display names for plan ids. "solo" is a legacy default written by
// createProfileAndAgency when no plan was passed through (pre-fix
// complete-signup calls, or an agency created without checkout) - kept
// here rather than dropped so old rows still render a real label instead
// of the raw id.
export const PLAN_LABELS = {
  individual: "Individual",
  agency: "Agency",
  solo: "Individual",
};

export function planLabel(planId) {
  return PLAN_LABELS[planId] || planId || null;
}
