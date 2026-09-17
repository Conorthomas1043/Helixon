import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

// Agency plan seat cap, confirmed with the user (2026-09-17) - not a value
// inferred from pricing copy, which never states a number.
export const AGENCY_SEAT_LIMIT = 5;

// Ensures the given agency has a Clerk Organization backing its team
// membership, creating one lazily on first use rather than only at signup.
// This covers two cases with one code path:
//   1. A brand-new Agency-plan signup (no org yet).
//   2. An existing Individual-plan agency that later upgrades via the
//      Stripe billing portal - agencies.settings.plan/plan_name are NOT
//      kept in sync on a plan change (only subscriptions.plan is, via
//      app/api/webhooks/stripe), so there is no reliable "just became
//      Agency" moment to hook a one-time org-creation step onto. Callers
//      must check subscriptions.plan === "agency" themselves before
//      calling this - it does not check plan.
export async function ensureAgencyOrg({ agencyId, agencyName, ownerClerkUserId }) {
  const { data: agency, error } = await supabase
    .from("agencies")
    .select("id, clerk_org_id, name")
    .eq("id", agencyId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!agency) throw new Error("Agency not found.");
  if (agency.clerk_org_id) return agency.clerk_org_id;

  const client = await clerkClient();
  const org = await client.organizations.createOrganization({
    name: agencyName || agency.name || "Agency",
    createdBy: ownerClerkUserId,
  });

  const { error: updateError } = await supabase
    .from("agencies")
    .update({ clerk_org_id: org.id })
    .eq("id", agencyId);

  if (updateError) {
    // The org now exists in Clerk but isn't linked - better than losing
    // track of it entirely. The next call will find agency.clerk_org_id
    // still null and create a second, orphaned org, so surface this
    // loudly rather than swallowing it.
    throw new Error(`Organization created but failed to link to agency: ${updateError.message}`);
  }

  return org.id;
}

// Members already in the org, plus invitations still pending, both count
// against the seat cap - otherwise someone could send 5 invites, have none
// accepted yet, and still send a 6th.
export async function getOrgSeatUsage(orgId) {
  const client = await clerkClient();
  const [memberships, invitations] = await Promise.all([
    client.organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 100 }),
    client.organizations.getOrganizationInvitationList({ organizationId: orgId, status: ["pending"], limit: 100 }),
  ]);

  const memberCount = memberships.totalCount ?? memberships.data?.length ?? 0;
  const pendingInvites = (invitations.data ?? []).map((inv) => ({
    id: inv.id,
    email: inv.emailAddress,
    createdAt: inv.createdAt,
  }));
  const used = memberCount + pendingInvites.length;

  return {
    memberCount,
    pendingCount: pendingInvites.length,
    pendingInvites,
    used,
    limit: AGENCY_SEAT_LIMIT,
    remaining: Math.max(0, AGENCY_SEAT_LIMIT - used),
  };
}

export async function inviteToAgencyOrg({ orgId, inviterUserId, email }) {
  const client = await clerkClient();
  return client.organizations.createOrganizationInvitation({
    organizationId: orgId,
    emailAddress: email,
    inviterUserId,
    role: "org:member",
  });
}

export async function revokeAgencyOrgInvitation({ orgId, invitationId, requestingUserId }) {
  const client = await clerkClient();
  return client.organizations.revokeOrganizationInvitation({
    organizationId: orgId,
    invitationId,
    requestingUserId,
  });
}
