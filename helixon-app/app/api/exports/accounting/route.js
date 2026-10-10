import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { getAccess } from "@/lib/permissions";
import { logAudit } from "@/lib/agency-audit";
import { payrollRows, quickbooksInvoiceRows, xeroInvoiceRows } from "@/lib/accounting-export";
import { agencyDb } from "@/lib/agency-db";
import { fetchAll } from "@/lib/fetch-all";

// GET ?format=xero|quickbooks|payroll&from=YYYY-MM-DD&to=YYYY-MM-DD
// Invoices (by issue date, drafts and void ones left out) in Xero's or
// QuickBooks' import layout, or approved contractor timesheets (by week) as
// a payroll sheet (lib/accounting-export.js). JSON rows - the page turns
// them into the CSV file. Needs permission to see financials.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Read a page at a time (one select stops at 1,000 rows without saying so);
// past this many, the export asks for a shorter date range rather than
// silently leaving rows out.
const MAX_ROWS = 20000;
const TOO_MANY = "That's more than 20,000 rows - choose a shorter date range.";

export const GET = customerRoute(async (request, _context, auth) => {
  if (!(await getAccess(auth)).canSeeFinancials) return NextResponse.json({ error: "Only the owner and admins can export invoices and pay." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const format = params.get("format");
  const from = DATE_RE.test(params.get("from") || "") ? params.get("from") : null;
  const to = DATE_RE.test(params.get("to") || "") ? params.get("to") : null;

  let rows;
  if (format === "xero" || format === "quickbooks") {
    const db = await agencyDb();
    const { data, error, truncated } = await fetchAll((start, end) => {
      let q = db
        .from("invoices")
        .select("id, number, status, currency, issued_on, due_on, subtotal, vat_rate, vat_amount, total, bill_to, lines")
        .eq("agency_id", auth.agencyId)
        .in("status", ["sent", "paid"])
        .order("issued_on")
        .order("id");
      if (from) q = q.gte("issued_on", from);
      if (to) q = q.lte("issued_on", to);
      return q.range(start, end);
    }, { cap: MAX_ROWS });
    if (error) return NextResponse.json({ error: "Failed to load invoices." }, { status: 500 });
    if (truncated) return NextResponse.json({ error: TOO_MANY }, { status: 400 });
    rows = format === "xero" ? xeroInvoiceRows(data ?? []) : quickbooksInvoiceRows(data ?? []);
  } else if (format === "payroll") {
    const db = await agencyDb();
    const { data, error, truncated } = await fetchAll((start, end) => {
      let q = db
        .from("timesheets")
        .select("id, week_starting, quantity, status, placements(candidate_name, client_name, rate_unit, pay_rate, charge_rate, currency)")
        .eq("agency_id", auth.agencyId)
        .in("status", ["approved", "invoiced"])
        .order("week_starting")
        .order("id");
      if (from) q = q.gte("week_starting", from);
      if (to) q = q.lte("week_starting", to);
      return q.range(start, end);
    }, { cap: MAX_ROWS });
    if (error) return NextResponse.json({ error: "Failed to load timesheets." }, { status: 500 });
    if (truncated) return NextResponse.json({ error: TOO_MANY }, { status: 400 });
    rows = payrollRows(data ?? []);
  } else {
    return NextResponse.json({ error: "Choose xero, quickbooks or payroll." }, { status: 400 });
  }

  await logAudit({ auth, request, action: "accounting.exported", summary: `${format} export${from || to ? ` (${from || "start"} to ${to || "today"})` : ""}: ${rows.length} rows` });
  return NextResponse.json({ rows });
});
