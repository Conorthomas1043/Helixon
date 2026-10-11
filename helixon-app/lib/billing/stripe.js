import "server-only";
import Stripe from "stripe";

// Single Stripe client, pinned to one API version, for everything that
// talks to Stripe. A version mismatch between the code that creates a
// Checkout Session and the code that later reads it back (or the webhook
// that reacts to it) risks reading a field under a shape it wasn't written
// to expect. Import this rather than creating another client, and bump the
// version here when you deliberately want to move forward.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-03-31.basil",
});
