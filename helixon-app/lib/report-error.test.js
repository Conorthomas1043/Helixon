import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const Sentry = await import("@sentry/nextjs");
const { reportError } = await import("./report-error");

describe("reportError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("still logs the original arguments", () => {
    reportError("[cron/x] failed:", "boom");
    expect(console.error).toHaveBeenCalledWith("[cron/x] failed:", "boom");
  });

  it("captures an Error with its stack, tagged with the [scope]", () => {
    const err = new Error("db down");
    reportError("[team/invite] Clerk revoke failed:", err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err, expect.objectContaining({ tags: { scope: "team/invite" } }));
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it("captures plain messages when there is no Error", () => {
    reportError("[auth/me] Profile lookup failed:", "timeout", { id: 3 });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      '[auth/me] Profile lookup failed: timeout {"id":3}',
      expect.objectContaining({ level: "error", tags: { scope: "auth/me" } })
    );
  });

  it("never throws, even if Sentry does", () => {
    Sentry.captureMessage.mockImplementation(() => {
      throw new Error("sentry offline");
    });
    expect(() => reportError("x")).not.toThrow();
  });
});
