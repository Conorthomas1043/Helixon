import { afterEach, describe, expect, it } from "vitest";
import { authorizeUrl, providerConfigured, providerFor, redirectUri, tokenRequest } from "./providers";

describe("integration providers", () => {
  afterEach(() => {
    for (const k of ["XERO_CLIENT_ID", "XERO_CLIENT_SECRET", "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "OUTLOOK_CLIENT_ID", "OUTLOOK_CLIENT_SECRET"]) delete process.env[k];
  });

  it("knows only its providers", () => {
    expect(providerFor("xero").label).toBe("Xero");
    expect(providerFor("toString")).toBeNull();
    expect(providerFor("nope")).toBeNull();
  });

  it("is configured only with both client id and secret", () => {
    expect(providerConfigured("xero")).toBe(false);
    process.env.XERO_CLIENT_ID = "id";
    expect(providerConfigured("xero")).toBe(false);
    process.env.XERO_CLIENT_SECRET = "secret";
    expect(providerConfigured("xero")).toBe(true);
  });

  it("builds the authorize URL with state and redirect", () => {
    process.env.GMAIL_CLIENT_ID = "gid";
    const url = new URL(authorizeUrl("gmail", "st4te", "https://app.example.com/"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("state")).toBe("st4te");
    expect(url.searchParams.get("client_id")).toBe("gid");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/integrations/oauth/gmail/callback");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("scope")).toContain("gmail.readonly");
    expect(redirectUri("xero", "https://a.b")).toBe("https://a.b/api/integrations/oauth/xero/callback");
  });

  it("sends client credentials the way each service wants", () => {
    process.env.XERO_CLIENT_ID = "x";
    process.env.XERO_CLIENT_SECRET = "y";
    const xero = tokenRequest("xero", { code: "c", origin: "https://a.b" });
    expect(xero.init.headers.Authorization).toBe(`Basic ${Buffer.from("x:y").toString("base64")}`);
    expect(xero.init.body.get("client_secret")).toBeNull();
    expect(xero.init.body.get("grant_type")).toBe("authorization_code");

    process.env.OUTLOOK_CLIENT_ID = "o";
    process.env.OUTLOOK_CLIENT_SECRET = "p";
    const outlook = tokenRequest("outlook", { refreshToken: "r" });
    expect(outlook.url).toBe("https://login.microsoftonline.com/common/oauth2/v2.0/token");
    expect(outlook.init.headers.Authorization).toBeUndefined();
    expect(outlook.init.body.get("client_secret")).toBe("p");
    expect(outlook.init.body.get("grant_type")).toBe("refresh_token");
    expect(outlook.init.body.get("scope")).toContain("Mail.Read");
  });
});
