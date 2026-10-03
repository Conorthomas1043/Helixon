// OAuth 2.0 settings for the services an agency can connect
// (integration_connections). Each needs an app registered with that
// service - the client id/secret come from env vars, and until they're set
// the provider reports itself as not configured.
//
//   xero        XERO_CLIENT_ID / XERO_CLIENT_SECRET (developer.xero.com)
//   quickbooks  QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET
//               (developer.intuit.com); QUICKBOOKS_ENVIRONMENT=sandbox to test
//   gmail       GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET (Google Cloud console,
//               Gmail API enabled)
//   outlook     OUTLOOK_CLIENT_ID / OUTLOOK_CLIENT_SECRET (Microsoft Entra
//               app registration, Mail.Read delegated permission)
//
// Every app's redirect URI is <NEXT_PUBLIC_SITE_URL>/api/integrations/oauth/<provider>/callback.

export const PROVIDERS = {
  xero: {
    label: "Xero",
    scope: "agency", // one connection for the whole agency, admins only
    authUrl: "https://login.xero.com/identity/connect/authorize",
    tokenUrl: "https://identity.xero.com/connect/token",
    scopes: () => process.env.XERO_SCOPES || "openid profile email offline_access accounting.transactions accounting.contacts",
    clientId: () => process.env.XERO_CLIENT_ID,
    clientSecret: () => process.env.XERO_CLIENT_SECRET,
    basicAuth: true,
  },
  quickbooks: {
    label: "QuickBooks",
    scope: "agency",
    authUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    scopes: () => "com.intuit.quickbooks.accounting",
    clientId: () => process.env.QUICKBOOKS_CLIENT_ID,
    clientSecret: () => process.env.QUICKBOOKS_CLIENT_SECRET,
    basicAuth: true,
  },
  gmail: {
    label: "Gmail",
    scope: "member", // one per person - their own mailbox
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: () => "openid email https://www.googleapis.com/auth/gmail.readonly",
    clientId: () => process.env.GMAIL_CLIENT_ID,
    clientSecret: () => process.env.GMAIL_CLIENT_SECRET,
    // Google only returns a refresh token with these.
    extraAuthParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  outlook: {
    label: "Outlook / Microsoft 365",
    scope: "member",
    authUrl: () => `https://login.microsoftonline.com/${process.env.OUTLOOK_TENANT || "common"}/oauth2/v2.0/authorize`,
    tokenUrl: () => `https://login.microsoftonline.com/${process.env.OUTLOOK_TENANT || "common"}/oauth2/v2.0/token`,
    scopes: () => "offline_access openid email User.Read Mail.Read",
    clientId: () => process.env.OUTLOOK_CLIENT_ID,
    clientSecret: () => process.env.OUTLOOK_CLIENT_SECRET,
    extraAuthParams: { response_mode: "query" },
  },
};

const resolve = (v) => (typeof v === "function" ? v() : v);

export function providerFor(name) {
  return Object.prototype.hasOwnProperty.call(PROVIDERS, name) ? PROVIDERS[name] : null;
}

export function providerConfigured(name) {
  const p = providerFor(name);
  return Boolean(p && p.clientId() && p.clientSecret());
}

export function redirectUri(name, origin = process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk") {
  return `${String(origin).replace(/\/+$/, "")}/api/integrations/oauth/${name}/callback`;
}

export function authorizeUrl(name, state, origin) {
  const p = providerFor(name);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: p.clientId() || "",
    redirect_uri: redirectUri(name, origin),
    scope: p.scopes(),
    state,
    ...(p.extraAuthParams || {}),
  });
  return `${resolve(p.authUrl)}?${params.toString()}`;
}

// The token endpoint request for an authorization code or a refresh token.
export function tokenRequest(name, { code, refreshToken, origin }) {
  const p = providerFor(name);
  const body = new URLSearchParams(
    refreshToken ? { grant_type: "refresh_token", refresh_token: refreshToken } : { grant_type: "authorization_code", code, redirect_uri: redirectUri(name, origin) }
  );
  const headers = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
  if (p.basicAuth) {
    headers.Authorization = `Basic ${Buffer.from(`${p.clientId()}:${p.clientSecret()}`).toString("base64")}`;
  } else {
    body.set("client_id", p.clientId() || "");
    body.set("client_secret", p.clientSecret() || "");
    if (name === "outlook") body.set("scope", p.scopes());
  }
  return { url: resolve(p.tokenUrl), init: { method: "POST", headers, body } };
}

// Posts a token request; resolves the stored token shape
// { accessToken, refreshToken, expiresAt, idToken }.
export async function fetchTokens(name, opts) {
  const { url, init } = tokenRequest(name, opts);
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Token request failed (${res.status})`);
  }
  return {
    accessToken: data.access_token,
    // Some services don't send a new refresh token on refresh - keep the old one.
    refreshToken: data.refresh_token || opts.refreshToken || null,
    expiresAt: new Date(Date.now() + (Number(data.expires_in) || 1800) * 1000).toISOString(),
    idToken: data.id_token || null,
  };
}
