import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/lib/security/alert-email", () => ({ escapeHtml: (s) => s, sendAdminAlert: async () => true }));
vi.mock("@/lib/site-settings", () => ({ alertRecipients: () => [] }));

const { spikeFindings } = await import("@/lib/traffic-alerts");

const quiet = { recent_requests: 20, recent_blocked: 0, recent_errors: 0, baseline_requests: 18, baseline_blocked: 0.5, top_ip: "1.2.3.4", top_ip_requests: 6 };

describe("spikeFindings", () => {
  it("is quiet on normal traffic", () => {
    expect(spikeFindings(quiet)).toEqual([]);
    expect(spikeFindings(null)).toEqual([]);
  });

  it("needs both the minimum and the multiple of the usual level for a surge", () => {
    // 5x the baseline but under the 300 minimum: nothing.
    expect(spikeFindings({ ...quiet, recent_requests: 100 })).toEqual([]);
    // Over the minimum but a busy site's normal level: nothing.
    expect(spikeFindings({ ...quiet, recent_requests: 400, baseline_requests: 200 })).toEqual([]);
    const [f] = spikeFindings({ ...quiet, recent_requests: 400, top_country: "US", top_country_requests: 350 });
    expect(f.kind).toBe("surge");
    expect(f.details).toMatchObject({ requests: 400, threshold: 300, topCountry: "US" });
  });

  it("honours the admin's thresholds", () => {
    expect(spikeFindings({ ...quiet, recent_requests: 120 }, { spikeMinRequests: 100, spikeMultiplier: 3 })[0].kind).toBe("surge");
  });

  it("flags blocked surges, error bursts and single-address floods", () => {
    const kinds = spikeFindings({ ...quiet, recent_blocked: 60, recent_errors: 25, top_ip_requests: 500 }).map((f) => f.kind);
    expect(kinds).toEqual(["blocked_surge", "errors", "ip_flood"]);
  });
});
