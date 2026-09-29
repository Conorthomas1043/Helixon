import { describe, expect, it } from "vitest";
import { gradeHealth } from "./health-grade";

const healthy = {
  database: { configured: true, connected: true },
  aiProviders: { anthropic: { configured: true, connected: true }, gemini: { configured: false } },
  stripe: { configured: true },
  clerk: { configured: true },
  redis: { configured: false },
  resend: { configured: true },
  sentry: { configured: true },
  pages: { failing: 0 },
};

describe("gradeHealth", () => {
  it("is ok when everything configured is up", () => {
    expect(gradeHealth(healthy)).toEqual({ overall: "ok", failing: [], mutedFailing: [] });
  });

  it("is critical when a core dependency is down, degraded for the rest", () => {
    expect(gradeHealth({ ...healthy, database: { configured: true, connected: false } }).overall).toBe("critical");
    expect(gradeHealth({ ...healthy, stripe: { configured: true, error: "401" } })).toEqual({ overall: "degraded", failing: ["stripe"], mutedFailing: [] });
    expect(gradeHealth({ ...healthy, pages: { failing: 2 } }).failing).toEqual(["pages"]);
  });

  it("ignores muted checks but still reports them", () => {
    const down = { ...healthy, aiProviders: { ...healthy.aiProviders, anthropic: { configured: true, connected: false } } };
    expect(gradeHealth(down, ["anthropic"])).toEqual({ overall: "ok", failing: [], mutedFailing: ["anthropic"] });
  });
});
