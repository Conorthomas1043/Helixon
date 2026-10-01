import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { cleanCustomisation, normaliseCustomisation } from "@/lib/custom-fields";

// GET / PUT the agency's pipeline sub-stages and custom fields
// (lib/custom-fields.js). Everyone reads them; the owner or an admin
// changes them. PUT replaces both lists.

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [{ data }, canManage] = await Promise.all([
    supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle(),
    canManageWorkspace(auth),
  ]);
  return NextResponse.json({ ...normaliseCustomisation(data?.settings), canManage });
}

export async function PUT(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const cleaned = cleanCustomisation(await request.json().catch(() => ({})));
  if (cleaned.error) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const { data } = await supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle();
  const { error } = await supabase
    .from("agencies")
    .update({ settings: { ...(data?.settings || {}), customisation: cleaned } })
    .eq("id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  return NextResponse.json({ ...cleaned, canManage: true });
}
