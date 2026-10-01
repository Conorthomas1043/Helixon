import { describe, expect, it } from "vitest";
import { classifyUserAgent, isAdminPath } from "@/lib/traffic-class";

describe("classifyUserAgent", () => {
  it("knows uptime monitors", () => {
    expect(classifyUserAgent("SentryUptimeBot/1.0 (+http://docs.sentry.io/product/alerts/uptime-monitoring/)")).toBe("monitor");
    expect(classifyUserAgent("Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)")).toBe("monitor");
    expect(classifyUserAgent("Pingdom.com_bot_version_1.4_(http://www.pingdom.com/)")).toBe("monitor");
  });
  it("knows search engines, link previews and AI crawlers", () => {
    expect(classifyUserAgent("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")).toBe("crawler");
    expect(classifyUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe("crawler");
    expect(classifyUserAgent("Mozilla/5.0 (compatible; Dataprovider.com)")).toBe("crawler");
    expect(classifyUserAgent("WhatsApp/2.23.20.0")).toBe("crawler");
    expect(classifyUserAgent("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)")).toBe("crawler");
    expect(classifyUserAgent("Chrome Privacy Preserving Prefetch Proxy")).toBe("crawler");
  });
  it("knows scripts, scanners and headless browsers", () => {
    expect(classifyUserAgent("curl/8.4.0")).toBe("bot");
    expect(classifyUserAgent("python-requests/2.31.0")).toBe("bot");
    expect(classifyUserAgent("Go-http-client/1.1")).toBe("bot");
    expect(classifyUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36")).toBe("bot");
    expect(classifyUserAgent("sqlmap/1.7")).toBe("bot");
    expect(classifyUserAgent("")).toBe("bot");
    expect(classifyUserAgent(null)).toBe("bot");
  });
  it("treats ordinary browsers as people", () => {
    expect(classifyUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1")).toBe("human");
    expect(classifyUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36")).toBe("human");
    // "Cubot" phones and "robotics" in a UA aren't bots.
    expect(classifyUserAgent("Mozilla/5.0 (Linux; Android 12; CUBOT KINGKONG 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36")).toBe("human");
  });
});

describe("isAdminPath", () => {
  it("matches the admin area and its APIs only", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/traffic")).toBe(true);
    expect(isAdminPath("/api/admin/traffic")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/dashboard")).toBe(false);
  });
});

describe("the SQL backfill", () => {
  it("uses exactly the same patterns as the logger", async () => {
    const { readFileSync } = await import("node:fs");
    const { BOT_PATTERN, CRAWLER_PATTERN, MONITOR_PATTERN } = await import("@/lib/traffic-class");
    const sql = readFileSync(new URL("../supabase/migrations/20261001100000_traffic_analytics.sql", import.meta.url), "utf8");
    for (const pattern of [MONITOR_PATTERN, CRAWLER_PATTERN, BOT_PATTERN]) expect(sql).toContain(`'${pattern}'`);
  });
});
