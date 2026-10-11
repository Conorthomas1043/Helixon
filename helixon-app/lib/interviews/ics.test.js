import { describe, expect, it } from "vitest";
import { buildInvite, foldLine, icsEscape } from "./ics";

const base = {
  uid: "abc@helixon.co.uk",
  start: "2026-10-05T09:00:00Z",
  durationMinutes: 45,
  summary: "Interview: Ana Ruiz, Data Engineer",
  organizer: { name: "Sam Lee", email: "sam@agency.com" },
  attendees: [{ name: "Ana Ruiz", email: "ana@example.com" }],
  now: "2026-10-01T10:00:00Z",
};

describe("buildInvite", () => {
  it("builds a REQUEST with start, end and attendees", () => {
    const ics = buildInvite({ ...base, location: "Zoom; link below", description: "Line one\nLine two" });
    expect(ics).toContain("METHOD:REQUEST\r\n");
    expect(ics).toContain("DTSTART:20261005T090000Z\r\n");
    expect(ics).toContain("DTEND:20261005T094500Z\r\n");
    expect(ics).toContain("LOCATION:Zoom\\; link below\r\n");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\r\n");
    expect(ics).toContain('ORGANIZER;CN="Sam Lee":mailto:sam@agency.com');
    expect(ics).toContain("mailto:ana@example.com");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("cancels with the same UID and a higher sequence", () => {
    const ics = buildInvite({ ...base, method: "CANCEL", sequence: 2 });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics).toContain("UID:abc@helixon.co.uk");
  });
});

describe("helpers", () => {
  it("escapes text", () => {
    expect(icsEscape("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
  });

  it("folds long lines at 75 octets", () => {
    const line = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) expect(Buffer.byteLength(part)).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("never splits a multi-byte character", () => {
    const line = `SUMMARY:${"é".repeat(60)}`;
    expect(foldLine(line).replace(/\r\n /g, "")).toBe(line);
  });
});

describe("buildFeed", () => {
  it("lists every interview as an event", async () => {
    const { buildFeed } = await import("./ics");
    const feed = buildFeed({
      name: "Ana's interviews",
      events: [
        { uid: "a@helixon", start: "2026-10-06T09:00:00Z", durationMinutes: 45, summary: "Interview: Ben, Dev", location: "Zoom", url: "https://x/c/1" },
        { uid: "b@helixon", start: "2026-10-07T09:00:00Z", summary: "Interview: Cat", cancelled: true },
        { uid: "c@helixon", start: "not a date", summary: "skip" },
      ],
    });
    expect(feed.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(feed.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(feed).toContain("DTSTART:20261006T090000Z\r\nDTEND:20261006T094500Z");
    expect(feed).toContain("SUMMARY:Interview: Ben\\, Dev");
    expect(feed).toContain("STATUS:CANCELLED");
    expect(feed).toContain("X-WR-CALNAME:Ana's interviews");
    expect(feed).not.toContain("METHOD:");
  });
});
