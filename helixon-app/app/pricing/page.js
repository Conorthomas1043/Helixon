"use client";

import { useState } from "react";
import posthog from "posthog-js";

const PLANS = [
  {
    id: "individual",
    name: "Individual",
    price: 249,
    description:
      "For recruiters screening candidates independently.",
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
    description:
      "For agencies running recruitment across a team.",
    features: [
      "Everything in Individual",
      "Team access",
      "Shared jobs and candidates",
      "Agency workflows",
      "Team analytics",
    ],
  },
];

function Check() {
  return (
    <span
      aria-hidden="true"
      style={{
        color: "var(--forest)",
        fontWeight: 800,
      }}
    >
      ✓
    </span>
  );
}

export default function PricingPage() {
  const [loadingPlan, setLoadingPlan] =
    useState(null);

  const [error, setError] =
    useState("");

  async function choosePlan(plan) {
    setLoadingPlan(plan);
    setError("");

    try {
      const response = await fetch(
        "/api/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            plan,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href =
            `/login?next=/pricing`;
          return;
        }

        throw new Error(
          data.error ||
            "Unable to start checkout."
        );
      }

      if (!data.redirectTo) {
        throw new Error(
          "Checkout URL was not returned."
        );
      }

      if (posthog.__loaded) {
        posthog.capture("checkout_started", { plan });
      }

      window.location.href =
        data.redirectTo;
    } catch (err) {
      setError(
        err?.message ||
          "Unable to start checkout."
      );
      setLoadingPlan(null);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--mist)",
        color: "#13201b",
      }}
    >
      <nav
        style={{
          height: 58,
          background: "#fff",
          borderBottom:
            "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent:
            "space-between",
          padding: "0 24px",
        }}
      >
        <a
          href="/"
          style={{
            textDecoration: "none",
            fontWeight: 800,
            color: "#13201b",
          }}
        >
          Helixon
        </a>

        <div
          style={{
            display: "flex",
            gap: 18,
            alignItems: "center",
            fontSize: 13,
          }}
        >
          <a
            href="/"
            style={{
              color: "#5a7a6a",
              textDecoration: "none",
            }}
          >
            Home
          </a>

          <a
            href="/login"
            style={{
              color: "#5a7a6a",
              textDecoration: "none",
            }}
          >
            Login
          </a>
        </div>
      </nav>

      <section
        style={{
          maxWidth: 1050,
          margin: "0 auto",
          padding:
            "72px 24px 80px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 46,
          }}
        >
          <div
            style={{
              color: "#8aaa9a",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing:
                "0.12em",
              textTransform:
                "uppercase",
            }}
          >
            Pricing
          </div>

          <h1
            style={{
              fontSize:
                "clamp(36px,5vw,58px)",
              lineHeight: 1.05,
              margin:
                "12px 0 16px",
            }}
          >
            Screening without
            <br />
            the bottleneck
          </h1>

          <p
            style={{
              maxWidth: 620,
              margin:
                "0 auto",
              color: "#5a7a6a",
              lineHeight: 1.7,
              fontSize: 15,
            }}
          >
            No three-analysis trial.
            No fake limits. Choose a
            Helixon subscription and
            screen without a usage cap.
          </p>
        </div>

        {error && (
          <div
            style={{
              maxWidth: 700,
              margin:
                "0 auto 20px",
              padding: 14,
              borderRadius: 10,
              border:
                "1px solid #fecaca",
              background:
                "#fff7f7",
              color: "#991b1b",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit,minmax(280px,1fr))",
            gap: 18,
            maxWidth: 780,
            margin: "0 auto",
          }}
        >
          {PLANS.map((plan) => {
            const loading =
              loadingPlan ===
              plan.id;

            return (
              <article
                key={plan.id}
                style={{
                  background:
                    plan.id ===
                    "agency"
                      ? "var(--forest)"
                      : "#fff",
                  color:
                    plan.id ===
                    "agency"
                      ? "#fff"
                      : "#13201b",
                  border:
                    plan.id ===
                    "agency"
                      ? "1px solid var(--forest)"
                      : "1px solid var(--border)",
                  borderRadius: 18,
                  padding: 28,
                  boxShadow:
                    plan.id ===
                    "agency"
                      ? "0 18px 40px rgba(11,110,79,.16)"
                      : "none",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform:
                      "uppercase",
                    letterSpacing:
                      "0.1em",
                    fontWeight: 800,
                    opacity: 0.72,
                  }}
                >
                  {plan.name}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "baseline",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 40,
                      fontWeight: 800,
                    }}
                  >
                    £{plan.price}
                  </span>

                  <span
                    style={{
                      fontSize: 13,
                      opacity: 0.65,
                    }}
                  >
                    / month
                  </span>
                </div>

                <p
                  style={{
                    marginTop: 12,
                    lineHeight: 1.6,
                    fontSize: 13,
                    opacity: 0.78,
                  }}
                >
                  {plan.description}
                </p>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    choosePlan(
                      plan.id
                    )
                  }
                  style={{
                    width: "100%",
                    marginTop: 22,
                    border: 0,
                    borderRadius: 10,
                    padding:
                      "13px 16px",
                    cursor: loading
                      ? "wait"
                      : "pointer",
                    background:
                      plan.id ===
                      "agency"
                        ? "#fff"
                        : "var(--forest)",
                    color:
                      plan.id ===
                      "agency"
                        ? "var(--forest)"
                        : "#fff",
                    fontWeight: 800,
                  }}
                >
                  {loading
                    ? "Opening checkout..."
                    : `Choose ${plan.name}`}
                </button>

                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin:
                      "24px 0 0",
                    display: "grid",
                    gap: 11,
                  }}
                >
                  {plan.features.map(
                    (feature) => (
                      <li
                        key={
                          feature
                        }
                        style={{
                          display:
                            "flex",
                          gap: 9,
                          fontSize: 13,
                          alignItems:
                            "flex-start",
                        }}
                      >
                        <Check />
                        <span>
                          {feature}
                        </span>
                      </li>
                    )
                  )}
                </ul>
              </article>
            );
          })}
        </div>

        <p
          style={{
            margin:
              "28px auto 0",
            maxWidth: 700,
            textAlign: "center",
            fontSize: 12,
            color: "#8aaa9a",
            lineHeight: 1.6,
          }}
        >
          Billing is handled securely
          by Stripe. You must be signed
          in before starting checkout.
        </p>
      </section>
    </main>
  );
}