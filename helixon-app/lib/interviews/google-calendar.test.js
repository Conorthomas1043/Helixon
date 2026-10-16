import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const { openToken } = await import("./google-calendar");
const { seal } = await import("@/lib/security/secret-box");

afterEach(() => {
  delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
});

describe("stored Google tokens", () => {
  it("opens a sealed token and reads an older plain one as it is", () => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = "ab".repeat(32);
    expect(openToken(seal("ya29.secret"))).toBe("ya29.secret");
    expect(openToken("ya29.plain")).toBe("ya29.plain");
    expect(openToken(null)).toBeNull();
  });

  it("gives nothing for a sealed token it can't open", () => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = "ab".repeat(32);
    const sealed = seal("ya29.secret");
    process.env.INTEGRATIONS_ENCRYPTION_KEY = "cd".repeat(32);
    expect(openToken(sealed)).toBeNull();
  });
});
