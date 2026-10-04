import { NextResponse } from "next/server";
import { timingSafeEqualStr } from "@/lib/timing-safe";
import { supabase } from "@/lib/supabase";
import { syncAgencyPayments } from "@/lib/integrations/accounting-sync";
import { syncMailbox } from "@/lib/integrations/mailbox";
import { integrationReady } from "@/lib/integrations/store";
import { reportError } from "@/lib/report-error";

// Daily: invoices sent to Xero / QuickBooks are checked for payment (and
// marked paid here), and every connected mailbox is synced - mailboxes also
// sync when their owner opens the dashboard, this catches the rest.
//
// Called by Vercel Cron (vercel.json) with `Authorization: Bearer
// <CRON_SECRET>` - same fail-closed check as app/api/cron/reminders.

export const maxDuration = 300;

const BUDGET_MS = 240000;

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  if (!secret || !timingSafeEqualStr(header, `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const started = Date.now();
  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("*")
    .order("last_synced_at", { ascending: true, nullsFirst: true })
    .limit(500);
  if (error) return NextResponse.json({ ok: true, skipped: "integration_connections unavailable" });

  const summary = { accounting: 0, invoicesPaid: 0, mailboxes: 0, emailsFiled: 0, errors: 0, stoppedEarly: false };
  for (const conn of connections ?? []) {
    if (Date.now() - started > BUDGET_MS) {
      summary.stoppedEarly = true;
      break;
    }
    if (!integrationReady(conn.provider)) continue;
    try {
      if (conn.provider === "xero" || conn.provider === "quickbooks") {
        const res = await syncAgencyPayments(conn);
        summary.accounting += 1;
        summary.invoicesPaid += res.paid;
      } else {
        const res = await syncMailbox(conn);
        summary.mailboxes += 1;
        summary.emailsFiled += res.filed;
      }
    } catch (err) {
      summary.errors += 1;
      reportError("[cron/integrations]", conn.provider, conn.id, err?.message);
    }
  }
  return NextResponse.json({ ok: true, ...summary });
}
