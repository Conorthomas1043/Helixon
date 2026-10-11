// The body of GET /api/billing (contract: lib/contracts/billing.js), from
// the rows the route reads. Kept apart from the route so the shape is
// type-checked against the contract (tsconfig.strict.json).

/** @typedef {import("@/lib/contracts/billing").BillingSummary} BillingSummary */

/**
 * @param {{
 *   agency: { name?: string | null, plan_name?: string | null, analyses_used?: number | null, settings?: { plan?: string, analyses_used?: number } | null } | null,
 *   subscription: { plan?: string | null, status?: string | null, updated_at?: string | null, stripe_customer_id?: string | null } | null,
 *   agencyPlan: string | null,
 * }} rows `agencyPlan` is getAgencyPlan()'s answer (lib/plan.js)
 * @returns {BillingSummary}
 */
export function billingSummary({ agency, subscription, agencyPlan }) {
  return {
    ok: true,
    agencyName: agency?.name || null,
    // The plan comes from getAgencyPlan, not this member's own subscription
    // row: an invited teammate has none, and agencies.plan_name goes stale
    // when the owner changes plan in the Stripe portal.
    plan: agencyPlan || agency?.plan_name || agency?.settings?.plan || null,
    analysesUsed: agency?.analyses_used ?? agency?.settings?.analyses_used ?? null,
    // This member's own subscription: only the paying owner has a Stripe
    // customer to manage.
    subscription: subscription
      ? {
          plan: subscription.plan ?? null,
          status: subscription.status ?? null,
          updatedAt: subscription.updated_at ?? null,
          hasStripeCustomer: Boolean(subscription.stripe_customer_id),
        }
      : null,
  };
}

/** @returns {BillingSummary} */
export function emptyBillingSummary() {
  return { ok: true, agencyName: null, plan: null, subscription: null };
}
