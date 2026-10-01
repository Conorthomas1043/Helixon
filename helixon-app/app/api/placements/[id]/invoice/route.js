import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logClientActivity } from "@/lib/clients";
import { cleanText, cleanUuid } from "@/lib/sanitize";
import { addDays, invoiceTotals, nextInvoiceNumber } from "@/lib/placements";
import { normaliseInvoicing } from "@/lib/invoicing-settings";

// POST { timesheetIds?, notes? } - raise an invoice for a placement.
// Permanent: one line, the placement fee. Contract: a line per approved
// timesheet (hours/days x charge rate), which are then marked invoiced.
// Numbered from the agency's prefix; VAT and due date from its invoice
// settings (and the client's payment terms, when set).

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = cleanUuid((await params).id);
  const { data: p } = id
    ? await supabase.from("placements").select("*, clients(name, address, payment_terms_days)").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle()
    : { data: null };
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));

  const [{ data: agency }, { data: numbers }, { data: contact }] = await Promise.all([
    supabase.from("agencies").select("name, settings").eq("id", auth.agencyId).maybeSingle(),
    supabase.from("invoices").select("number").eq("agency_id", auth.agencyId).limit(10000),
    p.client_id
      ? supabase.from("client_contacts").select("name, email").eq("client_id", p.client_id).order("is_primary", { ascending: false }).limit(1).maybeSingle()
      : { data: null },
  ]);
  const settings = normaliseInvoicing(agency?.settings);

  let lines;
  let timesheetIds = [];
  if (p.kind === "permanent") {
    if (!p.fee_amount) return NextResponse.json({ error: "Add the fee (or salary and fee %) first." }, { status: 400 });
    const { count } = await supabase.from("invoices").select("id", { count: "exact", head: true }).eq("placement_id", p.id).neq("status", "void");
    if (count) return NextResponse.json({ error: "This placement has already been invoiced - void that invoice to raise a new one." }, { status: 409 });
    const basis = p.salary && p.fee_percent ? ` (${p.fee_percent}% of ${Number(p.salary).toLocaleString("en-GB")} salary)` : "";
    lines = [{ description: `Permanent placement: ${p.candidate_name} as ${p.job_title || "role"}${p.start_date ? `, starting ${p.start_date}` : ""}${basis}`, quantity: 1, unitPrice: Number(p.fee_amount) }];
  } else {
    if (!p.charge_rate) return NextResponse.json({ error: "Add the charge rate first." }, { status: 400 });
    let q = supabase.from("timesheets").select("id, week_starting, quantity").eq("placement_id", p.id).eq("status", "approved").order("week_starting");
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
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      agency_id: auth.agencyId,
      client_id: p.client_id,
      placement_id: p.id,
      number: nextInvoiceNumber((numbers ?? []).map((n) => n.number), settings.prefix),
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
    .select("id, number, total")
    .single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "Another invoice took that number - try again." : "Failed to raise the invoice." }, { status: 500 });

  if (timesheetIds.length) await supabase.from("timesheets").update({ status: "invoiced", invoice_id: invoice.id }).in("id", timesheetIds);
  if (p.client_id) {
    await logClientActivity(auth.agencyId, p.client_id, "invoice_sent", recruiterDisplayName(auth.profile) || auth.userId, { note: `${invoice.number}: ${invoice.total}` });
  }
  return NextResponse.json({ invoice }, { status: 201 });
}
