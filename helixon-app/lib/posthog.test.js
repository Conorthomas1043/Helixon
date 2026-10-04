import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = { __loaded: false, init: vi.fn(), capture: vi.fn(), identify: vi.fn(), reset: vi.fn() };
vi.mock("posthog-js", () => ({ default: fake }));

const { default: posthog, loadPosthog, _resetPosthogForTests } = await import("./posthog");

describe("lazy posthog", () => {
  beforeEach(() => {
    _resetPosthogForTests();
    vi.clearAllMocks();
    fake.__loaded = false;
  });

  it("drops calls when analytics was never started (no consent)", async () => {
    posthog.capture("signup_started");
    expect(posthog.__loaded).toBe(false);
    expect(fake.capture).not.toHaveBeenCalled();
  });

  it("queues calls made while loading and replays them in order after init", async () => {
    const ready = loadPosthog((ph) => {
      ph.init("token");
      ph.__loaded = true;
    });
    posthog.identify("user_1");
    posthog.capture("screen_run", { n: 3 });
    expect(fake.capture).not.toHaveBeenCalled();
    await ready;
    expect(fake.init).toHaveBeenCalledWith("token");
    expect(fake.identify).toHaveBeenCalledWith("user_1");
    expect(fake.capture).toHaveBeenCalledWith("screen_run", { n: 3 });
    expect(fake.identify.mock.invocationCallOrder[0]).toBeLessThan(fake.capture.mock.invocationCallOrder[0]);
    expect(posthog.__loaded).toBe(true);
  });

  it("calls straight through once loaded, and only loads once", async () => {
    const init = vi.fn((ph) => (ph.__loaded = true));
    await loadPosthog(init);
    await loadPosthog(init);
    expect(init).toHaveBeenCalledTimes(1);
    posthog.reset();
    expect(fake.reset).toHaveBeenCalledTimes(1);
  });
});
