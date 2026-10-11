// GET /api/billing - the Billing page's summary of the agency's plan and the
// signed-in member's Stripe subscription. Built by lib/billing/summary.js and
// read through getBillingSummary() in lib/api-client/billing.js.

import { z } from "zod";
import { nullableNumber, nullableString, timestamp } from "./common";

export const SubscriptionSummarySchema = z.strictObject({
  plan: nullableString,
  status: nullableString,
  updatedAt: timestamp.nullable(),
  // Only the paying owner has a Stripe customer, so only they get the
  // "Manage billing" button.
  hasStripeCustomer: z.boolean(),
});

export const BillingSummarySchema = z.strictObject({
  ok: z.literal(true),
  agencyName: nullableString,
  // The agency's current plan, whichever member is asking.
  plan: nullableString,
  // Absent for a member with no agency yet.
  analysesUsed: nullableNumber.optional(),
  subscription: SubscriptionSummarySchema.nullable(),
});

/** @typedef {z.infer<typeof SubscriptionSummarySchema>} SubscriptionSummary */
/** @typedef {z.infer<typeof BillingSummarySchema>} BillingSummary */
