import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const { checkWebhookUrl, isPrivateAddress, signWebhook } = await import("@/lib/webhooks");

describe("checkWebhookUrl", () => {
  it("accepts public https addresses", () => {
    expect(checkWebhookUrl("https://hooks.zapier.com/hooks/catch/1/abc/").url).toBe("https://hooks.zapier.com/hooks/catch/1/abc/");
  });
  it("refuses http, private and internal hosts, credentials and odd ports", () => {
    for (const bad of [
      "http://example.com/hook",
      "https://localhost/hook",
      "https://127.0.0.1/x",
      "https://10.1.2.3/x",
      "https://192.168.1.1/x",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/x",
      "https://intranet/x",
      "https://db.internal/x",
      "https://user:pw@example.com/x",
      "https://example.com:8080/x",
      "not a url",
    ]) {
      expect(checkWebhookUrl(bad).error, bad).toBeTruthy();
    }
  });
});

describe("isPrivateAddress", () => {
  it("knows private, loopback and mapped addresses", () => {
    expect(isPrivateAddress("172.20.0.1")).toBe(true);
    expect(isPrivateAddress("172.32.0.1")).toBe(false);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
  });
});

describe("signWebhook", () => {
  it("is an HMAC of timestamp and body", async () => {
    const crypto = await import("node:crypto");
    const expected = crypto.createHmac("sha256", "s3cret").update("1700000000.{\"a\":1}").digest("hex");
    expect(signWebhook("s3cret", 1700000000, '{"a":1}')).toBe(expected);
  });
});
