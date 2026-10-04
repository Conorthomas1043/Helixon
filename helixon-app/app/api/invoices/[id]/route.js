import { NextResponse, after } from "next/server";
import { emitWebhook } from "@/lib/webhooks";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanUuid } from "@/lib/sanitize";
import { INVOICE_STATUSES } from "@/lib/placements";
import { normaliseInvoicing } from "@/lib/invoicing-settings";
import { logAudit } from "@/lib/agency-audit";
import { getAccess } from "@/lib/permissions";
import { accountingConnection } from "@/lib/integrations/accounting-sync";
import { providerFor } from "@/lib/integrations/providers";
import { agencyDb } from "@/lib/agency-db";

// GET   one invoice with the agency's invoice details (for printing) and
//       the connected accounts package, if any
// PATCH { status, paidOn? }   mark paid / sent / void. Voiding a contract
//       invoice puts its timesheets back to approved.

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await getAccess(auth)).canSeeFinancials) return NextResponse.json({ error: "Invoices are only visible to the owner and admins." }, { status: 403 });
  const id = cleanUuid((await params).id);
  const [{ data: invoice }, { data: agency }] = await Promise.all([
    id ? (await agencyDb()).from("invoices").select("*").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle() : { data: null },
    supabase.from("agencies").select("name, settings").eq("id", auth.agencyId).maybeSingle(),
  ]);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const from = normaliseInvoicing(agency?.settings);
  // The connected Xero / QuickBooks, for the "Send to …" button.
  const conn = await accountingConnection(auth.agencyId);
  const accounting = conn ? { provider: conn.provider, label: providerFor(conn.provider).label } : null;
  return NextResponse.json({ invoice, accounting, from: { ...from, companyName: from.companyName || agency?.name || "" } });
}

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await getAccess(auth)).canSeeFinancials) return NextResponse.json({ error: "Invoices are only visible to the owner and admins." }, { status: 403 });
  const id = cleanUuid((await params).id);
  const body = await request.json().catch(() => ({}));
  if (!id || !INVOICE_STATUSES[body.status] || body.status === "draft") return NextResponse.json({ error: "Mark it sent, paid or void." }, { status: 400 });
  const paidOn = body.status === "paid" ? (/^\d{4}-\d{2}-\d{2}$/.test(body.paidOn || "") ? body.paidOn : new Date().toISOString().slice(0, 10)) : null;
  const { data, error } = await (await agencyDb())
    .from("invoices")
    .update({ status: body.status, paid_on: paidOn })
    .eq("id", id)
    .eq("agency_id", auth.agencyId)
    .select("id, number, status, paid_on, total, currency, client_id, placement_id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to update." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body.status === "paid") after(() => emitWebhook(auth.agencyId, "invoice.paid", data));
  if (body.status === "void") {
    await (await agencyDb()).from("timesheets").update({ status: "approved", invoice_id: null }).eq("invoice_id", id).eq("agency_id", auth.agencyId);
  }
  await logAudit({ auth, request, action: "invoice.status", targetType: "invoice", targetId: data.id, summary: `Invoice ${data.number || ""} marked ${body.status}` });
  return NextResponse.json({ invoice: data });
}
