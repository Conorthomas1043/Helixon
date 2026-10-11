import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { fields, num, text } from "@/lib/api/schemas";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/agency/workspace-admin";
import { cleanInvoicing, normaliseInvoicing } from "@/lib/placements/invoicing-settings";
import { logAudit } from "@/lib/agency/audit";
import { mergeAgencySettings } from "@/lib/agency/settings";

// cleanInvoicing (lib/placements/invoicing-settings.js) reads these.
const InvoicingInput = fields({
  companyName: text(400),
  address: text(1000),
  vatNumber: text(80),
  companyNumber: text(80),
  email: text(320),
  bankDetails: text(1000),
  prefix: text(20),
  vatRate: num,
  paymentTermsDays: num,
});

// GET / PATCH the agency's invoice details (lib/placements/invoicing-settings.js).
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
  const { error } = await mergeAgencySettings(supabase, auth.agencyId, { invoicing: fields });
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  await logAudit({ auth, request, action: "settings.invoicing", summary: "Changed invoicing settings" });
  return NextResponse.json({ ...fields, canManage: true });
}, { body: InvoicingInput, optionalBody: true });
