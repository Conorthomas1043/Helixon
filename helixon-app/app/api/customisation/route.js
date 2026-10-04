import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { cleanCustomisation, normaliseCustomisation } from "@/lib/custom-fields";

// GET / PUT the agency's pipeline sub-stages and custom fields
// (lib/custom-fields.js). Everyone reads them; the owner or an admin
// changes them. PUT replaces both lists.

export const GET = customerRoute(async (_request, _context, auth) => {
  const [{ data }, canManage] = await Promise.all([
    supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle(),
    canManageWorkspace(auth),
  ]);
  return NextResponse.json({ ...normaliseCustomisation(data?.settings), canManage });
});

export const PUT = customerRoute(async (request, _context, auth, body) => {
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const cleaned = cleanCustomisation(body);
  if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const { data } = await supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle();
  const { error } = await supabase
    .from("agencies")
    .update({ settings: { ...(data?.settings || {}), customisation: cleaned } })
    .eq("id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  return NextResponse.json({ ...cleaned, canManage: true });
}, { body: JsonObject, optionalBody: true });
