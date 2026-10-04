import { describe, expect, it } from "vitest";
import { escapeHtml, formatDate, initials, timeAgo } from "./format";

const NOW = Date.parse("2026-10-04T12:00:00Z");
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatDate", () => {
  it("formats the app's date variants", () => {
    expect(formatDate("2026-10-04T09:30:00Z")).toBe("4 Oct 2026");
    expect(formatDate("2026-10-04T09:30:00Z", { withYear: false })).toBe("4 Oct");
    expect(formatDate("2026-10-04", { dateOnly: true })).toBe("4 Oct 2026");
  });

  it("shows the caller's placeholder for missing or invalid dates", () => {
    expect(formatDate(null)).toBe("-");
    expect(formatDate("not a date", { empty: "Unknown date" })).toBe("Unknown date");
    expect(formatDate(undefined, { empty: null })).toBeNull();
  });
});

describe("timeAgo", () => {
  it("long style (admin)", () => {
    expect(timeAgo(ago(10_000), { now: NOW })).toBe("just now");
    expect(timeAgo(ago(3 * MIN), { now: NOW })).toBe("3 minutes ago");
    expect(timeAgo(ago(-2 * DAY), { now: NOW })).toBe("in 2 days");
    expect(timeAgo(null, { now: NOW })).toBe("never");
  });

  it("short, compact and relative styles", () => {
    expect(timeAgo(ago(5 * MIN), { now: NOW, style: "short" })).toBe("5m ago");
    expect(timeAgo(ago(3 * HOUR), { now: NOW, style: "compact" })).toBe("3h");
    expect(timeAgo(ago(4 * DAY), { now: NOW, style: "compact" })).toBe("4d");
    expect(timeAgo(ago(25 * HOUR), { now: NOW, style: "relative" })).toBe("yesterday");
    expect(timeAgo(ago(3 * DAY), { now: NOW, style: "relative" })).toBe("3 days ago");
    expect(timeAgo(null, { style: "relative" })).toBeNull();
  });
});

describe("initials and escapeHtml", () => {
  it("initials", () => {
    expect(initials("ada lovelace byron")).toBe("AL");
    expect(initials("")).toBe("?");
    expect(initials(null)).toBe("?");
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;");
    expect(escapeHtml(null)).toBe("");
  });
});
