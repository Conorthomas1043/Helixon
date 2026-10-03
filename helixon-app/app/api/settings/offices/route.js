import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { cleanOffices, normaliseOffices } from "@/lib/offices";
import { logAudit } from "@/lib/agency-audit";

// Offices or brands (lib/offices.js).
// GET  { offices, memberOffices, canManage }
// PUT  { offices: [{ id?, name }], memberOffices }   owner or admin. Jobs in
//      an office that's removed are left without one.

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [{ data }, canManage] = await Promise.all([
    supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle(),
    canManageWorkspace(auth),
  ]);
  return NextResponse.json({ ...normaliseOffices(data?.settings), canManage });
}

export async function PUT(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const cleaned = cleanOffices(await request.json().catch(() => ({})));
  if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });

  const { data } = await supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle();
  const settings = data?.settings || {};
  const before = normaliseOffices(settings).offices;
  const { error } = await supabase
    .from("agencies")
    .update({ settings: { ...settings, offices: cleaned.offices, memberOffices: cleaned.memberOffices } })
    .eq("id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });

  const kept = new Set(cleaned.offices.map((o) => o.id));
  const removed = before.filter((o) => !kept.has(o.id)).map((o) => o.id);
  if (removed.length) await supabase.from("jobs").update({ office_id: null }).eq("agency_id", auth.agencyId).in("office_id", removed);
  await logAudit({ auth, request, action: "settings.offices", summary: `Offices: ${cleaned.offices.map((o) => o.name).join(", ") || "none"}` });
  return NextResponse.json({ ...cleaned, canManage: true });
}
