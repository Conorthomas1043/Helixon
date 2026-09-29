import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const { cleanSetting, publicSiteSettings, DEFAULTS } = await import("./site-settings");

describe("cleanSetting", () => {
  it("keeps features on unless explicitly switched off", () => {
    expect(cleanSetting("features", { checkout: false, junk: false })).toEqual({
      chat_assistant: true,
      demo_requests: true,
      checkout: false,
      employee_portal: true,
    });
    expect(cleanSetting("features", null)).toEqual(DEFAULTS.features);
  });

  it("only turns the announcement on when there is text", () => {
    expect(cleanSetting("announcement", { enabled: true, text: "   " }).enabled).toBe(false);
    const a = cleanSetting("announcement", { enabled: true, text: "New: talent pool", tone: "loud", linkLabel: "See", linkUrl: "/blog" });
    expect(a).toEqual({ enabled: true, text: "New: talent pool", tone: "info", linkLabel: "See", linkUrl: "/blog" });
  });

  it("drops unsafe announcement links", () => {
    expect(cleanSetting("announcement", { text: "x", linkUrl: "javascript:alert(1)", linkLabel: "Go" }).linkUrl).toBe("");
    expect(cleanSetting("announcement", { text: "x", linkUrl: "//evil.example", linkLabel: "Go" }).linkUrl).toBe("");
    expect(cleanSetting("announcement", { text: "x", linkUrl: "https://example.com/a", linkLabel: "Go" }).linkUrl).toBe("https://example.com/a");
  });

  it("requires maintenance.enabled to be exactly true", () => {
    expect(cleanSetting("maintenance", { enabled: "yes", message: "Back soon" })).toEqual({ enabled: false, message: "Back soon" });
  });

  it("rejects unknown keys", () => {
    expect(() => cleanSetting("nope", {})).toThrow();
    expect(publicSiteSettings(DEFAULTS)).toEqual({ maintenance: null, announcement: null, features: { chat_assistant: true } });
  });
});

describe("publicSiteSettings", () => {
  it("exposes only the banner, the maintenance message and the chat switch", () => {
    const out = publicSiteSettings({
      ...DEFAULTS,
      maintenance: { enabled: true, message: "Back at 6pm" },
      announcement: { enabled: true, text: "Hi", tone: "warn", linkLabel: "", linkUrl: "" },
    });
    expect(out).toEqual({ maintenance: { message: "Back at 6pm" }, announcement: { text: "Hi", tone: "warn", linkLabel: "", linkUrl: "" }, features: { chat_assistant: true } });
    expect(publicSiteSettings(DEFAULTS)).toEqual({ maintenance: null, announcement: null, features: { chat_assistant: true } });
  });
});
