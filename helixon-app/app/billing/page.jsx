"use client";

import { track } from "@/lib/analytics";
import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { PageCard, Button, InlineAlert } from "@/components/account/ui";
import { apiRequest, COLORS, GENERIC_ERROR } from "@/lib/account";
import { PLAN_LABELS } from "@/lib/plans";
import { Dialog } from "@/components/dashboard/ui";
import { reportQuietly } from "@/lib/report-error";

// Asked before handing a cancellation over to Stripe. The answers feed
// /api/billing/cancel-intent; a couple of them have a better answer than
// cancelling, offered right there.
const CANCEL_REASONS = [
  ["price", "It costs too much"],
  ["not_using", "We're not using it enough"],
  ["missing_feature", "It's missing something we need"],
  ["scoring", "The scores don't match our judgement"],
  ["switching", "We're moving to another tool"],
  ["temporary", "We're pausing hiring for now"],
  ["other", "Something else"],
];

function CancelDialog({ plan, onClose, onContinue, busy }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [canTalk, setCanTalk] = useState(false);
  // The cheaper plan, or a conversation, can be the better outcome for
  // both sides - offered for the reasons they actually answer.
  const offer =
    reason === "price" && plan === "agency"
      ? { text: "Individual is £249 a month, for one recruiter, with the same unlimited screening. You can switch in the billing portal.", label: "Switch plan instead" }
      : reason === "scoring" || reason === "missing_feature" || reason === "not_using"
        ? { text: "Tell us what's not working. We read every message, and a quick call often sorts it out.", label: "Talk to us first", href: "/contact" }
        : null;
  return (
    <Dialog title="Before you cancel" onClose={onClose} busy={busy} width={480}>
      <fieldset>
        <legend className="text-sm mb-3" style={{ color: COLORS.muted }}>What&apos;s the main reason? It helps us improve Helixon.</legend>
        <div className="space-y-1.5">
          {CANCEL_REASONS.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2.5 text-sm min-h-[32px] cursor-pointer" style={{ color: COLORS.ink }}>
              <input type="radio" name="cancel-reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-[var(--forest)]" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block mt-4">
        <span className="block text-[14px] mb-1" style={{ color: COLORS.muted }}>Anything else? (optional)</span>
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} rows={3} className="w-full text-sm rounded-[10px] px-3 py-2" style={{ border: "1px solid var(--border)", color: COLORS.ink }} />
      </label>
      {/* Exit interviews: a yes here lets someone from Helixon ask what
          would have kept them. Opt-in, unticked by default. */}
      <label className="flex items-start gap-2.5 mt-4 text-[14px] cursor-pointer" style={{ color: COLORS.ink }}>
        <input type="checkbox" checked={canTalk} onChange={(e) => setCanTalk(e.target.checked)} className="mt-0.5 accent-[var(--forest)]" />
        I&apos;m happy for someone from Helixon to email me about a 15-minute chat about this.
      </label>
      {offer && (
        <div className="mt-4 rounded-[12px] p-4 text-sm" style={{ background: "var(--mint)", color: COLORS.ink }}>
          <p>{offer.text}</p>
          {offer.href ? (
            <a href={offer.href} className="inline-block mt-2 font-semibold underline" style={{ color: "var(--forest)" }}>{offer.label}</a>
          ) : (
            <button type="button" onClick={() => onContinue(reason, detail, "switch", canTalk)} disabled={busy} className="mt-2 font-semibold underline" style={{ color: "var(--forest)" }}>{offer.label}</button>
          )}
        </div>
      )}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Keep my subscription</Button>
        <Button onClick={() => onContinue(reason, detail, "cancel", canTalk)} loading={busy} disabled={!reason}>
          Continue to cancel
        </Button>
      </div>
    </Dialog>
  );
}

const STATUS_LABELS = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Payment failed - retrying",
  unpaid: "Unpaid",
  canceled: "Cancelled",
};

// Previously entirely missing - DashboardNav and the account-menu dropdown
// both already linked to /billing, but no page existed here at all (404).
export default function BillingPage() {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);

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
      track("billing_portal_opened", { status: status || null });
      window.location.assign(data.redirectTo);
    } catch (err) {
      setPortalError(err.message || GENERIC_ERROR);
      setPortalLoading(false);
    }
  }

  async function continueCancel(reason, detail, outcome, canTalk = false) {
    track("cancellation_started", { reason, outcome });
    // Recorded server-side too; a failure here never blocks cancelling.
    await fetch("/api/billing/cancel-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, canTalk, detail: outcome === "switch" ? `[switching plan] ${detail}` : detail }),
    }).catch(reportQuietly);
    await openPortal();
  }

  const plan = state.data?.plan;
  const planLabel = PLAN_LABELS[plan] || (plan ? plan : null);
  const status = state.data?.subscription?.status;
  const statusLabel = STATUS_LABELS[status] || status;
  const hasSubscription = Boolean(state.data?.subscription?.hasStripeCustomer);
  // A failed renewal. past_due keeps access while Stripe retries; unpaid
  // has stopped it (lib/subscription-status.js). This page used to show it
  // only as a plain "Past due" status line - or "You're not on a paid plan
  // yet" with a link to buy again.
  const paymentFailed = status === "past_due" || status === "unpaid";

  return (
    <main className="min-h-screen scroll-smooth" style={{ background: "var(--mist)" }}>
      <DashboardNav />

      <section className="max-w-[880px] mx-auto px-6 pt-14 pb-8">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Billing
        </h1>
        <p className="text-sm mt-3 max-w-md" style={{ color: "var(--ink-soft)" }}>
          Your plan and subscription details.
        </p>
      </section>

      <div className="max-w-[880px] mx-auto px-6 pb-20">
        {paymentFailed && (
          <div role="alert" className="mb-6 rounded-[14px] p-5" style={{ border: "1px solid #fecaca", background: "#fff7f7" }}>
            <p className="text-[15px] font-semibold" style={{ color: "var(--score-low)" }}>Your last payment didn&apos;t go through</p>
            <p className="text-sm leading-relaxed mt-1" style={{ color: COLORS.ink }}>
              {status === "unpaid"
                ? "Screening and sending emails are paused until it's paid. Your workspace, candidates and history are all still here; update your payment method to pick up where you left off."
                : "We'll retry the payment automatically and everything keeps working meanwhile. Update your payment method so your subscription doesn't lapse."}
            </p>
            {hasSubscription && (
              <div className="mt-3">
                <Button onClick={openPortal} loading={portalLoading}>
                  {portalLoading ? "Opening…" : "Update payment method"}
                </Button>
              </div>
            )}
          </div>
        )}
        <PageCard title="Current plan" description="Manage your subscription, payment method, and invoices.">
          {state.loading ? (
            <p className="text-sm" style={{ color: COLORS.muted }}>Loading…</p>
          ) : state.error ? (
            <InlineAlert message={state.error} />
          ) : !plan && !paymentFailed ? (
            <>
              <p className="text-sm mb-4" style={{ color: COLORS.muted }}>
                You&apos;re not on a paid plan yet.
              </p>
              <Link href="/pricing" className="inline-flex items-center justify-center rounded-[10px] font-semibold text-sm px-4 py-2.5 text-white" style={{ background: "var(--forest)" }}>View plans</Link>
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
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <Button onClick={openPortal} loading={portalLoading}>
                    {portalLoading ? "Opening…" : "Manage billing"}
                  </Button>
                  {status !== "canceled" && (
                    <button type="button" onClick={() => setCancelOpen(true)} className="text-[14px] underline min-h-[32px]" style={{ color: COLORS.muted }}>
                      Cancel subscription
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs" style={{ color: COLORS.faint }}>
                  Billing management isn&apos;t available yet for this plan.
                </p>
              )}
            </div>
          )}
        </PageCard>
      </div>
      {cancelOpen && (
        <CancelDialog plan={plan} busy={portalLoading} onClose={() => setCancelOpen(false)} onContinue={continueCancel} />
      )}
    </main>
  );
}
