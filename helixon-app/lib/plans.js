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
