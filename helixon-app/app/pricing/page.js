"use client";

import { useState } from "react";
import Link from "next/link";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { PLAN_FEATURES } from "@/lib/plan-features";
import { startCheckout } from "@/lib/start-checkout";

const PLANS = [
  {
    id: "individual",
    name: "Individual",
    price: 249,
    description: "For a recruiter screening candidates on their own desk.",
    features: PLAN_FEATURES.individual,
  },
  {
    id: "agency",
    name: "Agency",
    price: 349,
    description: "For agencies running recruitment across a team.",
    highlight: true,
    features: PLAN_FEATURES.agency,
  },
];

// The objections people raise at the point of paying, answered next to the
// buttons instead of on a separate FAQ page they'd have to leave for.
// Every answer matches the homepage FAQ and the checkout flow.
const PRICING_FAQS = [
  { q: "Is there a contract?", a: "No. Both plans are billed monthly. Cancel from your account and you keep access until the end of the billing period." },
  { q: "Is screening really unlimited?", a: "Yes. There's no monthly cap on analyses on either plan, so you never have to ration CVs." },
  { q: "Do I need an account first?", a: "No. Choose a plan, pay securely through Stripe, and you'll set up your account straight after." },
  { q: "Where is candidate data kept?", a: "In Switzerland, which the UK and EU recognise as adequate. It's encrypted and never used to train any model." },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState("");

  async function choosePlan(plan) {
    setLoadingPlan(plan);
    setError("");
    const result = await startCheckout(plan);
    if (!result.ok) {
      setError(result.error);
      setLoadingPlan(null);
      return;
    }
    window.location.assign(result.redirectTo);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--mist)" }}>
      <a href="#main-content" className="skip-link">Skip to content</a>
      <MarketingNav active="pricing" />
      <main id="main-content">

      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-20 lg:pt-20">
        <div className="text-center mb-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-faint)" }}>
            Pricing
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Screening without
            <br />
            the bottleneck
          </h1>
          <p className="text-[15px] leading-relaxed max-w-lg mx-auto" style={{ color: "var(--ink-soft)" }}>
            Unlimited screening on both plans. Monthly billing, no contract, cancel anytime.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="max-w-lg mx-auto mb-6 rounded-[10px] p-3.5 text-sm text-center"
            style={{ border: "1px solid #fecaca", background: "#fff7f7", color: "var(--score-low)" }}
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto items-stretch">
          {PLANS.map((plan) => {
            const loading = loadingPlan === plan.id;
            return (
              <article
                key={plan.id}
                className="rounded-[18px] p-7 relative flex flex-col"
                style={{
                  background: plan.highlight ? "var(--forest)" : "white",
                  border: plan.highlight ? "1px solid var(--forest)" : "1px solid var(--border)",
                  boxShadow: plan.highlight ? "0 18px 40px -14px rgba(11,110,79,0.35)" : "none",
                }}
              >
                {plan.highlight && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{ background: "var(--mint)", color: "var(--forest)", border: "1px solid var(--forest)" }}
                  >
                    Recommended for agencies
                  </span>
                )}

                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }}
                >
                  {plan.name}
                </p>

                <div className="flex items-baseline gap-1.5 mt-2.5">
                  <span className="text-4xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: plan.highlight ? "white" : "var(--ink)" }}>
                    £{plan.price}
                  </span>
                  <span className="text-xs" style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }}>
                    / month
                  </span>
                </div>

                <p className="text-xs leading-relaxed mt-3 sm:min-h-[2.5rem]" style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-soft)" }}>
                  {plan.description}
                </p>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => choosePlan(plan.id)}
                  aria-busy={loading}
                  className="w-full mt-6 rounded-[10px] py-3.5 text-sm font-semibold transition-colors min-h-[48px]"
                  style={{
                    background: plan.highlight ? "white" : "var(--forest)",
                    color: plan.highlight ? "var(--forest)" : "white",
                    opacity: loading ? 0.75 : 1,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  {loading ? "Opening checkout…" : `Choose ${plan.name}`}
                </button>
                <p className="text-[11px] text-center mt-2" style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-faint)" }}>
                  Billed monthly · Cancel anytime
                </p>

                <ul className="grid gap-2.5 mt-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm" style={{ color: plan.highlight ? "rgba(255,255,255,0.92)" : "var(--ink-soft)" }}>
                      <span aria-hidden="true" className="shrink-0 font-bold" style={{ color: plan.highlight ? "white" : "var(--forest)" }}>
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>

        <p className="mt-7 max-w-lg mx-auto text-center text-xs leading-relaxed" style={{ color: "var(--ink-faint)" }}>
          Payment is handled securely by Stripe. No account needed first: you&rsquo;ll set one up straight after checkout.
        </p>

        {/* A way forward for anyone not ready to pay today, instead of a dead end. */}
        <div className="max-w-2xl mx-auto mt-10 rounded-[16px] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: "white", border: "1px solid var(--border)" }}>
          <div>
            <p className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Not sure which plan fits?</p>
            <p className="text-sm leading-relaxed mt-1" style={{ color: "var(--ink-soft)" }}>
              Get a demo and see Helixon run on your own CVs first. No obligation.
            </p>
          </div>
          <Link
            href="/demo"
            className="inline-flex items-center justify-center shrink-0 text-sm font-semibold px-5 rounded-[10px] min-h-[44px] w-full sm:w-auto transition-colors hover:bg-[var(--mint)]"
            style={{ border: "1.5px solid var(--border)", color: "var(--ink)" }}
          >
            Get a demo
          </Link>
        </div>

        <div className="max-w-2xl mx-auto mt-14">
          <h2 className="text-lg font-semibold tracking-tight mb-5 text-center" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Before you choose
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            {PRICING_FAQS.map((f) => (
              <div key={f.q}>
                <dt className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>{f.q}</dt>
                <dd className="text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      </main>
      <MarketingFooter />
    </div>
  );
}
