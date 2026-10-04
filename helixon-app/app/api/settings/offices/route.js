import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { cleanOffices, normaliseOffices } from "@/lib/offices";
import { logAudit } from "@/lib/agency-audit";
import { agencyDb } from "@/lib/agency-db";

// Offices or brands (lib/offices.js).
// GET  { offices, memberOffices, canManage }
// PUT  { offices: [{ id?, name }], memberOffices }   owner or admin. Jobs in
//      an office that's removed are left without one.

export const GET = customerRoute(async (_request, _context, auth) => {
  const [{ data }, canManage] = await Promise.all([
    supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle(),
    canManageWorkspace(auth),
  ]);
  return NextResponse.json({ ...normaliseOffices(data?.settings), canManage });
});

export const PUT = customerRoute(async (request, _context, auth, body) => {
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const cleaned = cleanOffices(body);
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
  if (removed.length) await (await agencyDb()).from("jobs").update({ office_id: null }).eq("agency_id", auth.agencyId).in("office_id", removed);
  await logAudit({ auth, request, action: "settings.offices", summary: `Offices: ${cleaned.offices.map((o) => o.name).join(", ") || "none"}` });
  return NextResponse.json({ ...cleaned, canManage: true });
}, { body: JsonObject, optionalBody: true });
