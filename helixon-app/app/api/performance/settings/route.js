import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { cleanCommission, cleanTargets, normalisePerformance } from "@/lib/performance";
import { logAudit } from "@/lib/agency-audit";

// GET / PUT the agency's monthly targets and commission plan
// (lib/performance.js). Owner and admins only - commission is private.

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const [{ data: agency }, { data: members }] = await Promise.all([
    supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle(),
    supabase.from("profiles").select("clerk_user_id, first_name, last_name, username").eq("agency_id", auth.agencyId),
  ]);
  return NextResponse.json({
    ...normalisePerformance(agency?.settings),
    people: (members ?? []).map((m) => ({ id: m.clerk_user_id, name: recruiterDisplayName(m) || "Teammate" })),
  });
}

export async function PUT(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const commission = cleanCommission(body.commission || {});
  if (commission.error) return NextResponse.json({ error: commission.error }, { status: 400 });
  const performance = { targets: cleanTargets(body.targets || {}), commission };
  const { data } = await supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle();
  const { error } = await supabase.from("agencies").update({ settings: { ...(data?.settings || {}), performance } }).eq("id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  await logAudit({ auth, request, action: "settings.performance", summary: "Changed targets or commission" });
  return NextResponse.json(performance);
}
