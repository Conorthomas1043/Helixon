import { NextResponse, after } from "next/server";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { getAccess } from "@/lib/permissions";
import { logAudit } from "@/lib/agency-audit";
import { siteUrl } from "@/lib/mailer";
import { PROVIDERS, providerFor } from "@/lib/integrations/providers";
import { getConnection, integrationReady, publicConnection, removeConnection } from "@/lib/integrations/store";
import { syncAgencyPayments } from "@/lib/integrations/accounting-sync";
import { MAILBOX_PROVIDERS, syncMailbox } from "@/lib/integrations/mailbox";
import { smsConfigured, smsWebhookUrl } from "@/lib/sms";
import { reportError } from "@/lib/report-error";

// The services a workspace can connect (lib/integrations/providers.js).
// GET                                 each one: set up? connected (to what)?
// DELETE ?provider=                   disconnect (Xero / QuickBooks: owner or admin)
// POST { action: "sync", provider }   sync now
// POST { action: "auto" }             the dashboard's background sync of your
//                                     mailbox - only if it's been 15 minutes

export const maxDuration = 120;

const AUTO_EVERY_MS = 15 * 60000;

export const GET = customerRoute(async (_request, _context, auth) => {
  const canManage = await canManageWorkspace(auth);
  const providers = await Promise.all(
    Object.entries(PROVIDERS).map(async ([name, p]) => ({
      provider: name,
      label: p.label,
      scope: p.scope,
      configured: integrationReady(name),
      connection: publicConnection(await getConnection(auth.agencyId, name, auth.userId)),
    }))
  );
  return NextResponse.json({
    providers,
    canManage,
    sms: { configured: smsConfigured(), webhookUrl: smsWebhookUrl() },
    site: siteUrl(),
  });
});

export const DELETE = customerRoute(async (request, _context, auth) => {
  const provider = new URL(request.url).searchParams.get("provider");
  const p = providerFor(provider);
  if (!p) return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  if (p.scope === "agency" && !(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  try {
    const removed = await removeConnection(auth.agencyId, provider, auth.userId);
    if (removed) await logAudit({ auth, request, action: "integration.disconnected", targetType: "integration", targetId: provider, summary: `${p.label} disconnected` });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Couldn't disconnect - try again." }, { status: 500 });
  }
});

export const POST = customerRoute(async (request, _context, auth, input) => {
  const body = input;

  if (body.action === "auto") {
    for (const provider of MAILBOX_PROVIDERS) {
      if (!integrationReady(provider)) continue;
      const conn = await getConnection(auth.agencyId, provider, auth.userId);
      if (!conn) continue;
      if (Date.now() - new Date(conn.last_synced_at || 0).getTime() < AUTO_EVERY_MS) continue;
      after(() => syncMailbox(conn).catch((err) => reportError("[integrations] auto sync failed:", err?.message)));
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action !== "sync") return NextResponse.json({ error: "Nothing to do." }, { status: 400 });
  const p = providerFor(body.provider);
  if (!p) return NextResponse.json({ error: "Unknown service." }, { status: 400 });
  if (p.scope === "agency" && !(await getAccess(auth)).canSeeFinancials) return NextResponse.json({ error: "Invoices are only visible to the owner and admins." }, { status: 403 });
  const conn = await getConnection(auth.agencyId, body.provider, auth.userId);
  if (!conn) return NextResponse.json({ error: `${p.label} isn't connected.` }, { status: 409 });
  try {
    const result = p.scope === "agency" ? await syncAgencyPayments(conn) : await syncMailbox(conn);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ ok: true, ...result, connection: publicConnection(await getConnection(auth.agencyId, body.provider, auth.userId)) });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Sync failed." }, { status: 502 });
  }
}, { body: JsonObject, optionalBody: true });
