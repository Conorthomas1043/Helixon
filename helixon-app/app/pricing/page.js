"use client";

import { useState } from "react";
import posthog from "posthog-js";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

const PLANS = [
  {
    id: "individual",
    name: "Individual",
    price: 249,
    description: "For recruiters screening candidates independently.",
    features: [
      "Unlimited candidate screening",
      "AI match scoring",
      "Red-flag detection",
      "Candidate history",
      "AI email drafting",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    price: 349,
    description: "For agencies running recruitment across a team.",
    highlight: true,
    features: [
      "Everything in Individual",
      "Team access",
      "Shared jobs and candidates",
      "Agency workflows",
      "Team analytics",
    ],
  },
];

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState("");

  async function choosePlan(plan) {
    setLoadingPlan(plan);
    setError("");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = `/login?next=/pricing`;
          return;
        }
        throw new Error(data.error || "Unable to start checkout.");
      }

      if (!data.redirectTo) {
        throw new Error("Checkout URL was not returned.");
      }

      if (posthog.__loaded) {
        posthog.capture("checkout_started", { plan });
      }

      window.location.href = data.redirectTo;
    } catch (err) {
      setError(err?.message || "Unable to start checkout.");
      setLoadingPlan(null);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <MarketingNav active="pricing" />

      <section className="max-w-[1100px] mx-auto px-6 pt-16 pb-20 lg:pt-20">
        <div className="text-center mb-12">
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--ink-faint)" }}>
            Pricing
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.08] mb-5" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
            Screening without
            <br />
            the bottleneck
          </h1>
          <p className="text-sm leading-relaxed max-w-lg mx-auto" style={{ color: "var(--ink-soft)" }}>
            No three-analysis trial. No fake limits. Choose a Helixon subscription and screen without a usage cap.
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
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full whitespace-nowrap"
                    style={{ background: "var(--signal)", color: "var(--forest)" }}
                  >
                    Most popular
                  </span>
                )}

                <p
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: plan.highlight ? "rgba(255,255,255,0.75)" : "var(--ink-faint)" }}
                >
                  {plan.name}
                </p>

                <div className="flex items-baseline gap-1.5 mt-2.5">
                  <span className="text-4xl font-semibold" style={{ fontFamily: "var(--font-mono)", color: plan.highlight ? "white" : "var(--ink)" }}>
                    £{plan.price}
                  </span>
                  <span className="text-xs" style={{ color: plan.highlight ? "rgba(255,255,255,0.7)" : "var(--ink-faint)" }}>
                    / month
                  </span>
                </div>

                <p className="text-xs leading-relaxed mt-3" style={{ color: plan.highlight ? "rgba(255,255,255,0.85)" : "var(--ink-soft)" }}>
                  {plan.description}
                </p>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => choosePlan(plan.id)}
                  aria-busy={loading}
                  className="w-full mt-6 rounded-[10px] py-3.5 text-sm font-semibold transition-colors min-h-[48px]"
                  style={{
                    background: loading ? "var(--ink-mute)" : plan.highlight ? "white" : "var(--forest)",
                    color: plan.highlight ? "var(--forest)" : "white",
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  {loading ? "Opening checkout…" : `Choose ${plan.name}`}
                </button>

                <ul className="grid gap-2.5 mt-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs" style={{ color: plan.highlight ? "rgba(255,255,255,0.92)" : "var(--ink-soft)" }}>
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
          Billing is handled securely by Stripe. You must be signed in before starting checkout.
        </p>
      </section>

      <MarketingFooter />
    </main>
  );
}
