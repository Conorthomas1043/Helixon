import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { cleanInvoicing, normaliseInvoicing } from "@/lib/invoicing-settings";
import { logAudit } from "@/lib/agency-audit";

// GET / PATCH the agency's invoice details (lib/invoicing-settings.js).
// Changing them is for the owner or an admin.

export const GET = customerRoute(async (_request, _context, auth) => {
  const [{ data }, canManage] = await Promise.all([
    supabase.from("agencies").select("name, settings").eq("id", auth.agencyId).maybeSingle(),
    canManageWorkspace(auth),
  ]);
  const inv = normaliseInvoicing(data?.settings);
  return NextResponse.json({ ...inv, companyName: inv.companyName || data?.name || "", canManage });
});

export const PATCH = customerRoute(async (request, _context, auth, body) => {
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const fields = cleanInvoicing(body);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  const { data } = await supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle();
  const { error } = await supabase.from("agencies").update({ settings: { ...(data?.settings || {}), invoicing: fields } }).eq("id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  await logAudit({ auth, request, action: "settings.invoicing", summary: "Changed invoicing settings" });
  return NextResponse.json({ ...fields, canManage: true });
}, { body: JsonObject, optionalBody: true });
