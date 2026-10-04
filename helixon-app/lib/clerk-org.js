import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { AGENCY_SEATS } from "@/lib/plan-features";

// Agency plan seat cap, confirmed with the user (2026-09-17). Defined in
// lib/plan-features.js so the pricing copy states the same number.
export const AGENCY_SEAT_LIMIT = AGENCY_SEATS;

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

  // Only link if nobody else did in the meantime: two first invites sent at
  // once both saw clerk_org_id null and each created an org, and the last
  // write won - leaving the other org (and any invite sent into it) orphaned.
  const { data: linked, error: updateError } = await supabase
    .from("agencies")
    .update({ clerk_org_id: org.id })
    .eq("id", agencyId)
    .is("clerk_org_id", null)
    .select("id");

  if (updateError) {
    // The org now exists in Clerk but isn't linked - better than losing
    // track of it entirely. The next call will find agency.clerk_org_id
    // still null and create a second, orphaned org, so surface this
    // loudly rather than swallowing it.
    throw new Error(`Organization created but failed to link to agency: ${updateError.message}`);
  }

  if (!linked?.length) {
    // Lost the race - use the org the other request linked, drop ours.
    await client.organizations.deleteOrganization(org.id).catch((err) => {
      console.error(`[clerk-org] Failed to delete duplicate org ${org.id}:`, err.message);
    });
    const { data: winner, error: rereadError } = await supabase
      .from("agencies")
      .select("clerk_org_id")
      .eq("id", agencyId)
      .maybeSingle();
    if (rereadError || !winner?.clerk_org_id) {
      throw new Error("Couldn't resolve the agency's team workspace.");
    }
    return winner.clerk_org_id;
  }

  return org.id;
}

// Everyone in the org: Clerk user id, role, and whatever name/email Clerk
// has for them.
export async function listOrgMembers(orgId) {
  const client = await clerkClient();
  const memberships = await client.organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 100 });
  return (memberships.data ?? []).map((m) => ({
    userId: m.publicUserData?.userId ?? null,
    role: m.role,
    name: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" ") || null,
    identifier: m.publicUserData?.identifier ?? null,
  }));
}

// Members already in the org, plus invitations still pending, both count
// against the seat cap - otherwise someone could send 5 invites, have none
// accepted yet, and still send a 6th.
export async function getOrgSeatUsage(orgId) {
  const client = await clerkClient();
  const [members, invitations] = await Promise.all([
    listOrgMembers(orgId),
    client.organizations.getOrganizationInvitationList({ organizationId: orgId, status: ["pending"], limit: 100 }),
  ]);

  const memberCount = members.length;
  const pendingInvites = (invitations.data ?? []).map((inv) => ({
    id: inv.id,
    email: inv.emailAddress,
    createdAt: inv.createdAt,
  }));
  const used = memberCount + pendingInvites.length;

  return {
    members,
    memberCount,
    pendingCount: pendingInvites.length,
    pendingInvites,
    used,
    limit: AGENCY_SEAT_LIMIT,
    remaining: Math.max(0, AGENCY_SEAT_LIMIT - used),
  };
}

// Where the invite email's link lands. Without a redirectUrl, Clerk sends
// the invitee to its own hosted sign-up page instead of this app's
// /signup - which is the only place that marks the new account as joining
// via an invite (unsafeMetadata.viaOrgInvite, app/signup's ticket branch).
// Signing up on the hosted page instead made the Clerk webhook treat them
// as a brand-new customer: it created a separate, unpaid agency for them,
// and they never joined the team that invited them.
function inviteRedirectUrl() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "");
  return `${site}/signup`;
}

export async function inviteToAgencyOrg({ orgId, inviterUserId, email }) {
  const client = await clerkClient();
  return client.organizations.createOrganizationInvitation({
    organizationId: orgId,
    emailAddress: email,
    inviterUserId,
    role: "org:member",
    redirectUrl: inviteRedirectUrl(),
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

// Looks up a member's role directly rather than trusting anything the
// client sent - used before removing someone, to refuse removing the
// workspace owner. ensureAgencyOrg's createOrganization({ createdBy })
// automatically makes the owner "org:admin"; inviteToAgencyOrg always
// grants invited teammates "org:member" (never admin), so exactly one
// "org:admin" - the owner - exists per org by construction. Returns null
// if the given user isn't a member of this org at all.
export async function getOrgMemberRole({ orgId, userId }) {
  const members = await listOrgMembers(orgId);
  return members.find((m) => m.userId === userId)?.role ?? null;
}

// Removes an existing (accepted) member from the org, freeing the seat
// they held. Distinct from revokeAgencyOrgInvitation, which only cancels a
// *pending* invitation before it's ever accepted.
export async function removeAgencyOrgMember({ orgId, userId }) {
  const client = await clerkClient();
  return client.organizations.deleteOrganizationMembership({
    organizationId: orgId,
    userId,
  });
}

// Who created the org - the agency's owner. ensureAgencyOrg creates it with
// createdBy set to the owner, and they are never demoted or removed.
export async function getOrgCreatorId(orgId) {
  const client = await clerkClient();
  const org = await client.organizations.getOrganization({ organizationId: orgId });
  return org?.createdBy ?? null;
}

// "org:admin" (can manage the team) or "org:member".
export async function setOrgMemberRole({ orgId, userId, role }) {
  const client = await clerkClient();
  return client.organizations.updateOrganizationMembership({ organizationId: orgId, userId, role });
}
