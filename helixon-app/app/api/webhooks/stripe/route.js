import { NextResponse, after } from "next/server";
import { supabase as supabaseAdmin } from "@/lib/supabase";
import { stripe } from "@/lib/stripe";
import { planForPriceId } from "@/lib/plans";
import { agencyIdForProfile, billingEventsFor, captureAgencyEvent } from "@/lib/server-analytics";
import { reportError } from "@/lib/report-error";

// Stripe needs the RAW request body (unparsed) to verify the webhook
// signature - this is the "raw request body access" caveat that makes
// webhook routes runtime-sensitive. On Vercel's Node runtime this just
// works via request.text(); it's the thing that's fiddly on edge/Workers
// runtimes, which is part of why Vercel was the right call for this stack.
export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    reportError("[stripe-webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      // Step 4 from the Stripe guide - "Listen for checkout.session.completed"
      case "checkout.session.completed": {
        const session = event.data.object;
        const userId = session.client_reference_id || session.metadata?.userId;
        const plan = session.metadata?.plan;

        if (!userId) {
          reportError("[stripe-webhook] checkout.session.completed with no userId - cannot fulfill.");
          break;
        }

        const { error } = await supabaseAdmin
          .from("subscriptions")
          .upsert({
            user_id: userId,
            plan,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            status: "active",
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id" });

        if (error) reportError("[stripe-webhook] Failed to upsert subscription:", error.message);
        after(async () => captureAgencyEvent("subscription_started", await agencyIdForProfile(userId), { plan: plan || null }));
        break;
      }

      // Keep entitlement in sync if the subscription is later cancelled
      // or a renewal payment fails - otherwise a churned customer keeps
      // "Unlimited analyses" forever. Also keep `plan` in sync: this is
      // also how a self-service upgrade/downgrade via the Stripe Billing
      // Portal arrives (Stripe doesn't send a separate "plan changed"
      // event - it's the same customer.subscription.updated with a new
      // price on the subscription item). Previously this only wrote
      // `status`, so an upgrade would charge the new price correctly but
      // the app kept showing the plan the customer originally signed up
      // for, everywhere that reads subscriptions.plan.
      case "customer.subscription.deleted":
      case "customer.subscription.updated": {
        const sub = event.data.object;
        const priceId = sub.items?.data?.[0]?.price?.id || null;
        const plan = planForPriceId(priceId);

        const update = { status: sub.status, updated_at: new Date().toISOString() };
        if (plan) update.plan = plan;

        const { data: rows, error } = await supabaseAdmin
          .from("subscriptions")
          .update(update)
          .eq("stripe_subscription_id", sub.id)
          .select("user_id, plan");

        if (error) reportError("[stripe-webhook] Failed to update subscription status:", error.message);

        const billingEvents = billingEventsFor(event.type, sub, event.data.previous_attributes);
        const row = rows?.[0];
        if (billingEvents.length && row) {
          after(async () => {
            const agencyId = await agencyIdForProfile(row.user_id);
            for (const e of billingEvents) await captureAgencyEvent(e.event, agencyId, { ...e.properties, plan: row.plan || plan || null });
          });
        }
        break;
      }

      default:
        // Unhandled event types are fine to ignore - Stripe sends many
        // more than any single app needs to act on.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    reportError("[stripe-webhook] Handler error:", err);
    // Return 500 so Stripe retries - don't swallow errors as a 200, or a
    // failed fulfillment silently never gets fixed.
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}