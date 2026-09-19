import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { rateLimit } from "@/lib/ratelimit";

// POST /api/account/delete  { confirm: "DELETE" }
//
// Lets a signed-in person delete their own sign-in (their Clerk account). The
// Clerk `user.deleted` webhook (app/api/webhooks/clerk) then detaches their
// profile from the agency, so the agency's candidates, jobs and billing history
// stay intact - only the person's ability to sign in goes away.
//
// It refuses while the person has a live subscription. Deleting the account does
// NOT cancel Stripe billing, so without this guard someone could delete their
// account and keep being charged with no way to reach the billing page. They
// have to cancel first (Billing > Manage subscription), which is what the error
// tells them.
const BILLING_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in to continue." }, { status: 401 });
  }

  if (!(await rateLimit(`account-delete:${userId}`, 5))) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (body?.confirm !== "DELETE") {
    return NextResponse.json({ ok: false, error: 'Type DELETE to confirm.' }, { status: 400 });
  }

  try {
    const { subscription } = await getCustomerContext();
    if (subscription && BILLING_STATUSES.has(subscription.status)) {
      return NextResponse.json(
        {
          ok: false,
          code: "ACTIVE_SUBSCRIPTION",
          error:
            "You have an active subscription. Cancel it first (Billing > Manage subscription), otherwise it would keep being charged. Then come back to delete your account.",
        },
        { status: 409 }
      );
    }

    const client = await clerkClient();
    await client.users.deleteUser(userId);
  } catch (err) {
    console.error("[account/delete] Failed:", err?.message || err);
    return NextResponse.json({ ok: false, error: "We couldn't delete your account. Please try again or contact support." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
