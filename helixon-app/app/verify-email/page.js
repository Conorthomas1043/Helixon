import { redirect } from "next/navigation";

// Email verification is now a step inside Clerk's <SignUp/> flow
// (app/signup) itself - shown automatically as a code-entry step right
// after the account is created, rather than a separate emailed link/page.
// Redirecting to /signup directly would be a dead end: that page bounces
// anyone without a paid Stripe session straight to /pricing (see its own
// comment), so an old bookmarked/emailed "verify your email" link would
// silently double-redirect to a pricing page with zero explanation.
// /login already has the context to explain both cases in one place.
export default function VerifyEmailPage() {
  redirect("/login?intent=verify");
}
