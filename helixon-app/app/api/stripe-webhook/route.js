import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// server-only supabase (NOT SSR client)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // 🔥 MUST be service role
);

export async function POST(req) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // -----------------------------
    // CHECKOUT COMPLETED
    // -----------------------------
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const userId = session.metadata.user_id;
      const plan = session.metadata.plan;

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          status: "active",
          plan: plan,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "stripe_subscription_id",
        }
      );
    }

    // -----------------------------
    // SUBSCRIPTION UPDATED
    // -----------------------------
    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;

      await supabase.from("subscriptions").upsert(
        {
          stripe_subscription_id: sub.id,
          status: sub.status,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "stripe_subscription_id",
        }
      );
    }

    // -----------------------------
    // SUBSCRIPTION CANCELED
    // -----------------------------
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;

      await supabase
        .from("subscriptions")
        .update({
          status: "canceled",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", sub.id);
    }

    return Response.json({ received: true });
  } catch (err) {
    return new Response(`Server Error: ${err.message}`, { status: 500 });
  }
}