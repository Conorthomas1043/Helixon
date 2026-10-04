// lib/subscription-status.js
// Whether a subscriptions row actually grants access right now. Paid
// (Stripe) subscriptions follow their status. Demo access granted from
// Admin > Users has no Stripe subscription and may have an end date
// (demo_expires_at); once that's passed it no longer counts, even before
// the daily admin cron marks the row cancelled.

// past_due is a grace period: Stripe is still retrying a failed renewal, so
// the agency keeps working while it's fixed (the app shows a payment-failed
// banner meanwhile). Access stops once Stripe gives up and the status moves
// to unpaid or canceled. Before, one declined card locked the whole agency
// out on the spot and sent them to the pricing page to buy again.
export const ACCESS_STATUSES = new Set(["active", "past_due"]);

// Statuses where the customer needs to update their payment method.
export const PAYMENT_ISSUE_STATUSES = new Set(["past_due", "unpaid"]);

export function isDemoSubscription(sub) {
  return Boolean(sub) && !sub.stripe_subscription_id;
}

export function demoExpired(sub, now = Date.now()) {
  return isDemoSubscription(sub) && Boolean(sub.demo_expires_at) && Date.parse(sub.demo_expires_at) <= now;
}

export function grantsAccess(sub, now = Date.now()) {
  return Boolean(sub) && ACCESS_STATUSES.has(sub.status) && !demoExpired(sub, now);
}
