"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const CONSENT_KEY = "helixon_cookie_consent";

export function useCookieBannerVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function check() {
      const hasConsent = document.cookie
        .split("; ")
        .some((c) => c.startsWith(`${CONSENT_KEY}=`));
      setVisible(!hasConsent);
    }
    check();
    window.addEventListener("helixon-cookie-consent", check);
    return () => window.removeEventListener("helixon-cookie-consent", check);
  }, []);

  return visible;
}

// Rendered from the root layout (app/layout.js) so it appears on whatever
// page a visitor actually lands on - not just "/". It used to be mounted
// only on the marketing homepage, so anyone entering through a deep link
// (an email, a bookmark, /pricing, /dashboard) was never shown it at all.
// PostHog/Sentry Replay (instrumentation-client.js) already fail safe -
// nothing optional starts until this cookie says "all" - so that gap was
// never a tracking-without-consent violation, just a real completeness one:
// most entry points never got a chance to opt in either way, and a
// regulator would reasonably expect the prompt on first visit regardless
// of entry page, not just the homepage.
const SUPPRESSED_PREFIXES = ["/admin", "/employee"];

export default function CookieConsentBanner({ embedded = false }) {
  const pathname = usePathname();
  const visible = useCookieBannerVisible();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      const t = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(t);
    }
    setMounted(false);
  }, [visible]);

  function setConsent(value) {
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${CONSENT_KEY}=${value}; expires=${expires}; path=/; SameSite=Lax`;
    window.dispatchEvent(new Event("helixon-cookie-consent"));
  }

  // Admin/employee consoles are internal staff tools with their own
  // separate auth model, not a public/customer-facing surface - a
  // consumer cookie-consent banner ("Essential cookies keep Helixon
  // running... for recruiters like you") doesn't fit there. An explicit
  // `embedded` placement (e.g. a "manage cookie preferences" control)
  // still renders regardless of path.
  if (!embedded && SUPPRESSED_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  if (!visible) return null;

  return (
    <div
      className={`${embedded ? "relative z-30 px-4 pt-4" : "fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:pb-6"} cookie-banner`}
      role="region"
      aria-label="Cookie consent"
      data-visible={mounted ? "true" : "false"}
    >
      <div
        className="max-w-[720px] mx-auto rounded-[16px] p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4"
        style={{
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 50px -20px rgba(11,26,20,0.35)",
        }}
      >
        <p className="text-xs leading-relaxed flex-1" style={{ color: "#5a7a6a" }}>
          Essential cookies keep Helixon running. Optional analytics help us improve the product for
          recruiters like you. EU-hosted - never used to train AI.{" "}
          <Link href="/cookie-policy" className="underline font-medium" style={{ color: "var(--forest)" }}>
            Cookie Policy
          </Link>
        </p>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setConsent("essential-only")}
            className="btn-outline flex-1 sm:flex-none text-xs font-semibold px-4 py-2.5 rounded-[10px] min-h-[44px] transition-colors"
            style={{ border: "1.5px solid var(--border)", color: "#13201b" }}
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => setConsent("all")}
            className="btn-forest flex-1 sm:flex-none text-xs font-semibold px-4 py-2.5 rounded-[10px] text-white min-h-[44px] transition-colors"
            style={{ background: "var(--forest)" }}
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
