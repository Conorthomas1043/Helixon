import { describe, expect, it } from "vitest";
import { checkEnv, REQUIRED } from "./env";

const complete = Object.fromEntries(REQUIRED.map((v) => [v.name, v.check ? "https://example.com" : "set"]));

describe("checkEnv", () => {
  it("passes a complete production setup", () => {
    expect(checkEnv({ ...complete, REDIS_URL: "redis://x", INTERNAL_EDGE_LOG_SECRET: "s", SECURITY_ALERT_EMAIL: "a@b.c" }, { production: true })).toEqual({ errors: [], warnings: [] });
  });

  it("names each missing required variable, as errors only in production", () => {
    const { errors } = checkEnv({ ...complete, ANTHROPIC_API_KEY: "", RESEND_API_KEY: undefined }, { production: true });
    expect(errors).toEqual([expect.stringMatching(/^ANTHROPIC_API_KEY .*CV screening/), expect.stringMatching(/^RESEND_API_KEY /)]);
    const dev = checkEnv({}, { production: false });
    expect(dev.errors).toEqual([]);
    expect(dev.warnings.length).toBe(REQUIRED.length);
  });

  it("accepts the public Supabase URL in place of SUPABASE_URL", () => {
    const { SUPABASE_URL, ...rest } = complete;
    expect(checkEnv({ ...rest, NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL }, { production: true }).errors).toEqual([]);
  });

  it("catches half-configured features and malformed values", () => {
    const { errors } = checkEnv(
      { ...complete, XERO_CLIENT_ID: "x", INTEGRATIONS_ENCRYPTION_KEY: "short", SUPABASE_AGENCY_RLS: "1", NEXT_PUBLIC_SITE_URL: "helixon.co.uk" },
      { production: true }
    );
    expect(errors.join("\n")).toMatch(/NEXT_PUBLIC_SITE_URL doesn't look right/);
    expect(errors.join("\n")).toMatch(/Xero is half set up: XERO_CLIENT_SECRET missing/);
    expect(errors.join("\n")).toMatch(/INTEGRATIONS_ENCRYPTION_KEY should be 32 random bytes/);
    expect(errors.join("\n")).toMatch(/SUPABASE_JWT_SECRET is not set/);
  });

  it("accepts a well-formed encryption key", () => {
    const key = "a".repeat(64);
    expect(checkEnv({ ...complete, INTEGRATIONS_ENCRYPTION_KEY: key }, { production: true }).errors).toEqual([]);
  });
});
