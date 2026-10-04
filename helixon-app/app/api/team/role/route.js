import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { getOrgCreatorId, getOrgMemberRole, setOrgMemberRole } from "@/lib/clerk-org";
import { logAudit } from "@/lib/agency-audit";
import { reportError } from "@/lib/report-error";

// POST { userId, role: "admin" | "member" } - make a teammate an admin (can
// invite, remove and reassign, like the owner) or back to a member. Only the
// owner or an admin can do it; the owner's own role never changes, and
// nobody changes their own role here (so a team can't end up with no one
// able to manage it).
export const POST = customerRoute(async (request, _context, auth, body) => {
  const target = typeof body?.userId === "string" ? body.userId : "";
  const role = body?.role === "admin" ? "org:admin" : body?.role === "member" ? "org:member" : null;
  if (!target || !role) {
    return NextResponse.json({ error: "Choose a teammate and a role." }, { status: 400 });
  }
  if (target === auth.userId) {
    return NextResponse.json({ error: "You can't change your own role." }, { status: 400 });
  }

  const { data: agency } = await supabase.from("agencies").select("clerk_org_id").eq("id", auth.agencyId).maybeSingle();
  if (!agency?.clerk_org_id) {
    return NextResponse.json({ error: "Invite a teammate first." }, { status: 404 });
  }
  const orgId = agency.clerk_org_id;

  try {
    const [callerRole, targetRole, creatorId, { data: targetProfile }] = await Promise.all([
      getOrgMemberRole({ orgId, userId: auth.userId }),
      getOrgMemberRole({ orgId, userId: target }),
      getOrgCreatorId(orgId),
      supabase.from("profiles").select("clerk_user_id").eq("clerk_user_id", target).eq("agency_id", auth.agencyId).maybeSingle(),
    ]);
    if (callerRole !== "org:admin") {
      return NextResponse.json({ error: "Only the workspace owner or an admin can change roles." }, { status: 403 });
    }
    if (!targetRole || !targetProfile) {
      return NextResponse.json({ error: "That person isn't on your team." }, { status: 404 });
    }
    if (!creatorId || target === creatorId) {
      return NextResponse.json({ error: "The workspace owner's role can't be changed." }, { status: 400 });
    }
    if (targetRole !== role) {
      await setOrgMemberRole({ orgId, userId: target, role });
    }
    await logAudit({ auth, request, action: "team.role_changed", targetType: "user", targetId: body?.userId ?? null, summary: `Made a teammate ${role === "org:admin" ? "an admin" : "a member"}` });
    return NextResponse.json({ ok: true, role: role === "org:admin" ? "admin" : "member" });
  } catch (err) {
    const detail = err?.errors?.[0]?.longMessage || err.message || "unknown error";
    reportError("[team/role] Failed to change role:", detail);
    return NextResponse.json({ error: "Couldn't change their role. Please try again." }, { status: 500 });
  }
}, { body: JsonObject, optionalBody: true });
