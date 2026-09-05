import Stripe from "stripe";
import Link from "next/link";
import { redirect } from "next/navigation";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});

export const metadata = {
  title: "You're all set - Helixon",
};

const PLAN_LABELS = {
  individual: "Individual",
  agency: "Agency", // was "team" - PRICE_IDS in api/checkout/route.js renamed team -> agency
};

// Server Component - runs on the server, so the Stripe secret key never
// reaches the browser. We re-fetch the session from Stripe using the
// session_id in the URL rather than trusting query params directly; the
// URL alone proves nothing (anyone could type a fake session_id), but a
// successful stripe.checkout.sessions.retrieve() call proves Stripe
// actually issued that session.
//
// Note: this page confirms payment happened. Actual entitlement
// (unlocking "Unlimited analyses" etc.) is granted by the
// /api/webhooks/stripe handler, which is the source of truth - webhooks
// can arrive slightly after this redirect, so don't gate access purely
// on this page ever having been visited.
export default async function CheckoutSuccessPage({ searchParams }) {
  const { session_id: sessionId } = await searchParams;

  let session = null;
  let error = null;

  if (!sessionId) {
    error = "Missing checkout session.";
  } else {
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (err) {
      console.error("[checkout/success] Failed to retrieve session:", err.message);
      error = "We couldn't find that checkout session.";
    }
  }

  const paid = session?.payment_status === "paid" || session?.status === "complete";

  // api/checkout/route.js flags this when the logged-in Clerk user paid
  // but doesn't have a profile/agency row yet (webhook hasn't fired, or
  // they never finished setup). Send them to finish that instead of
  // showing "you're all set" for a plan nothing is actually attached to.
  if (paid && session?.metadata?.needsSignup === "true") {
    const plan = session.metadata?.plan || "";
    redirect(`/signup?plan=${encodeURIComponent(plan)}&session_id=${encodeURIComponent(sessionId)}`);
  }

  const planLabel = PLAN_LABELS[session?.metadata?.plan] || "Helixon";
  const email = session?.customer_details?.email || session?.customer_email;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16" style={{ background: "var(--mist)" }}>
      <div
        className="w-full max-w-sm rounded-[22px] p-8 sm:p-9 text-center"
        style={{
          background: "white",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow-raise, 0 20px 40px -20px rgba(19,32,27,0.18))",
        }}
      >
        {error || !paid ? (
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--signal-soft)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--signal)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h1 className="text-[1.4rem] font-semibold tracking-tight mb-2" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              We couldn&apos;t confirm that payment
            </h1>
            <p className="text-[13px] leading-relaxed mb-7" style={{ color: "var(--ink-soft)" }}>
              {error || "This checkout session hasn't completed yet. If you were charged, it'll be reflected on your account shortly."}
            </p>
            <Link
              href="/#pricing"
              className="btn-forest inline-flex items-center justify-center gap-2 w-full text-white font-semibold py-3 rounded-[12px] text-sm transition-all"
              style={{ background: "var(--forest)" }}
            >
              Back to pricing
            </Link>
          </>
        ) : (
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--mint)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>

            <h1 className="text-[1.4rem] font-semibold tracking-tight mb-2" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
              You&apos;re all set
            </h1>
            <p className="text-[13px] leading-relaxed mb-1" style={{ color: "var(--ink-soft)" }}>
              Your {planLabel} plan is now active.
            </p>
            {email && (
              <p className="text-[12px] mb-7" style={{ color: "var(--ink-faint)" }}>
                A receipt has been sent to {email}.
              </p>
            )}
            {!email && <div className="mb-7" />}

            <div className="flex flex-col gap-2.5">
              <Link
                href="/analyse"
                className="btn-forest inline-flex items-center justify-center gap-2 w-full text-white font-semibold py-3 rounded-[12px] text-sm transition-all"
                style={{ background: "var(--forest)" }}
              >
                Start screening candidates
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
              <Link
                href="/"
                className="btn-outline inline-flex items-center justify-center gap-2 w-full font-semibold py-3 rounded-[12px] text-sm transition-all"
                style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
              >
                Back to homepage
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}