import { afterEach, describe, expect, it } from "vitest";
import { open, seal, secretBoxReady } from "./secret-box";

const KEY = "a".repeat(64);

describe("secret box", () => {
  afterEach(() => {
    delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
  });

  it("is not ready without a 32-byte key", () => {
    expect(secretBoxReady()).toBe(false);
    process.env.INTEGRATIONS_ENCRYPTION_KEY = "short";
    expect(secretBoxReady()).toBe(false);
    expect(() => seal({ a: 1 })).toThrow();
  });

  it("round-trips a value, accepting hex or base64 keys", () => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = KEY;
    const sealed = seal({ access_token: "abc", n: 2 });
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("abc");
    expect(open(sealed)).toEqual({ access_token: "abc", n: 2 });
    process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.from(KEY, "hex").toString("base64");
    expect(open(sealed)).toEqual({ access_token: "abc", n: 2 });
  });

  it("refuses tampered data or the wrong key", () => {
    process.env.INTEGRATIONS_ENCRYPTION_KEY = KEY;
    const sealed = seal("secret");
    const parts = sealed.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    expect(open(parts.join("."))).toBeNull();
    process.env.INTEGRATIONS_ENCRYPTION_KEY = "b".repeat(64);
    expect(open(sealed)).toBeNull();
    expect(open("junk")).toBeNull();
  });
});
