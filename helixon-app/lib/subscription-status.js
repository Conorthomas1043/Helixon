// lib/subscription-status.js
// Whether a subscriptions row actually grants access right now. Paid
// (Stripe) subscriptions follow their status. Demo access granted from
// Admin > Users has no Stripe subscription and may have an end date
// (demo_expires_at); once that's passed it no longer counts, even before
// the daily admin cron marks the row cancelled.

export const ACCESS_STATUSES = new Set(["active"]);

export function isDemoSubscription(sub) {
  return Boolean(sub) && !sub.stripe_subscription_id;
}

export function demoExpired(sub, now = Date.now()) {
  return isDemoSubscription(sub) && Boolean(sub.demo_expires_at) && Date.parse(sub.demo_expires_at) <= now;
}

export function grantsAccess(sub, now = Date.now()) {
  return Boolean(sub) && ACCESS_STATUSES.has(sub.status) && !demoExpired(sub, now);
}
