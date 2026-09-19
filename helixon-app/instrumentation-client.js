// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

// ── Cookie consent ──────────────────────────────────────────────────────────
// The banner (components/CookieConsentBanner.jsx) stores the visitor's choice in
// the helixon_cookie_consent cookie: "all" or "essential-only" (absent = they
// haven't chosen yet). Analytics and session recording are optional, so they
// only run once the visitor has chosen "all". Before this, PostHog and Sentry
// Replay started on every page load whatever was clicked - "Essential only"
// changed nothing, which contradicted the cookie policy.
const CONSENT_COOKIE = "helixon_cookie_consent";

function optionalTrackingAllowed() {
  if (typeof document === "undefined") return false;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return match?.split("=")[1] === "all";
}

const consented = optionalTrackingAllowed();

const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (!posthogToken) {
  if (process.env.NODE_ENV === "development") {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured"
    );
  }
} else if (!posthogHost) {
  if (process.env.NODE_ENV === "development") {
    throw new Error(
      "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured"
    );
  }
} else if (typeof window !== "undefined") {
  // PostHog is not even started until the visitor has opted in: initialising it
  // (even opted out) still fetches feature flags and surveys from PostHog with a
  // throwaway identifier, which is more than "Essential only" should allow.
  // Code elsewhere already checks `posthog.__loaded` before using it, so leaving
  // it un-initialised is safe.
  let posthogStarted = false;

  const startPosthog = () => {
    if (posthogStarted) return;
    posthogStarted = true;
    posthog.init(posthogToken, {
      api_host: posthogHost,
      defaults: "2026-01-30",
      capture_exceptions: true,
      debug: process.env.NODE_ENV === "development",
    });
  };

  if (consented) startPosthog();

  // React when the visitor answers the banner (or changes their mind).
  window.addEventListener("helixon-cookie-consent", () => {
    if (optionalTrackingAllowed()) {
      startPosthog();
      posthog.opt_in_capturing();
    } else if (posthogStarted) {
      posthog.opt_out_capturing();
      posthog.reset();
    }
  });
}

Sentry.init({
  dsn: "https://1fa4e4a3f6cc154682501e16738d3cfb@o4511588978130944.ingest.de.sentry.io/4511588993073232",

  // Session Replay records what people do on the page, so it's optional
  // tracking: only added once the visitor has consented (see the listener below
  // for when they consent after page load). Plain error reporting is unaffected.
  integrations: consented ? [Sentry.replayIntegration()] : [],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  // Only for visitors who opted in; everyone else's error reports carry no IP
  // address, cookies or user details.
  sendDefaultPii: consented,
});

if (typeof window !== "undefined" && !consented) {
  window.addEventListener("helixon-cookie-consent", () => {
    if (optionalTrackingAllowed() && !Sentry.getReplay?.()) {
      Sentry.addIntegration(Sentry.replayIntegration());
    }
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
