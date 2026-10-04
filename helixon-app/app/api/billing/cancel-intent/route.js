import { NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { cleanLine } from "@/lib/sanitize";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { captureAgencyEvent } from "@/lib/server-analytics";

// Why someone is about to cancel, asked on the Billing page before it hands
// over to the Stripe portal. Recorded server-side against the agency, so the
// answer isn't lost when the person declined analytics cookies.
const REASONS = new Set(["price", "not_using", "missing_feature", "scoring", "switching", "temporary", "other"]);

export async function POST(request) {
  const { user, profile } = await getCustomerContext();
  if (!user?.id) return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });
  if (!(await rateLimit(`cancel-intent:${getClientIp(request)}`, 10))) {
    return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
  }
  const body = await request.json().catch(() => null);
  const reason = REASONS.has(body?.reason) ? body.reason : "other";
  const detail = cleanLine(body?.detail, 500) || null;
  await captureAgencyEvent("cancellation_started", profile?.agency_id, { reason, detail });
  return NextResponse.json({ ok: true });
}
