import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanUuid } from "@/lib/sanitize";
import { getAccess } from "@/lib/permissions";
import { logAudit } from "@/lib/agency-audit";
import { providerFor } from "@/lib/integrations/providers";
import { accountingConnection, syncInvoice } from "@/lib/integrations/accounting-sync";
import { agencyDb } from "@/lib/agency-db";

// POST   send this invoice to the connected Xero / QuickBooks, or - if it's
//        already there - check whether it's been paid
//        (lib/integrations/accounting-sync.js)

export const maxDuration = 60;

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await getAccess(auth)).canSeeFinancials) return NextResponse.json({ error: "Invoices are only visible to the owner and admins." }, { status: 403 });
  const id = cleanUuid((await params).id);
  const { data: invoice } = id ? await (await agencyDb()).from("invoices").select("*").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle() : { data: null };
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const conn = await accountingConnection(auth.agencyId);
  if (!conn) return NextResponse.json({ error: "Connect Xero or QuickBooks in Settings → Integrations first." }, { status: 409 });
  const label = providerFor(conn.provider).label;
  const pushing = !(invoice.external_id && invoice.external_provider === conn.provider);
  try {
    const result = await syncInvoice(conn, invoice);
    if (pushing) {
      await logAudit({ auth, request, action: "invoice.pushed", targetType: "invoice", targetId: invoice.id, summary: `Invoice ${invoice.number || ""} sent to ${label}` });
    }
    return NextResponse.json({ ...result, pushed: pushing, label });
  } catch (err) {
    return NextResponse.json({ error: `${label}: ${err.message}` }, { status: 502 });
  }
}
