import { NextResponse, after } from "next/server";
import { emitWebhook } from "@/lib/webhooks";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanUuid } from "@/lib/sanitize";
import { INVOICE_STATUSES } from "@/lib/placements";
import { normaliseInvoicing } from "@/lib/invoicing-settings";

// GET   one invoice with the agency's invoice details (for printing)
// PATCH { status, paidOn? }   mark paid / sent / void. Voiding a contract
//       invoice puts its timesheets back to approved.

export async function GET(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = cleanUuid((await params).id);
  const [{ data: invoice }, { data: agency }] = await Promise.all([
    id ? supabase.from("invoices").select("*").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle() : { data: null },
    supabase.from("agencies").select("name, settings").eq("id", auth.agencyId).maybeSingle(),
  ]);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const from = normaliseInvoicing(agency?.settings);
  return NextResponse.json({ invoice, from: { ...from, companyName: from.companyName || agency?.name || "" } });
}

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = cleanUuid((await params).id);
  const body = await request.json().catch(() => ({}));
  if (!id || !INVOICE_STATUSES[body.status] || body.status === "draft") return NextResponse.json({ error: "Mark it sent, paid or void." }, { status: 400 });
  const paidOn = body.status === "paid" ? (/^\d{4}-\d{2}-\d{2}$/.test(body.paidOn || "") ? body.paidOn : new Date().toISOString().slice(0, 10)) : null;
  const { data, error } = await supabase
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
    await supabase.from("timesheets").update({ status: "approved", invoice_id: null }).eq("invoice_id", id).eq("agency_id", auth.agencyId);
  }
  return NextResponse.json({ invoice: data });
}
