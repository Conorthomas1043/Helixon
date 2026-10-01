import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { INVOICE_STATUSES } from "@/lib/placements";

// GET ?status= - the agency's invoices, newest first.
export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const status = new URL(request.url).searchParams.get("status");
  let q = supabase
    .from("invoices")
    .select("id, number, status, currency, issued_on, due_on, paid_on, subtotal, vat_amount, total, bill_to, placement_id, client_id")
    .eq("agency_id", auth.agencyId)
    .order("issued_on", { ascending: false })
    .limit(2000);
  if (INVOICE_STATUSES[status]) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Failed to load invoices." }, { status: 500 });
  return NextResponse.json({ invoices: data ?? [] });
}
