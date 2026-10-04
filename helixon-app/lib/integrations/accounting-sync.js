// Invoices <-> the agency's connected accounts package (Xero or QuickBooks).

import "server-only";
import { after } from "next/server";
import { supabase } from "@/lib/supabase";
import { emitWebhook } from "@/lib/webhooks";
import { getConnection, updateConnection } from "@/lib/integrations/store";
import { ACCOUNTING_PROVIDERS, invoiceState, pushInvoice } from "@/lib/integrations/accounting";
import { reportError } from "@/lib/report-error";

// The agency's accounting connection (Xero first if, oddly, both), or null.
export async function accountingConnection(agencyId) {
  for (const provider of ACCOUNTING_PROVIDERS) {
    const conn = await getConnection(agencyId, provider);
    if (conn) return conn;
  }
  return null;
}

// Marks a Helixon invoice paid when the accounts package says it is.
// Resolves the invoice's new status, or null when nothing changed.
async function applyState(invoice, state) {
  if (!state.paid || invoice.status === "paid" || invoice.status === "void") return null;
  const paidOn = state.paidOn || new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_on: paidOn, external_synced_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .eq("agency_id", invoice.agency_id)
    .select("id, number, status, paid_on, total, currency, client_id, placement_id")
    .maybeSingle();
  if (data) after(() => emitWebhook(invoice.agency_id, "invoice.paid", data));
  return data ? "paid" : null;
}

// Push an invoice that isn't in the accounts package yet, or refresh the
// payment status of one that is. Resolves { provider, externalId, status }.
export async function syncInvoice(conn, invoice) {
  if (invoice.external_id && invoice.external_provider === conn.provider) {
    const state = await invoiceState(conn, invoice.external_id);
    const changed = await applyState(invoice, state);
    await supabase.from("invoices").update({ external_synced_at: new Date().toISOString() }).eq("id", invoice.id);
    return { provider: conn.provider, externalId: invoice.external_id, status: changed || invoice.status };
  }
  if (invoice.status === "void" || invoice.status === "draft") throw new Error("Only sent or paid invoices go to your accounts.");
  const externalId = await pushInvoice(conn, invoice);
  const { error } = await supabase
    .from("invoices")
    .update({ external_provider: conn.provider, external_id: String(externalId).slice(0, 200), external_synced_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .eq("agency_id", invoice.agency_id);
  if (error) reportError("[accounting] Pushed but not recorded:", invoice.id, error.message);
  return { provider: conn.provider, externalId, status: invoice.status };
}

// Daily: every unpaid pushed invoice of the agency, checked for payment.
export async function syncAgencyPayments(conn, { limit = 200 } = {}) {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("agency_id", conn.agency_id)
    .eq("external_provider", conn.provider)
    .not("external_id", "is", null)
    .eq("status", "sent")
    .order("external_synced_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  let paid = 0;
  for (const invoice of invoices ?? []) {
    try {
      const res = await syncInvoice(conn, invoice);
      if (res.status === "paid") paid += 1;
    } catch (err) {
      await updateConnection(conn.id, { last_error: String(err.message).slice(0, 1000) });
      if (/connect it again/.test(err.message)) break;
    }
  }
  await updateConnection(conn.id, { last_synced_at: new Date().toISOString() });
  return { checked: invoices?.length ?? 0, paid };
}
