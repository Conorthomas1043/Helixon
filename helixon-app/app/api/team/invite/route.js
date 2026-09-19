import { NextResponse } from "next/server";
import { requireCustomerContext } from "@/lib/customer-auth";
import { ensureAgencyOrg, getOrgSeatUsage, inviteToAgencyOrg, revokeAgencyOrgInvitation, AGENCY_SEAT_LIMIT } from "@/lib/clerk-org";
import { getAgencyPlan } from "@/lib/plan";
import { getClientIp, rateLimit } from "@/lib/ratelimit";
import { supabase } from "@/lib/supabase";
import { cleanEmail } from "@/lib/sanitize";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Team invites are an Agency-plan feature. Deliberately does NOT use
// context.subscription (from requireCustomerContext), which is scoped to
// the *current user's own* profile - only the agency owner (who actually
// paid) has a subscriptions row, so that check would incorrectly lock
// every invited teammate out of their own Team page. getAgencyPlan
// resolves the same answer for whichever member of the agency is asking.
async function requireAgencyPlan(context) {
  const plan = await getAgencyPlan(context.agencyId);
  return plan === "agency";
}

// GET: seat usage + pending invitations, so the dashboard can render
// "3 of 5 seats used" and disable the invite form once full without a
// separate round trip per number.
export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!(await requireAgencyPlan(auth))) {
    return NextResponse.json({ error: "Team invites are available on the Agency plan." }, { status: 403 });
  }

  const { data: agency, error } = await supabase
    .from("agencies")
    .select("id, clerk_org_id, name")
    .eq("id", auth.agencyId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to load team." }, { status: 500 });
  }

  // No org yet means nobody has been invited yet - report a clean "1 used"
  // (the owner) rather than creating an org just to answer a GET request.
  if (!agency?.clerk_org_id) {
    return NextResponse.json({
      memberCount: 1,
      pendingCount: 0,
      pendingInvites: [],
      used: 1,
      limit: AGENCY_SEAT_LIMIT,
      remaining: AGENCY_SEAT_LIMIT - 1,
    });
  }

  try {
    const usage = await getOrgSeatUsage(agency.clerk_org_id);
    return NextResponse.json(usage);
  } catch (err) {
    console.error("[team/invite] Failed to read seat usage:", err.message);
    return NextResponse.json({ error: "Couldn't load team seat usage." }, { status: 500 });
  }
}

// POST: invite a teammate by email. Lazily creates the agency's Clerk
// Organization on first use (see ensureAgencyOrg).
export async function POST(request) {
  // Tighter than the default 20/hr - the 5-seat cap already limits total
  // damage, but nothing stops one seat from being used to spam invite
  // emails (real emails sent through this app's own Clerk account) before
  // it's ever accepted.
  if (!(await rateLimit(getClientIp(request), 10))) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!(await requireAgencyPlan(auth))) {
    return NextResponse.json({ error: "Team invites are available on the Agency plan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const email = cleanEmail(body?.email);
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("id, name")
    .eq("id", auth.agencyId)
    .maybeSingle();
  if (agencyError || !agency) {
    return NextResponse.json({ error: "Failed to load your agency." }, { status: 500 });
  }

  let orgId;
  try {
    orgId = await ensureAgencyOrg({
      agencyId: agency.id,
      agencyName: agency.name,
      ownerClerkUserId: auth.userId,
    });
  } catch (err) {
    console.error("[team/invite] Failed to ensure org:", err.message);
    return NextResponse.json({ error: "Couldn't set up your team workspace. Please try again." }, { status: 500 });
  }

  let usage;
  try {
    usage = await getOrgSeatUsage(orgId);
  } catch (err) {
    console.error("[team/invite] Failed to read seat usage:", err.message);
    return NextResponse.json({ error: "Couldn't check seat availability. Please try again." }, { status: 500 });
  }

  if (usage.remaining <= 0) {
    return NextResponse.json(
      { error: `Your Agency plan includes ${AGENCY_SEAT_LIMIT} seats and all of them are in use or pending.` },
      { status: 409 }
    );
  }

  try {
    await inviteToAgencyOrg({ orgId, inviterUserId: auth.userId, email });
  } catch (err) {
    // The detail stays in the server log. Clerk's own messages ("already a
    // member", "already has a pending invitation", ...) would tell the caller
    // whether an arbitrary email address has an account, so the response is
    // the same whatever went wrong.
    const detail = err?.errors?.[0]?.longMessage || err.message || "unknown error";
    console.error("[team/invite] Clerk invitation failed:", detail);
    return NextResponse.json(
      { error: "We couldn't send that invite. Check the address, and that they aren't already on your team or invited, then try again." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}

// DELETE: cancel a pending invite before it's accepted, freeing the seat
// it was holding. Needs the org id too since Clerk's revoke call is
// scoped by organizationId, not just invitationId.
export async function DELETE(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!(await requireAgencyPlan(auth))) {
    return NextResponse.json({ error: "Team invites are available on the Agency plan." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const invitationId = body?.invitationId;
  if (!invitationId) {
    return NextResponse.json({ error: "invitationId is required." }, { status: 400 });
  }

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("clerk_org_id")
    .eq("id", auth.agencyId)
    .maybeSingle();
  if (agencyError || !agency?.clerk_org_id) {
    return NextResponse.json({ error: "No team workspace found for your agency." }, { status: 404 });
  }

  try {
    await revokeAgencyOrgInvitation({ orgId: agency.clerk_org_id, invitationId, requestingUserId: auth.userId });
  } catch (err) {
    const detail = err?.errors?.[0]?.longMessage || err.message || "unknown error";
    console.error("[team/invite] Clerk revoke failed:", detail);
    return NextResponse.json({ error: "Couldn't cancel that invite. Please refresh and try again." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
