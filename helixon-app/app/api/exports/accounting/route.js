import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { getAccess } from "@/lib/permissions";
import { logAudit } from "@/lib/agency-audit";
import { payrollRows, quickbooksInvoiceRows, xeroInvoiceRows } from "@/lib/accounting-export";
import { agencyDb } from "@/lib/agency-db";

// GET ?format=xero|quickbooks|payroll&from=YYYY-MM-DD&to=YYYY-MM-DD
// Invoices (by issue date, drafts and void ones left out) in Xero's or
// QuickBooks' import layout, or approved contractor timesheets (by week) as
// a payroll sheet (lib/accounting-export.js). JSON rows - the page turns
// them into the CSV file. Needs permission to see financials.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const GET = customerRoute(async (request, _context, auth) => {
  if (!(await getAccess(auth)).canSeeFinancials) return NextResponse.json({ error: "Only the owner and admins can export invoices and pay." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const format = params.get("format");
  const from = DATE_RE.test(params.get("from") || "") ? params.get("from") : null;
  const to = DATE_RE.test(params.get("to") || "") ? params.get("to") : null;

  let rows;
  if (format === "xero" || format === "quickbooks") {
    let q = (await agencyDb())
      .from("invoices")
      .select("number, status, currency, issued_on, due_on, subtotal, vat_rate, vat_amount, total, bill_to, lines")
      .eq("agency_id", auth.agencyId)
      .in("status", ["sent", "paid"])
      .order("issued_on")
      .limit(5000);
    if (from) q = q.gte("issued_on", from);
    if (to) q = q.lte("issued_on", to);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: "Failed to load invoices." }, { status: 500 });
    rows = format === "xero" ? xeroInvoiceRows(data ?? []) : quickbooksInvoiceRows(data ?? []);
  } else if (format === "payroll") {
    let q = (await agencyDb())
      .from("timesheets")
      .select("week_starting, quantity, status, placements(candidate_name, client_name, rate_unit, pay_rate, charge_rate, currency)")
      .eq("agency_id", auth.agencyId)
      .in("status", ["approved", "invoiced"])
      .order("week_starting")
      .limit(10000);
    if (from) q = q.gte("week_starting", from);
    if (to) q = q.lte("week_starting", to);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: "Failed to load timesheets." }, { status: 500 });
    rows = payrollRows(data ?? []);
  } else {
    return NextResponse.json({ error: "Choose xero, quickbooks or payroll." }, { status: 400 });
  }

  await logAudit({ auth, request, action: "accounting.exported", summary: `${format} export${from || to ? ` (${from || "start"} to ${to || "today"})` : ""}: ${rows.length} rows` });
  return NextResponse.json({ rows });
});
