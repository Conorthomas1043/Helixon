import { describe, expect, it } from "vitest";
import { computePresence, presenceLine, timeAgo } from "./presence";

const NOW = new Date("2026-09-29T12:00:00Z").getTime();
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60_000;

describe("computePresence", () => {
  it("is active with an open tab they've used recently", () => {
    expect(computePresence({ lastSeenAt: ago(30_000), lastActiveAt: ago(MIN) }, NOW).state).toBe("active");
  });

  it("is idle when the tab is open but untouched for 5+ minutes", () => {
    const p = computePresence({ lastSeenAt: ago(20_000), lastActiveAt: ago(12 * MIN) }, NOW);
    expect(p.state).toBe("idle");
    expect(presenceLine(p, NOW)).toBe("Idle · last active 12 min ago");
  });

  it("is offline once heartbeats stop, with when they were last active", () => {
    const p = computePresence({ lastSeenAt: ago(3 * 60 * MIN), lastActiveAt: ago(3 * 60 * MIN + 5 * MIN) }, NOW);
    expect(p.state).toBe("offline");
    expect(p.online).toBe(false);
    expect(presenceLine(p, NOW)).toBe("Last active 3 h ago");
  });

  it("shows a busy status while online, and drops it once it runs out", () => {
    const busy = computePresence({ lastSeenAt: ago(10_000), status: "busy", message: "Interviews", until: new Date(NOW + 30 * MIN).toISOString() }, NOW);
    expect(busy.state).toBe("busy");
    expect(busy.message).toBe("Interviews");
    const expired = computePresence({ lastSeenAt: ago(10_000), lastActiveAt: ago(10_000), status: "busy", until: ago(MIN) }, NOW);
    expect(expired.state).toBe("active");
    expect(expired.message).toBeNull();
  });

  it("keeps away when they've gone, but busy becomes offline", () => {
    expect(computePresence({ lastSeenAt: ago(60 * MIN), status: "away" }, NOW).state).toBe("away");
    expect(computePresence({ lastSeenAt: ago(60 * MIN), status: "busy" }, NOW).state).toBe("offline");
  });

  it("shows nothing for someone who has hidden their presence", () => {
    const p = computePresence({ hidden: true, lastSeenAt: ago(10_000), status: "busy" }, NOW);
    expect(p.state).toBe("hidden");
    expect(presenceLine(p, NOW)).toBe("Presence hidden");
  });

  it("has never been seen", () => {
    const p = computePresence({}, NOW);
    expect(p.state).toBe("offline");
    expect(presenceLine(p, NOW)).toBe("Not seen yet");
  });
});

describe("timeAgo", () => {
  it("reads naturally", () => {
    expect(timeAgo(ago(10_000), NOW)).toBe("just now");
    expect(timeAgo(ago(45 * MIN), NOW)).toBe("45 min ago");
    expect(timeAgo(ago(26 * 60 * MIN), NOW)).toBe("yesterday");
    expect(timeAgo(ago(4 * 24 * 60 * MIN), NOW)).toBe("4 days ago");
    expect(timeAgo(null, NOW)).toBeNull();
  });
});
