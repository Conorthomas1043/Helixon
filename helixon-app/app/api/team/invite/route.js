import { NextResponse } from "next/server";
import { requireCustomerContext } from "@/lib/customer-auth";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import {
  ensureAgencyOrg,
  getOrgSeatUsage,
  inviteToAgencyOrg,
  revokeAgencyOrgInvitation,
  getOrgMemberRole,
  removeAgencyOrgMember,
  AGENCY_SEAT_LIMIT,
} from "@/lib/clerk-org";
import { getAgencyPlan } from "@/lib/plan";
import { getClientIp, rateLimit } from "@/lib/ratelimit";
import { supabase } from "@/lib/supabase";
import { cleanEmail } from "@/lib/sanitize";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import {
  agencyMembers,
  candidateIdsOwnedBy,
  isValidAssignee,
  reassignCandidates,
  unassignedCandidateIds,
} from "@/lib/team-reassign";
import { logAudit } from "@/lib/agency-audit";
import { reportError } from "@/lib/report-error";

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
export const GET = customerRoute(async (_request, _context, auth) => {
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
  // Nobody can have joined without an org, so whoever is asking is the
  // owner, and the first invite will make them the org's admin.
  // Candidates no current member owns - only the owner can act on them.
  const unassignedCount = async () => {
    try {
      return (await unassignedCandidateIds(supabase, auth.agencyId)).length;
    } catch (err) {
      reportError("[team/invite] Failed to count unassigned candidates:", err.message);
      return 0;
    }
  };

  if (!agency?.clerk_org_id) {
    return NextResponse.json({
      canManage: true,
      unassignedCount: await unassignedCount(),
      outsideMembers: [],
      memberCount: 1,
      pendingCount: 0,
      pendingInvites: [],
      used: 1,
      limit: AGENCY_SEAT_LIMIT,
      remaining: AGENCY_SEAT_LIMIT - 1,
    });
  }

  try {
    const [{ members, ...usage }, { data: profiles, error: profilesError }] = await Promise.all([
      getOrgSeatUsage(agency.clerk_org_id),
      supabase.from("profiles").select("clerk_user_id").eq("agency_id", auth.agencyId),
    ]);
    if (profilesError) throw new Error(profilesError.message);

    // Seat-holders who aren't actually in this workspace - typically someone
    // who already had their own paid agency when they accepted the invite
    // (the Clerk webhook deliberately doesn't move them). They count against
    // the seat cap but never appear on the team list, so list them here or
    // the owner has no way to see or free those seats.
    const inWorkspace = new Set((profiles || []).map((p) => p.clerk_user_id));
    const outsideMembers = members
      .filter((m) => m.userId && !inWorkspace.has(m.userId))
      .map((m) => ({ userId: m.userId, name: m.name, email: m.identifier }));

    const viewer = members.find((m) => m.userId === auth.userId);
    const canManage = viewer?.role === "org:admin";
    return NextResponse.json({
      ...usage,
      canManage,
      unassignedCount: canManage ? await unassignedCount() : 0,
      outsideMembers,
    });
  } catch (err) {
    reportError("[team/invite] Failed to read seat usage:", err.message);
    return NextResponse.json({ error: "Couldn't load team seat usage." }, { status: 500 });
  }
});

// Returns a 403/500 response unless userId is the org's owner ("org:admin"),
// or null when they are.
async function requireOrgOwner(orgId, userId) {
  let role;
  try {
    role = await getOrgMemberRole({ orgId, userId });
  } catch (err) {
    reportError("[team/invite] Failed to look up caller role:", err.message);
    return NextResponse.json({ error: "Couldn't verify your team role. Please try again." }, { status: 500 });
  }
  if (role !== "org:admin") {
    return NextResponse.json({ error: "Only the workspace owner or an admin can manage the team." }, { status: 403 });
  }
  return null;
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
    reportError("[team/invite] Failed to ensure org:", err.message);
    return NextResponse.json({ error: "Couldn't set up your team workspace. Please try again." }, { status: 500 });
  }

  // Only the workspace owner manages the team. Invited teammates are
  // "org:member" and share the same agency (and so pass every check above),
  // so without this any of them could invite people or remove colleagues.
  const ownerCheck = await requireOrgOwner(orgId, auth.userId);
  if (ownerCheck) return ownerCheck;

  let usage;
  try {
    usage = await getOrgSeatUsage(orgId);
  } catch (err) {
    reportError("[team/invite] Failed to read seat usage:", err.message);
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
    reportError("[team/invite] Clerk invitation failed:", detail);
    return NextResponse.json(
      { error: "We couldn't send that invite. Check the address, and that they aren't already on your team or invited, then try again." },
      { status: 400 }
    );
  }

  await logAudit({ auth, request, action: "team.invited", targetType: "invitation", summary: "Invited a teammate" });
  return NextResponse.json({ ok: true });
}

// DELETE: either cancels a pending invite before it's accepted (body:
// { invitationId }), or removes an existing, accepted team member (body:
// { userId }) - both free the seat they held, just at different points in
// the invite lifecycle, so one endpoint covers both rather than splitting
// "team offboarding" across two routes.
export const DELETE = customerRoute(async (request, _context, auth, body) => {
  if (!(await requireAgencyPlan(auth))) {
    return NextResponse.json({ error: "Team invites are available on the Agency plan." }, { status: 403 });
  }

  const invitationId = body?.invitationId;
  const memberUserId = body?.userId;

  if (!invitationId && !memberUserId) {
    return NextResponse.json({ error: "invitationId or userId is required." }, { status: 400 });
  }

  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("clerk_org_id")
    .eq("id", auth.agencyId)
    .maybeSingle();
  if (agencyError || !agency?.clerk_org_id) {
    return NextResponse.json({ error: "No team workspace found for your agency." }, { status: 404 });
  }

  const ownerCheck = await requireOrgOwner(agency.clerk_org_id, auth.userId);
  if (ownerCheck) return ownerCheck;

  if (invitationId) {
    try {
      await revokeAgencyOrgInvitation({ orgId: agency.clerk_org_id, invitationId, requestingUserId: auth.userId });
    } catch (err) {
      const detail = err?.errors?.[0]?.longMessage || err.message || "unknown error";
      reportError("[team/invite] Clerk revoke failed:", detail);
      return NextResponse.json({ error: "Couldn't cancel that invite. Please refresh and try again." }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  }

  // Removing an existing member - block removing yourself (you'd lose
  // access to your own team page mid-request; closing an account is a
  // separate, deliberate flow - see app/api/account/delete) and block
  // removing the workspace owner (never a valid action, whoever's asking).
  if (memberUserId === auth.userId) {
    return NextResponse.json(
      { error: "You can't remove yourself from the team here. Use Account settings to close your account instead." },
      { status: 400 }
    );
  }

  let role;
  try {
    role = await getOrgMemberRole({ orgId: agency.clerk_org_id, userId: memberUserId });
  } catch (err) {
    reportError("[team/invite] Failed to look up member role:", err.message);
    return NextResponse.json({ error: "Couldn't verify that team member. Please refresh and try again." }, { status: 400 });
  }

  if (!role) {
    return NextResponse.json({ error: "That person isn't on your team." }, { status: 404 });
  }
  if (role === "org:admin") {
    return NextResponse.json(
      { error: "Admins can't be removed. Make them a member first (the workspace owner can never be removed)." },
      { status: 400 }
    );
  }

  // Who takes over the departing member's candidates: another current
  // member's Clerk id, or null to leave them unassigned. Omitted = leave
  // them as they are (they then show as unassigned on the Team page).
  // Checked before anything is removed, so a bad target changes nothing.
  const reassignTo = body?.reassignTo;
  const reassigning = reassignTo !== undefined;
  if (reassigning) {
    if (reassignTo === memberUserId || !(await isValidAssignee(supabase, auth.agencyId, reassignTo ?? null))) {
      return NextResponse.json({ error: "Pick someone who's staying on the team to take over their candidates." }, { status: 400 });
    }
  }
  const departingName = recruiterDisplayName((await agencyMembers(supabase, auth.agencyId)).get(memberUserId));

  try {
    await removeAgencyOrgMember({ orgId: agency.clerk_org_id, userId: memberUserId });
  } catch (err) {
    const detail = err?.errors?.[0]?.longMessage || err.message || "unknown error";
    reportError("[team/invite] Clerk member removal failed:", detail);
    return NextResponse.json({ error: "Couldn't remove that team member. Please refresh and try again." }, { status: 400 });
  }

  // Belt and braces: the organizationMembership.deleted webhook clears
  // profiles.agency_id too, but that arrives asynchronously (and depends
  // on the webhook being configured at all in this Clerk instance) -
  // clearing it here means the removed member loses dashboard access to
  // this agency's data immediately, not however long webhook delivery
  // takes. Scoped by agency_id so this can't ever touch a different
  // agency_id the same clerk_user_id might have moved to in the meantime.
  const { error: detachError } = await supabase
    .from("profiles")
    .update({ agency_id: null })
    .eq("clerk_user_id", memberUserId)
    .eq("agency_id", auth.agencyId);
  if (detachError) {
    reportError("[team/invite] Removed from Clerk org but failed to detach profile:", detachError.message);
  }

  let reassigned = 0;
  if (reassigning) {
    try {
      const ids = await candidateIdsOwnedBy(supabase, auth.agencyId, memberUserId);
      reassigned = await reassignCandidates(supabase, {
        agencyId: auth.agencyId,
        candidateIds: ids,
        toRecruiterId: reassignTo ?? null,
        actor: recruiterDisplayName(auth.profile) || auth.userId,
        fromLabel: departingName,
      });
    } catch (err) {
      // They're off the team either way; their candidates now show in the
      // Team page's "unassigned" pile, where they can be picked up in one go.
      reportError("[team/invite] Member removed but reassigning their candidates failed:", err.message);
      return NextResponse.json({
        ok: true,
        reassignFailed: true,
        error: "They've been removed, but their candidates couldn't be reassigned. Use the unassigned candidates panel to hand them over.",
      });
    }
  }

  await logAudit({ auth, request, action: "team.removed", targetType: "user", summary: `Removed a teammate${reassigned ? ` (${reassigned} candidates reassigned)` : ""}` });
  return NextResponse.json({ ok: true, reassigned });
}, { body: JsonObject, optionalBody: true });

// PATCH { reassignUnassignedTo }: hand every candidate that no current
// member owns (left behind by an earlier removal, or unassigned by hand) to
// one member in a single step. Owner only, like the rest of team management.
export const PATCH = customerRoute(async (request, _context, auth, body) => {
  const { data: agency, error: agencyError } = await supabase
    .from("agencies")
    .select("clerk_org_id")
    .eq("id", auth.agencyId)
    .maybeSingle();
  if (agencyError) {
    return NextResponse.json({ error: "Failed to load your agency." }, { status: 500 });
  }
  // With no org yet there are no teammates, so the caller is the owner.
  if (agency?.clerk_org_id) {
    const ownerCheck = await requireOrgOwner(agency.clerk_org_id, auth.userId);
    if (ownerCheck) return ownerCheck;
  }

  const to = body?.reassignUnassignedTo;
  if (!to || !(await isValidAssignee(supabase, auth.agencyId, to))) {
    return NextResponse.json({ error: "Pick a current team member to take these candidates." }, { status: 400 });
  }

  try {
    const ids = await unassignedCandidateIds(supabase, auth.agencyId);
    const reassigned = await reassignCandidates(supabase, {
      agencyId: auth.agencyId,
      candidateIds: ids,
      toRecruiterId: to,
      actor: recruiterDisplayName(auth.profile) || auth.userId,
    });
    return NextResponse.json({ ok: true, reassigned });
  } catch (err) {
    reportError("[team/invite] Bulk reassignment failed:", err.message);
    return NextResponse.json({ error: "Couldn't reassign those candidates. Please try again." }, { status: 500 });
  }
}, { body: JsonObject, optionalBody: true });
