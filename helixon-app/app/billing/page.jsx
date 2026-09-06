"use client";

import { useEffect, useState } from "react";
import DashboardNav from "@/components/DashboardNav";
import { PageCard, Button, InlineAlert } from "@/components/account/ui";
import { apiRequest, COLORS, GENERIC_ERROR } from "@/lib/account";

const PLAN_LABELS = {
  individual: "Individual",
  agency: "Agency",
};

const STATUS_LABELS = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past due",
  canceled: "Cancelled",
};

// Previously entirely missing - DashboardNav and the account-menu dropdown
// both already linked to /billing, but no page existed here at all (404).
export default function BillingPage() {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/billing")
      .then((data) => { if (!cancelled) setState({ loading: false, error: "", data }); })
      .catch((err) => { if (!cancelled) setState({ loading: false, error: err.message || GENERIC_ERROR, data: null }); });
    return () => { cancelled = true; };
  }, []);

  async function openPortal() {
    if (portalLoading) return;
    setPortalLoading(true);
    setPortalError("");
    try {
      const data = await apiRequest("/api/billing/portal", { method: "POST" });
      window.location.href = data.redirectTo;
    } catch (err) {
      setPortalError(err.message || GENERIC_ERROR);
      setPortalLoading(false);
    }
  }

  const plan = state.data?.plan;
  const planLabel = PLAN_LABELS[plan] || (plan ? plan : null);
  const status = state.data?.subscription?.status;
  const statusLabel = STATUS_LABELS[status] || status;
  const hasSubscription = Boolean(state.data?.subscription?.hasStripeCustomer);

  return (
    <main className="min-h-screen scroll-smooth" style={{ background: "var(--mist)" }}>
      <DashboardNav />

      <section className="max-w-[880px] mx-auto px-6 pt-14 pb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Billing
        </h1>
        <p className="text-sm mt-3 max-w-md" style={{ color: "#5a7a6a" }}>
          Your plan and subscription details.
        </p>
      </section>

      <div className="max-w-[880px] mx-auto px-6 pb-20">
        <PageCard title="Current plan" description="Manage your subscription, payment method, and invoices.">
          {state.loading ? (
            <p className="text-sm" style={{ color: COLORS.muted }}>Loading…</p>
          ) : state.error ? (
            <InlineAlert message={state.error} />
          ) : !plan ? (
            <>
              <p className="text-sm mb-4" style={{ color: COLORS.muted }}>
                You're not on a paid plan yet.
              </p>
              <Button onClick={() => { window.location.href = "/#pricing"; }}>View plans</Button>
            </>
          ) : (
            <div className="space-y-4 max-w-sm">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: COLORS.muted }}>Plan</span>
                <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{planLabel}</span>
              </div>
              {statusLabel && (
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: COLORS.muted }}>Status</span>
                  <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{statusLabel}</span>
                </div>
              )}
              {state.data?.analysesUsed != null && (
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: COLORS.muted }}>Analyses used</span>
                  <span className="text-sm font-semibold" style={{ color: COLORS.ink }}>{state.data.analysesUsed}</span>
                </div>
              )}

              {portalError && <InlineAlert message={portalError} />}

              {hasSubscription ? (
                <Button onClick={openPortal} loading={portalLoading}>
                  {portalLoading ? "Opening…" : "Manage billing"}
                </Button>
              ) : (
                <p className="text-xs" style={{ color: COLORS.faint }}>
                  Billing management isn't available yet for this plan.
                </p>
              )}
            </div>
          )}
        </PageCard>
      </div>
    </main>
  );
}
