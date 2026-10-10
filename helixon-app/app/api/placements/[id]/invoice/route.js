import { NextResponse, after } from "next/server";
import { emitWebhook } from "@/lib/webhooks";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logClientActivity } from "@/lib/clients";
import { cleanText, cleanUuid } from "@/lib/sanitize";
import { addDays, invoiceTotals, nextInvoiceNumber } from "@/lib/placements";
import { normaliseInvoicing } from "@/lib/invoicing-settings";
import { getAccess } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";
import { fetchAll } from "@/lib/fetch-all";
import { reportError } from "@/lib/report-error";
import { acquireLock, releaseLock } from "@/lib/ratelimit";

// POST { timesheetIds?, notes? } - raise an invoice for a placement.
// Permanent: one line, the placement fee. Contract: a line per approved
// timesheet (hours/days x charge rate), which are then marked invoiced.
// Numbered from the agency's prefix; VAT and due date from its invoice
// settings (and the client's payment terms, when set).

export const POST = customerRoute(async (request, { params }, auth, body) => {
  if (!(await getAccess(auth)).canSeeFinancials) return NextResponse.json({ error: "Invoices are only visible to the owner and admins." }, { status: 403 });
  const id = cleanUuid((await params).id);
  const { data: p } = id
    ? await (await agencyDb()).from("placements").select("*, clients(name, address, payment_terms_days)").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle()
    : { data: null };
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // One invoice at a time per placement: the "already invoiced" checks
  // below and the insert aren't one transaction, so two clicks could
  // otherwise both pass and bill the same fee or timesheets twice.
  const lock = `invoice:${p.id}`;
  if (!(await acquireLock(lock, 60))) return NextResponse.json({ error: "This placement is already being invoiced." }, { status: 409 });
  try {
    return await raiseInvoice(auth, p, body);
  } finally {
    await releaseLock(lock);
  }
}, { body: JsonObject, optionalBody: true });

// Every invoice number the agency has used. All of them: one plain select
// stops at 1,000 rows, after which the next number collided with an
// existing one on every attempt.
async function invoiceNumbers(agencyId) {
  const db = await agencyDb();
  const { data, error } = await fetchAll((from, to) => db.from("invoices").select("number, id").eq("agency_id", agencyId).order("id").range(from, to));
  if (error) throw new Error(error.message);
  return (data ?? []).map((n) => n.number);
}

async function raiseInvoice(auth, p, body) {
  const [{ data: agency }, { data: contact }] = await Promise.all([
    supabase.from("agencies").select("name, settings").eq("id", auth.agencyId).maybeSingle(),
    p.client_id
      ? (await agencyDb()).from("client_contacts").select("name, email").eq("client_id", p.client_id).order("is_primary", { ascending: false }).limit(1).maybeSingle()
      : { data: null },
  ]);
  const settings = normaliseInvoicing(agency?.settings);

  let lines;
  let timesheetIds = [];
  if (p.kind === "permanent") {
    if (!p.fee_amount) return NextResponse.json({ error: "Add the fee (or salary and fee %) first." }, { status: 400 });
    const { count } = await (await agencyDb()).from("invoices").select("id", { count: "exact", head: true }).eq("placement_id", p.id).neq("status", "void");
    if (count) return NextResponse.json({ error: "This placement has already been invoiced - void that invoice to raise a new one." }, { status: 409 });
    const basis = p.salary && p.fee_percent ? ` (${p.fee_percent}% of ${Number(p.salary).toLocaleString("en-GB")} salary)` : "";
    lines = [{ description: `Permanent placement: ${p.candidate_name} as ${p.job_title || "role"}${p.start_date ? `, starting ${p.start_date}` : ""}${basis}`, quantity: 1, unitPrice: Number(p.fee_amount) }];
  } else {
    if (!p.charge_rate) return NextResponse.json({ error: "Add the charge rate first." }, { status: 400 });
    let q = (await agencyDb()).from("timesheets").select("id, week_starting, quantity").eq("placement_id", p.id).eq("status", "approved").order("week_starting");
    const wanted = (Array.isArray(body.timesheetIds) ? body.timesheetIds : []).map(cleanUuid).filter(Boolean);
    if (wanted.length) q = q.in("id", wanted);
    const { data: sheets } = await q;
    if (!sheets?.length) return NextResponse.json({ error: "There are no approved timesheets to invoice." }, { status: 400 });
    timesheetIds = sheets.map((t) => t.id);
    lines = sheets.map((t) => ({
      description: `${p.candidate_name}, week starting ${t.week_starting} (${Number(t.quantity)} ${p.rate_unit === "day" ? "days" : "hours"})`,
      quantity: Number(t.quantity),
      unitPrice: Number(p.charge_rate),
    }));
  }

  const totals = invoiceTotals(lines, settings.vatRate);
  const today = new Date().toISOString().slice(0, 10);
  const terms = p.clients?.payment_terms_days ?? settings.paymentTermsDays;
  // Another invoice raised at the same moment (or by a different
  // placement) can take the number first: read again and retry.
  let invoice = null;
  let error = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const number = nextInvoiceNumber(await invoiceNumbers(auth.agencyId), settings.prefix);
    ({ data: invoice, error } = await (await agencyDb())
      .from("invoices")
      .insert({
        agency_id: auth.agencyId,
        client_id: p.client_id,
        placement_id: p.id,
        number,
        status: "sent",
        currency: p.currency,
        issued_on: today,
        due_on: addDays(today, terms),
        bill_to: { name: p.clients?.name || p.client_name || "", address: p.clients?.address || "", contact: contact?.name || null, email: contact?.email || null },
        lines: totals.lines,
        subtotal: totals.subtotal,
        vat_rate: settings.vatRate,
        vat_amount: totals.vatAmount,
        total: totals.total,
        notes: cleanText(body.notes, { max: 2000 }) || null,
        created_by: auth.userId,
      })
      .select("id, number, total, subtotal, vat_amount, currency, issued_on, due_on, client_id, placement_id, bill_to")
      .single());
    if (error?.code !== "23505") break;
  }
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Another invoice took that number - try again." : "Failed to raise the invoice." }, { status: 500 });

  if (timesheetIds.length) {
    const { error: sheetError } = await (await agencyDb()).from("timesheets").update({ status: "invoiced", invoice_id: invoice.id }).eq("placement_id", p.id).eq("status", "approved").in("id", timesheetIds);
    if (sheetError) reportError("[invoice] Raised, but couldn't mark the timesheets invoiced:", sheetError.message);
  }
  if (p.client_id) {
    await logClientActivity(auth.agencyId, p.client_id, "invoice_sent", recruiterDisplayName(auth.profile) || auth.userId, { note: `${invoice.number}: ${invoice.total}` });
  }
  after(() => emitWebhook(auth.agencyId, "invoice.created", invoice));
  return NextResponse.json({ invoice: { id: invoice.id, number: invoice.number, total: invoice.total } }, { status: 201 });
}
