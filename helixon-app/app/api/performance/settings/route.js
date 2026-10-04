import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { cleanCommission, cleanTargets, normalisePerformance } from "@/lib/performance";
import { logAudit } from "@/lib/agency-audit";

// GET / PUT the agency's monthly targets and commission plan
// (lib/performance.js). Owner and admins only - commission is private.

export const GET = customerRoute(async (_request, _context, auth) => {
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const [{ data: agency }, { data: members }] = await Promise.all([
    supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle(),
    supabase.from("profiles").select("clerk_user_id, first_name, last_name, username").eq("agency_id", auth.agencyId),
  ]);
  return NextResponse.json({
    ...normalisePerformance(agency?.settings),
    people: (members ?? []).map((m) => ({ id: m.clerk_user_id, name: recruiterDisplayName(m) || "Teammate" })),
  });
});

export const PUT = customerRoute(async (request, _context, auth, body) => {
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const commission = cleanCommission(body.commission || {});
  if (commission.error) return NextResponse.json({ error: commission.error }, { status: 400 });
  const performance = { targets: cleanTargets(body.targets || {}), commission };
  const { data } = await supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle();
  const { error } = await supabase.from("agencies").update({ settings: { ...(data?.settings || {}), performance } }).eq("id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  await logAudit({ auth, request, action: "settings.performance", summary: "Changed targets or commission" });
  return NextResponse.json(performance);
}, { body: JsonObject, optionalBody: true });
