import { describe, expect, it } from "vitest";
import { addressesIn, direction, gmailBodyText, gmailMessage, htmlToText, nextCursor, otherParties, outlookMessage, syncStart } from "./mailbox-parse";

const b64 = (s) => Buffer.from(s, "utf8").toString("base64url");

describe("mailbox parsing", () => {
  it("pulls addresses out of headers, lower-cased and unique", () => {
    expect(addressesIn('"Jane Doe" <Jane@Example.com>, bob@x.io, jane@example.com')).toEqual(["jane@example.com", "bob@x.io"]);
    expect(addressesIn([null, "a@b.co"])).toEqual(["a@b.co"]);
  });

  it("reads a Gmail message, preferring the plain-text part", () => {
    const msg = {
      id: "abc",
      internalDate: "1759500000000",
      payload: {
        headers: [
          { name: "From", value: "Rec <rec@agency.co>" },
          { name: "To", value: "Jane <jane@example.com>" },
          { name: "Cc", value: "boss@client.com" },
          { name: "Subject", value: "Interview Tuesday" },
          { name: "Message-ID", value: "<m1@mail>" },
        ],
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/html", body: { data: b64("<p>Hi <b>Jane</b></p>") } },
          { mimeType: "text/plain", body: { data: b64("Hi Jane") } },
        ],
      },
    };
    expect(gmailMessage(msg)).toMatchObject({
      id: "gmail:abc",
      messageId: "<m1@mail>",
      from: "rec@agency.co",
      to: ["jane@example.com"],
      cc: ["boss@client.com"],
      subject: "Interview Tuesday",
      text: "Hi Jane",
      at: new Date(1759500000000).toISOString(),
    });
  });

  it("falls back to HTML as text, or the snippet", () => {
    expect(gmailBodyText({ mimeType: "text/html", body: { data: b64("<div>One</div><div>Two &amp; three</div>") } })).toBe("One\n Two & three");
    expect(gmailMessage({ id: "x", snippet: "Just the snippet", payload: { headers: [] } }).text).toBe("Just the snippet");
    expect(htmlToText("<style>p{}</style><p>Hello</p>")).toBe("Hello");
  });

  it("reads an Outlook message", () => {
    const e = outlookMessage({
      id: "AAMk",
      internetMessageId: "<o1@x>",
      subject: "Re: role",
      from: { emailAddress: { name: "Jane", address: "Jane@Example.com" } },
      toRecipients: [{ emailAddress: { address: "rec@agency.co" } }],
      ccRecipients: [],
      receivedDateTime: "2026-10-02T09:00:00Z",
      body: { contentType: "text", content: "Sounds good" },
    });
    expect(e).toMatchObject({ id: "outlook:AAMk", from: "jane@example.com", fromLabel: "Jane", to: ["rec@agency.co"], text: "Sounds good", at: "2026-10-02T09:00:00Z" });
  });

  it("works out who else is on it and which way it went", () => {
    const email = { from: "rec@agency.co", to: ["jane@example.com", "log+0123@in.helixon.co.uk"], cc: ["Rec@agency.co"] };
    expect(otherParties(email, "REC@agency.co")).toEqual(["jane@example.com"]);
    expect(direction(email, "rec@agency.co")).toBe("out");
    expect(direction({ ...email, from: "jane@example.com" }, "rec@agency.co")).toBe("in");
  });

  it("moves the cursor forward with an hour's overlap, never past now", () => {
    const now = Date.parse("2026-10-03T12:00:00Z");
    expect(nextCursor(null, [{ at: "2026-10-03T10:00:00Z" }], now)).toBe("2026-10-03T09:00:00.000Z");
    expect(nextCursor("2026-10-03T11:30:00Z", [{ at: "2026-10-03T10:00:00Z" }], now)).toBe("2026-10-03T11:30:00.000Z");
    expect(nextCursor("2026-10-03T08:00:00Z", [], now)).toBe("2026-10-03T08:00:00.000Z");
    expect(nextCursor(null, [], now)).toBeNull();
    expect(syncStart(null, 30, now).toISOString()).toBe("2026-09-03T12:00:00.000Z");
    expect(syncStart("2026-10-01T00:00:00Z", 30, now).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});
