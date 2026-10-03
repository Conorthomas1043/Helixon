import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { requireCustomerContext } from "@/lib/customer-auth";
import { canManageWorkspace } from "@/lib/workspace-admin";
import { siteUrl } from "@/lib/mailer";
import { authorizeUrl, providerFor } from "@/lib/integrations/providers";
import { integrationReady } from "@/lib/integrations/store";

// GET  starts connecting Xero, QuickBooks (owner/admins - it's the whole
//      agency's) or your own Gmail / Outlook: redirects to the service's
//      consent screen. The callback is ../callback.

const STATE_COOKIE = "helixon_oauth_state";
const BACK = "/dashboard/settings/integrations";

export async function GET(request, { params }) {
  const { provider } = await params;
  const back = (q) => NextResponse.redirect(new URL(`${BACK}?${q}`, request.url));
  const p = providerFor(provider);
  if (!p) return back("integrationError=unknown");
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.redirect(new URL("/login", request.url));
  if (!integrationReady(provider)) return back(`integrationError=not_configured&provider=${provider}`);
  if (p.scope === "agency" && !(await canManageWorkspace(auth))) return back(`integrationError=not_admin&provider=${provider}`);

  const state = crypto.randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  // Bound to this provider, this person and this workspace - checked in the callback.
  cookieStore.set(STATE_COOKIE, `${provider}.${auth.userId}.${auth.agencyId}.${state}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/oauth",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl(provider, state, siteUrl()));
}
