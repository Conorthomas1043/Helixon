import { useEffect } from "react";
import posthog from "@/lib/posthog";

// One way to send product events. PostHog only starts once the visitor has
// accepted optional cookies (instrumentation-client.js), so every call is a
// silent no-op until then. Event names are snake_case "object_action".
export function track(event, properties) {
  if (posthog.__loaded) posthog.capture(event, properties);
}

// Ties events to the signed-in recruiter and to their agency. The agency
// is the paying customer, so activation, retention and seat usage are
// read per agency (PostHog group analytics), not per person.
//
// Identify used to run once, on mount, and only if PostHog was already
// running - so anyone who accepted cookies on that page was never
// identified for the rest of the session. It now also runs when consent
// arrives (the init listener in instrumentation-client.js runs first).
export function useAnalyticsIdentity({ userId, email, name, agencyId, agencyName, plan }) {
  useEffect(() => {
    if (!userId) return undefined;
    function identify() {
      if (!posthog.__loaded) return;
      const props = {};
      if (email) props.email = email;
      if (name) props.name = name;
      posthog.identify(userId, props);
      if (agencyId) {
        posthog.group("agency", agencyId, { ...(agencyName ? { name: agencyName } : {}), ...(plan ? { plan } : {}) });
      }
    }
    identify();
    window.addEventListener("helixon-cookie-consent", identify);
    return () => window.removeEventListener("helixon-cookie-consent", identify);
  }, [userId, email, name, agencyId, agencyName, plan]);
}
