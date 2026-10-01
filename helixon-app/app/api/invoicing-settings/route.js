import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { cleanInvoicing, normaliseInvoicing } from "@/lib/invoicing-settings";

// GET / PATCH the agency's invoice details (lib/invoicing-settings.js).
// Changing them is for the owner or an admin.

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [{ data }, canManage] = await Promise.all([
    supabase.from("agencies").select("name, settings").eq("id", auth.agencyId).maybeSingle(),
    canManageWorkspace(auth),
  ]);
  const inv = normaliseInvoicing(data?.settings);
  return NextResponse.json({ ...inv, companyName: inv.companyName || data?.name || "", canManage });
}

export async function PATCH(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const fields = cleanInvoicing(await request.json().catch(() => ({})));
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  const { data } = await supabase.from("agencies").select("settings").eq("id", auth.agencyId).maybeSingle();
  const { error } = await supabase.from("agencies").update({ settings: { ...(data?.settings || {}), invoicing: fields } }).eq("id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  return NextResponse.json({ ...fields, canManage: true });
}
