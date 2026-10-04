import { supabase } from "@/lib/supabase";

// Product events that happen outside a browser - billing changes from the
// Stripe webhook - sent to PostHog's capture API. Without these the funnel
// stopped at checkout_started: nobody could see who actually paid, whose
// card failed or who cancelled.
//
// Recorded against the agency (the paying customer) only: the distinct id
// is the agency, no person profile is created and nothing personal is sent,
// so it doesn't depend on any one visitor's cookie choice. Best-effort and
// never throws; a slow PostHog can't hold up a webhook for more than 3s.
export async function captureAgencyEvent(event, agencyId, properties = {}) {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host || !agencyId) return;
  try {
    await fetch(`${host.replace(/\/+$/, "")}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: token,
        event,
        distinct_id: `agency_${agencyId}`,
        timestamp: new Date().toISOString(),
        properties: { ...properties, $groups: { agency: agencyId }, $process_person_profile: false, source: "server" },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    console.error("[server-analytics] Capture failed:", err?.message);
  }
}

// The agency a subscriptions row belongs to (rows are keyed by profile).
export async function agencyIdForProfile(profileId) {
  if (!profileId) return null;
  const { data } = await supabase.from("profiles").select("agency_id").eq("id", profileId).maybeSingle();
  return data?.agency_id || null;
}

// Which billing events a customer.subscription.updated/deleted represents,
// from Stripe's previous_attributes. Pure, so it's unit-tested.
export function billingEventsFor(eventType, sub, previous = {}) {
  const status = sub?.status;
  if (eventType === "customer.subscription.deleted") return [{ event: "subscription_cancelled", properties: { status } }];
  const events = [];
  const before = previous?.status;
  if (before && before !== status) {
    if (status === "past_due") events.push({ event: "payment_failed", properties: { from: before } });
    else if (before === "past_due" && status === "active") events.push({ event: "payment_recovered", properties: {} });
    else events.push({ event: "subscription_status_changed", properties: { from: before, to: status } });
  }
  if (previous?.cancel_at_period_end === false && sub?.cancel_at_period_end === true) {
    events.push({ event: "subscription_cancel_scheduled", properties: {} });
  }
  if (previous?.items) events.push({ event: "plan_changed", properties: {} });
  return events;
}
