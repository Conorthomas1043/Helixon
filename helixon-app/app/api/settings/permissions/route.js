import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { cleanPermissions, getAccess, normalisePermissions } from "@/lib/permissions";
import { logAudit } from "@/lib/agency-audit";

// GET    the workspace's permissions (lib/permissions.js) and what the
//        signed-in member can see
// PATCH  change them - owner or admin only

export const GET = customerRoute(async (_request, _context, auth) => {
  const [access, canManage] = await Promise.all([getAccess(auth), canManageWorkspace(auth)]);
  return NextResponse.json({ permissions: access.permissions, canManage, canSeeFinancials: access.canSeeFinancials, seesAllCandidates: access.seesAllCandidates });
});

export const PATCH = customerRoute(async (request, _context, auth, body) => {
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const changes = cleanPermissions(body);
  if (!Object.keys(changes).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  const { data } = await supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle();
  const settings = data?.settings || {};
  const permissions = { ...normalisePermissions(settings), ...changes };
  const { error } = await supabase.from("agencies").update({ settings: { ...settings, permissions } }).eq("id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  await logAudit({
    auth,
    request,
    action: "settings.permissions",
    summary: Object.entries(changes).map(([k, v]) => `${k === "financialsAdminOnly" ? "Financials admin-only" : "Own candidates only"}: ${v ? "on" : "off"}`).join(", "),
  });
  return NextResponse.json({ permissions, canManage: true });
}, { body: JsonObject, optionalBody: true });
