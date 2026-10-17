"use client";
import MarketingNav from "@/components/marketing/MarketingNav";
import LegalHeader, { LEGAL_WIDTH } from "@/components/marketing/LegalHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { useEffect, useState } from "react";
import { CONSENT_KEY } from "@/components/CookieConsentBanner";

// ═══════════════════════════════════════════════════════════════════════════
// Helixon - Cookie policy.
// Same legal-page shell as the DPA (nav/footer/type), but lighter weight -
// no sticky TOC needed at this length. Signature element: a cookie-category
// table that mirrors the actual categories set, not a generic prose wall.
// ═══════════════════════════════════════════════════════════════════════════

const COOKIE_CATEGORIES = [
  {
    name: "Strictly necessary",
    required: true,
    purpose: "Keep you signed in securely (set by Clerk, our sign-in provider) and remember your cookie choice.",
    examples: "__session, __client_uat, __clerk_db_jwt (Clerk); helixon_cookie_consent",
    duration: "Session / up to 1 year",
  },
  {
    name: "Functional (stored in your browser)",
    required: true,
    purpose:
      "Only set when you use the feature they support: job templates you save, candidates you viewed recently, your recent analyses (kept 30 days) and that you confirmed a lawful basis to screen CVs. Kept in your browser's local storage, never sent to anyone, and the candidate-related ones are cleared when you log out.",
    examples: "jobTemplates, analysisHistory, helixon:recently-viewed-candidates, analyseConsent",
    duration: "Until you log out or clear them (analyses: 30 days)",
  },
  {
    name: "Analytics",
    required: false,
    purpose:
      "Understand how the product is used, in aggregate, so we can improve it, and - for a sample of visits - record a replay of the page with all text and inputs masked, to help us fix errors. No data is sold or shared for advertising.",
    examples: "ph_*_posthog (PostHog, EU-hosted); Sentry session replay (EU-hosted, no cookie)",
    duration: "1 year",
  },
];

// These switches are the real consent control, not an illustration: they read
// and write the same cookie as the banner. Consent is a single choice
// ("all" or "essential-only"), so Preferences and Analytics move together, and
// both start OFF until someone opts in (no cookie yet = off).
function readConsent() {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_KEY}=`));
  return match ? match.split("=")[1] : null;
}

function ToggleRow({ category }) {
  const [optionalOn, setOptionalOn] = useState(false);

  useEffect(() => {
    const sync = () => setOptionalOn(readConsent() === "all");
    sync();
    window.addEventListener("helixon-cookie-consent", sync);
    return () => window.removeEventListener("helixon-cookie-consent", sync);
  }, []);

  const on = category.required ? true : optionalOn;

  function toggle() {
    const value = optionalOn ? "essential-only" : "all";
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${CONSENT_KEY}=${value}; expires=${expires}; path=/; SameSite=Lax`;
    window.dispatchEvent(new Event("helixon-cookie-consent"));
  }

  return (
    <div className="rounded-xl border p-5 border-[var(--border)] bg-[var(--bg)]">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h3 className="text-13 font-semibold text-[var(--ink)]">{category.name}</h3>
          {category.required && (
            <span className="inline-block mt-1 text-11 font-semibold px-2 py-0.5 rounded-full bg-[var(--mint)] text-[var(--forest)]">
              Always on
            </span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`${category.name} cookies${category.required ? " (always on)" : ""}`}
          disabled={category.required}
          onClick={toggle}
          className="shrink-0 w-10 h-6 rounded-full relative transition-colors"
          style={{ background: on ? "var(--forest)" : "var(--border)", opacity: category.required ? 0.6 : 1, cursor: category.required ? "not-allowed" : "pointer" }}
        >
          <span
            className="absolute top-0.5 w-5 h-5 rounded-full bg-[var(--bg)] transition-transform"
            style={{ transform: on ? "translateX(18px)" : "translateX(2px)" }}
          />
        </button>
      </div>
      <p className="text-12 leading-relaxed mb-3 text-[var(--ink-soft)]">{category.purpose}</p>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-11 text-[var(--ink-faint)]">
        <span><strong className="text-[var(--ink-soft)]">Examples:</strong> {category.examples}</span>
        <span><strong className="text-[var(--ink-soft)]">Duration:</strong> {category.duration}</span>
      </div>
    </div>
  );
}

export default function CookiePolicyPage() {

  return (
    <div className="min-h-screen bg-[var(--mist)]">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MarketingNav active="cookies" />
      <main id="main-content">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <LegalHeader
        title="Cookie Policy"
        intro="This explains what cookies Helixon sets, why, and how to control them. It applies to helixon.co.uk and the Helixon app."
        meta={<span><strong className="text-[var(--ink)]">Effective:</strong> 1 August 2026 · last updated 29 September 2026</span>}
      />

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className={`${LEGAL_WIDTH.narrow} mx-auto px-6 py-14`}>

        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-3 text-[var(--ink)] font-display">
            What are cookies?
          </h2>
          <p className="text-13 leading-relaxed text-[var(--ink-soft)]">
            Cookies are small text files stored on your device when you visit a website. We use them, and similar
            technologies like local storage, to keep you signed in, remember your preferences, and understand how
            the product is used so we can improve it.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-4 text-[var(--ink)] font-display">
            Cookie categories
          </h2>
          <div className="space-y-3">
            {COOKIE_CATEGORIES.map((c) => (
              <ToggleRow key={c.name} category={c} />
            ))}
          </div>
          <p className="text-xs mt-3 text-[var(--ink-soft)]">
            These switches are your live cookie settings. Preferences and Analytics are off until you turn them on, and
            they switch together because you give (or withdraw) consent for optional cookies as one choice. Change it at
            any time here.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-3 text-[var(--ink)] font-display">
            Third-party cookies
          </h2>
          <p className="text-13 leading-relaxed text-[var(--ink-soft)]">
            We do not use third-party advertising cookies, and we do not allow ad networks to track visitors across
            Helixon. Our analytics provider is EU-hosted and configured not to sell or share data with third
            parties.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold tracking-tight mb-3 text-[var(--ink)] font-display">
            Managing cookies in your browser
          </h2>
          <p className="text-13 leading-relaxed mb-3 text-[var(--ink-soft)]">
            Most browsers let you block or delete cookies through their settings. Note that blocking strictly
            necessary cookies will prevent you from staying signed in to Helixon.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-13 text-[var(--ink-soft)]">
            <li>Chrome: Settings → Privacy and security → Cookies</li>
            <li>Safari: Settings → Privacy → Manage Website Data</li>
            <li>Firefox: Settings → Privacy & Security → Cookies and Site Data</li>
          </ul>
        </section>

        <section className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight mb-3 text-[var(--ink)] font-display">
            Changes to this policy
          </h2>
          <p className="text-13 leading-relaxed text-[var(--ink-soft)]">
            We&apos;ll update this page if the cookies we use change, and update the effective date above. For material
            changes, we&apos;ll show a notice on your next visit.
          </p>
        </section>

        <div className="pt-6 mt-6 border-t text-12 border-[var(--border)] text-[var(--ink-faint)]">
          Questions about cookies? Contact <a href="mailto:hello@helixon.co.uk" className="font-semibold text-[var(--forest)]">hello@helixon.co.uk</a>.
        </div>
      </div>

      </main>
      <MarketingFooter />
    </div>
  );
}