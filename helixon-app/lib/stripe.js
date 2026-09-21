import Stripe from "stripe";

// Single Stripe client, pinned to one API version - this used to be
// instantiated separately in api/checkout, api/billing/portal,
// api/webhooks/stripe and checkout/success/page.jsx, and had drifted to two
// different pinned versions ("2025-03-31.basil" in the first two,
// "2024-06-20" in the other two) with no reason for the split. A version
// mismatch between the code that creates a Checkout Session and the code
// that later reads it back (or the webhook that reacts to it) risks reading
// a field under a shape it wasn't written to expect. One client, one
// version, bump it here when you deliberately want to move forward.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-03-31.basil",
});
