import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { INVOICE_STATUSES } from "@/lib/placements";
import { getAccess } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

// GET ?status= - the agency's invoices, newest first.
export const GET = customerRoute(async (request, _context, auth) => {
  if (!(await getAccess(auth)).canSeeFinancials) return NextResponse.json({ error: "Invoices are only visible to the owner and admins." }, { status: 403 });
  const status = new URL(request.url).searchParams.get("status");
  let q = (await agencyDb())
    .from("invoices")
    .select("id, number, status, currency, issued_on, due_on, paid_on, subtotal, vat_amount, total, bill_to, placement_id, client_id")
    .eq("agency_id", auth.agencyId)
    .order("issued_on", { ascending: false })
    .limit(2000);
  if (INVOICE_STATUSES[status]) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: "Failed to load invoices." }, { status: 500 });
  return NextResponse.json({ invoices: data ?? [] });
});
