import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { getOrgCreatorId, listOrgMembers } from "@/lib/clerk-org";
import { computePresence } from "@/lib/presence";
import { getAgencyPrivacy } from "@/lib/privacy-settings";

// "Team" is the set of profiles sharing an agency_id. Agency-plan teammates
// join through a Clerk Organization invite (app/api/team/invite), and the
// Clerk webhook attaches their profile to the agency. Each member's role
// ("owner" / "admin" / "member") comes from that org: the owner created it,
// admins are other "org:admin" members (they can manage the team too).
async function rolesFor(agencyId, profiles) {
  const { data: agency } = await supabase.from("agencies").select("clerk_org_id").eq("id", agencyId).maybeSingle();
  // No org yet: nobody has been invited, so a lone member is the owner.
  if (!agency?.clerk_org_id) {
    return new Map(profiles.length === 1 ? [[profiles[0].clerk_user_id, "owner"]] : []);
  }
  const [members, creatorId] = await Promise.all([
    listOrgMembers(agency.clerk_org_id),
    getOrgCreatorId(agency.clerk_org_id).catch(() => null),
  ]);
  const admins = members.filter((m) => m.role === "org:admin");
  // Orgs from before admins existed have exactly one admin - the owner.
  const ownerId = creatorId || (admins.length === 1 ? admins[0].userId : null);
  return new Map(
    members.map((m) => [m.userId, m.userId === ownerId ? "owner" : m.role === "org:admin" ? "admin" : "member"])
  );
}

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId } = auth;

  const [{ data: members, error: membersError }, { data: candidates, error: candidatesError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("clerk_user_id, first_name, last_name, username, last_seen_at, last_active_at, presence_status, presence_message, presence_until, presence_hidden")
      .eq("agency_id", agencyId),
    supabase
      .from("candidates")
      .select("recruiter_id, processing_status, stage, next_action, created_at, last_activity_at")
      .eq("agency_id", agencyId)
      .not("recruiter_id", "is", null),
  ]);

  if (membersError || candidatesError) {
    return NextResponse.json({ error: "Failed to load team" }, { status: 500 });
  }

  // Roles are display-only here (the invite route enforces who can manage
  // the team), so a Clerk hiccup shouldn't take the whole list down.
  let roles = new Map();
  try {
    roles = await rolesFor(agencyId, members ?? []);
  } catch (err) {
    console.error("[team] Failed to load member roles:", err.message);
  }

  // Presence is left out entirely when the agency has switched it off
  // (/dashboard/privacy); hidden people show as hidden with nothing else.
  const { presenceEnabled } = await getAgencyPrivacy(supabase, agencyId).catch(() => ({ presenceEnabled: false }));

  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  return NextResponse.json(
    (members ?? []).map((m) => {
      const owned = (candidates ?? []).filter((c) => c.recruiter_id === m.clerk_user_id);
      const completed = owned.filter((c) => c.processing_status === "completed");
      // Presence (lib/presence.js): raw values so the page can keep it
      // current between refreshes, plus the state worked out now.
      const presenceRaw = !presenceEnabled
        ? null
        : m.presence_hidden
          ? { hidden: true }
          : {
              lastSeenAt: m.last_seen_at,
              lastActiveAt: m.last_active_at,
              status: m.presence_status,
              message: m.presence_message,
              until: m.presence_until,
            };
      const lastWorkedAt = owned.reduce((latest, c) => {
        const t = c.last_activity_at || c.created_at;
        return t && (!latest || t > latest) ? t : latest;
      }, null);
      return {
        id: m.clerk_user_id,
        name: recruiterDisplayName(m) || "Unnamed",
        role: roles.get(m.clerk_user_id) || null,
        presenceRaw,
        presence: presenceRaw ? computePresence(presenceRaw, now) : null,
        // Most recent change to any candidate they own - "what they were
        // last working on", for anyone offline.
        lastWorkedAt,
        screenedToday: owned.filter((c) => c.created_at && new Date(c.created_at) >= startOfDay).length,
        totalCandidates: owned.length,
        activeCandidates: completed.filter((c) => c.stage !== "Placed" && c.stage !== "Rejected").length,
        awaitingReview: completed.filter((c) => c.stage === "Screened" || c.stage === null).length,
        interviewing: completed.filter((c) => c.stage === "Interview").length,
        placed: completed.filter((c) => c.stage === "Placed").length,
        overdue: owned.filter(
          (c) => c.next_action && !c.next_action.completed && c.next_action.dueAt && new Date(c.next_action.dueAt).getTime() < now
        ).length,
      };
    })
  );
}
