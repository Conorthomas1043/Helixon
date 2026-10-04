import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { requireCustomerContext } from "@/lib/customer-auth";
import { siteUrl } from "@/lib/mailer";
import { canManageWorkspace } from "@/lib/workspace-admin";
import { logAudit } from "@/lib/agency-audit";
import { fetchTokens, providerFor } from "@/lib/integrations/providers";
import { saveConnection } from "@/lib/integrations/store";
import { quickbooksCompany, xeroTenant } from "@/lib/integrations/accounting";
import { mailboxAddress } from "@/lib/integrations/mailbox";
import { reportError } from "@/lib/report-error";

// The service sends the person back here with ?code=&state= (or ?error=).
// The state must match the cookie set by ../connect for this provider,
// person and workspace; then the code is swapped for tokens, which are
// stored encrypted (lib/integrations/store.js).

const STATE_COOKIE = "helixon_oauth_state";
const BACK = "/dashboard/settings/integrations";

function sameString(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function GET(request, { params }) {
  const { provider } = await params;
  const back = (q) => NextResponse.redirect(new URL(`${BACK}?${q}&provider=${encodeURIComponent(provider)}`, request.url));
  const p = providerFor(provider);
  if (!p) return back("integrationError=unknown");
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.redirect(new URL("/login", request.url));

  const url = new URL(request.url);
  const cookieStore = await cookies();
  const expected = cookieStore.get(STATE_COOKIE)?.value || "";
  cookieStore.set(STATE_COOKIE, "", { path: "/api/integrations/oauth", maxAge: 0 });

  if (url.searchParams.get("error")) return back(`integrationError=${encodeURIComponent(url.searchParams.get("error").slice(0, 60))}`);
  const code = url.searchParams.get("code");
  if (!code || !sameString(expected, `${provider}.${auth.userId}.${auth.agencyId}.${url.searchParams.get("state") || ""}`)) {
    return back("integrationError=invalid_state");
  }
  if (p.scope === "agency" && !(await canManageWorkspace(auth))) return back("integrationError=not_admin");

  try {
    const tokens = await fetchTokens(provider, { code, origin: siteUrl() });
    if (!tokens.refreshToken) return back("integrationError=no_refresh_token");
    let account;
    if (provider === "xero") account = await xeroTenant(tokens.accessToken);
    else if (provider === "quickbooks") {
      const realmId = url.searchParams.get("realmId");
      if (!/^\d{1,30}$/.test(realmId || "")) return back("integrationError=no_company");
      account = await quickbooksCompany(tokens.accessToken, realmId);
    } else {
      const address = await mailboxAddress(provider, tokens.accessToken);
      account = { id: address, name: address };
    }
    await saveConnection({
      agencyId: auth.agencyId,
      provider,
      userId: auth.userId,
      tokens,
      accountId: account.id,
      accountName: account.name,
      connectedBy: auth.userId,
    });
    await logAudit({ auth, request, action: "integration.connected", targetType: "integration", targetId: provider, summary: `${p.label} connected${account.name ? ` (${account.name})` : ""}` });
    return back("integrationConnected=1");
  } catch (err) {
    reportError(`[integrations/${provider}] callback failed:`, err?.message);
    return back("integrationError=exchange_failed");
  }
}
