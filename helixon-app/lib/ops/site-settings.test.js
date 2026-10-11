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

  it("keeps firewall thresholds in range and alert at or below block", () => {
    expect(cleanSetting("firewall", { blockThreshold: 5, alertThreshold: 90, autoBlock: false, autoBlockHours: 24 })).toEqual({
      blockThreshold: 10,
      alertThreshold: 10,
      autoBlock: false,
      autoBlockHours: 24,
      emailAlerts: true,
      blockOnQuery: false,
    });
    expect(cleanSetting("firewall", {})).toEqual(DEFAULTS.firewall);
  });

  it("keeps only known health checks in the muted list", () => {
    expect(cleanSetting("health", { muted: ["gemini", "nope", "gemini"] })).toEqual({ muted: ["gemini"] });
    expect(cleanSetting("health", null)).toEqual({ muted: [] });
  });

  it("keeps valid, unique alert recipients", () => {
    expect(cleanSetting("alerts", { recipients: "Ops@Helixon.co.uk, bad-address, ops@helixon.co.uk; sec@helixon.co.uk", healthDigest: false })).toEqual({
      recipients: ["ops@helixon.co.uk", "sec@helixon.co.uk"],
      healthDigest: false,
    });
    expect(cleanSetting("alerts", {})).toEqual({ recipients: [], healthDigest: true });
  });

  it("keeps request capture settings to known values", () => {
    expect(cleanSetting("traffic", { captureHeaders: false, detailDays: 99 })).toEqual({
      captureHeaders: false,
      capturePayloads: true,
      detailDays: 14,
      retentionDays: 90,
      logMonitors: false,
      spikeAlerts: true,
      spikeMultiplier: 5,
      spikeMinRequests: 300,
      floodRequests: 300,
    });
    expect(cleanSetting("traffic", { detailDays: 3 }).detailDays).toBe(3);
  });

  it("keeps log retention within what the privacy policy promises, and alert thresholds sane", () => {
    expect(cleanSetting("traffic", { retentionDays: 365 }).retentionDays).toBe(90);
    expect(cleanSetting("traffic", { retentionDays: 30 }).retentionDays).toBe(30);
    const t = cleanSetting("traffic", { spikeMultiplier: 1, spikeMinRequests: 1, floodRequests: "500", logMonitors: true, spikeAlerts: false });
    expect(t).toMatchObject({ spikeMultiplier: 2, spikeMinRequests: 20, floodRequests: 500, logMonitors: true, spikeAlerts: false });
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
