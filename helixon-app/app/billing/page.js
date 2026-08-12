"use client";

import { useState, useEffect, useRef } from "react";

const AGENCY_ID = "YOUR-SEED-AGENCY-ID"; // replace with real auth later

// Wire this up to your real subscription record — shape shown is illustrative.
const MOCK_SUBSCRIPTION = {
  plan: "solo",              // "free" | "solo" | "team"
  status: "active",          // "active" | "past_due" | "canceled"
  priceMonthly: 149,
  renewsOn: "2026-09-09",
  analysesUsed: 247,
  analysesLimit: null,       // null = unlimited
  seatsUsed: 1,
  seatsLimit: 1,
  card: { brand: "Visa", last4: "4242", expMonth: 11, expYear: 2028 },
};

const MOCK_INVOICES = [
  { id: "inv_1093", date: "2026-08-01", amount: 149, status: "paid" },
  { id: "inv_1067", date: "2026-07-01", amount: 149, status: "paid" },
  { id: "inv_1041", date: "2026-06-01", amount: 149, status: "paid" },
  { id: "inv_1015", date: "2026-05-01", amount: 149, status: "paid" },
];

const PLAN_LABEL = { free: "Free", solo: "Solo", team: "Team" };

// ═══════════════════════════════════════════════════════════════════════════
// Shared app nav — identical to Dashboard.jsx / AccountSettings.jsx.
// Worth extracting to components/AppNav.jsx so all three stay in sync.
// ═══════════════════════════════════════════════════════════════════════════
function AppNav({ active }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const navLink = (label, href, key) => (
    <a
      key={key}
      href={href}
      className={
        "text-sm px-3 py-1.5 rounded-lg transition-colors " +
        (active === key ? "bg-emerald-50 text-emerald-800 font-medium" : "text-stone-500 hover:text-stone-800 hover:bg-stone-50")
      }
    >
      {label}
    </a>
  );

  return (
    <nav className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <a href="/" className="font-bold text-stone-900">Helixon</a>
        <div className="hidden sm:flex items-center gap-1">
          {navLink("Scoring", "/", "scoring")}
          {navLink("Dashboard", "/dashboard", "dashboard")}
        </div>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-stone-200 hover:bg-stone-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <span className="w-7 h-7 rounded-full bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center">
            AV
          </span>
          <svg className="w-3.5 h-3.5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {menuOpen && (
          <div role="menu" className="absolute right-0 mt-2 w-52 bg-white border border-stone-200 rounded-xl shadow-lg py-1.5 z-50">
            <div className="px-3.5 py-2 border-b border-stone-100">
              <p className="text-sm font-medium text-stone-900 truncate">Acme Recruiting</p>
              <p className="text-xs text-stone-400 truncate">agency@acme.com</p>
            </div>
            <a href="/account" role="menuitem" className="block px-3.5 py-2 text-sm text-stone-600 hover:bg-stone-50">
              Account settings
            </a>
            <a href="/billing" role="menuitem" className="block px-3.5 py-2 text-sm text-emerald-800 bg-emerald-50 font-medium">
              Billing
            </a>
            <div className="border-t border-stone-100 mt-1 pt-1">
              <a href="/logout" role="menuitem" className="block px-3.5 py-2 text-sm text-red-600 hover:bg-red-50">
                Log out
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function StatusPill({ status }) {
  const styles = {
    active: "bg-emerald-50 text-emerald-700",
    past_due: "bg-amber-50 text-amber-700",
    canceled: "bg-stone-100 text-stone-500",
  };
  const labels = { active: "Active", past_due: "Payment failed", canceled: "Canceled" };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function CardBrandIcon() {
  return (
    <div className="w-9 h-6 rounded bg-stone-800 flex items-center justify-center shrink-0">
      <svg width="16" height="10" viewBox="0 0 24 16" fill="none">
        <circle cx="8" cy="8" r="7" fill="#EB001B" opacity="0.85" />
        <circle cx="16" cy="8" r="7" fill="#F79E1B" opacity="0.85" />
      </svg>
    </div>
  );
}

export default function BillingManagement() {
  const [sub] = useState(MOCK_SUBSCRIPTION);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [toast, setToast] = useState(null);

  const isFree = sub.plan === "free";
  const usagePct = sub.analysesLimit
    ? Math.min((sub.analysesUsed / sub.analysesLimit) * 100, 100)
    : null;
  const nearLimit = sub.analysesLimit && sub.analysesUsed / sub.analysesLimit >= 0.8;

  async function handleCancelSubscription() {
    setCanceling(true);
    try {
      await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agencyId: AGENCY_ID }),
      });
      setToast("Subscription set to cancel at period end");
      setCancelOpen(false);
    } catch {
      setToast("Couldn't cancel — please try again");
    } finally {
      setCanceling(false);
    }
  }

  function handleUpdatePaymentMethod() {
    // In real usage: redirect to Stripe billing portal / customer portal session.
    window.location.href = "/api/billing/portal";
  }

  function handleDownloadInvoice(id) {
    window.location.href = `/api/billing/invoices/${id}/pdf`;
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <AppNav active="dashboard" />

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-stone-900">Billing</h1>

        {sub.status === "past_due" && (
          <div role="alert" className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-amber-800 text-sm font-medium">Your last payment failed</p>
              <p className="text-amber-700 text-sm mt-0.5">Update your payment method to keep your subscription active.</p>
            </div>
          </div>
        )}

        {/* ── Current plan ────────────────────────────────────────────── */}
        <section className="bg-white rounded-xl border border-stone-200 p-6">
          <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h2 className="font-semibold text-stone-900 text-lg">{PLAN_LABEL[sub.plan]} plan</h2>
                <StatusPill status={sub.status} />
              </div>
              <p className="text-sm text-stone-400">
                {isFree ? "No payment method on file" : `£${sub.priceMonthly} / month · renews ${sub.renewsOn}`}
              </p>
            </div>
            <a
              href="/pricing"
              className="text-sm font-semibold border border-stone-300 text-stone-700 px-4 py-2 rounded-xl hover:bg-stone-50 transition-colors whitespace-nowrap"
            >
              {isFree ? "Upgrade plan" : "Change plan"}
            </a>
          </div>

          {/* Usage */}
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-sm text-stone-600">
              {sub.analysesLimit
                ? `${sub.analysesUsed} of ${sub.analysesLimit} analyses used this period`
                : `${sub.analysesUsed} analyses this period · unlimited`}
            </span>
            {nearLimit && <span className="text-xs font-semibold text-amber-600">Almost at your limit</span>}
          </div>
          {sub.analysesLimit && (
            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${nearLimit ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          )}

          {isFree && (
            <a
              href="/pricing"
              className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors mt-5"
            >
              Upgrade to keep screening
            </a>
          )}
        </section>

        {/* ── Payment method ──────────────────────────────────────────── */}
        {!isFree && (
          <section className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="font-semibold text-stone-800 mb-4">Payment method</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardBrandIcon />
                <div>
                  <p className="text-sm font-medium text-stone-800">{sub.card.brand} •••• {sub.card.last4}</p>
                  <p className="text-xs text-stone-400">Expires {String(sub.card.expMonth).padStart(2, "0")}/{sub.card.expYear}</p>
                </div>
              </div>
              <button
                onClick={handleUpdatePaymentMethod}
                className="text-sm font-semibold text-stone-700 border border-stone-300 px-3.5 py-2 rounded-xl hover:bg-stone-50 transition-colors"
              >
                Update
              </button>
            </div>
          </section>
        )}

        {/* ── Invoice history ─────────────────────────────────────────── */}
        {!isFree && (
          <section className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="font-semibold text-stone-800 mb-4">Invoice history</h2>
            <div className="divide-y divide-stone-100">
              {MOCK_INVOICES.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-stone-800">{inv.date}</p>
                    <p className="text-xs text-stone-400 capitalize">{inv.status}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-stone-600">£{inv.amount.toFixed(2)}</span>
                    <button
                      onClick={() => handleDownloadInvoice(inv.id)}
                      className="text-sm font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                    >
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Cancel subscription ─────────────────────────────────────── */}
        {!isFree && sub.status !== "canceled" && (
          <section className="bg-white rounded-xl border border-stone-200 p-6">
            <h2 className="font-semibold text-stone-800 mb-1">Cancel subscription</h2>
            <p className="text-sm text-stone-400 mb-4">
              You'll keep access until {sub.renewsOn}, then drop to the Free plan.
            </p>

            {!cancelOpen ? (
              <button
                onClick={() => setCancelOpen(true)}
                className="text-sm font-semibold text-red-600 border border-red-200 px-4 py-2.5 rounded-xl hover:bg-red-50 transition-colors"
              >
                Cancel subscription
              </button>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-stone-600">Are you sure? This can't be undone easily.</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelSubscription}
                    disabled={canceling}
                    className="text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 px-4 py-2.5 rounded-xl transition-colors"
                  >
                    {canceling ? "Canceling…" : "Yes, cancel"}
                  </button>
                  <button
                    onClick={() => setCancelOpen(false)}
                    className="text-sm text-stone-500 px-4 py-2.5 rounded-xl hover:bg-stone-100 transition-colors"
                  >
                    Never mind
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-stone-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}
    </main>
  );
}