import { describe, expect, it } from "vitest";
import { buildDigestEmail, digestEnabled } from "./analytics-digest";

const week = { analysed: 12, placed: 2, fees: 15000, avgScore: 71, shortlistRate: 40, placementRate: 10, stalled: 3 };
const previous = { analysed: 9, placed: 2, fees: 18000, avgScore: 74, shortlistRate: 35, placementRate: 5, stalled: 0 };
const base = { firstName: "Ana", agencyName: "Acme <Recruit>", week, previous, siteUrl: "https://app.test", weekLabel: "last week" };

describe("digestEnabled", () => {
  it("is off unless switched on", () => {
    expect(digestEnabled(undefined)).toBe(false);
    expect(digestEnabled({})).toBe(false);
    expect(digestEnabled({ weeklyDigest: true })).toBe(true);
  });
});

describe("buildDigestEmail", () => {
  it("shows each figure with its change on the week before", () => {
    const email = buildDigestEmail(base);
    expect(email.subject).toBe("Your week in Helixon: 12 analysed, 2 placed");
    expect(email.text).toContain("- Candidates analysed: 12 (up 3 on the week before)");
    expect(email.text).toContain("- Placements: 2 (no change on the week before)");
    expect(email.text).toContain("- Fees placed: £15,000 (down £3,000 on the week before)");
    expect(email.text).toContain("- Shortlist rate: 40% (up 5 pts on the week before)");
    expect(email.text).toContain("3 candidates have had no activity for 5+ days.");
  });

  it("escapes the agency name", () => {
    expect(buildDigestEmail(base).html).toContain("Acme &lt;Recruit&gt;");
  });

  it("sends nothing for two quiet weeks", () => {
    const quiet = { analysed: 0, placed: 0, fees: 0, avgScore: 0, shortlistRate: 0, placementRate: 0, stalled: 4 };
    expect(buildDigestEmail({ ...base, week: quiet, previous: quiet })).toBeNull();
    expect(buildDigestEmail({ ...base, week: quiet, previous: null })).toBeNull();
  });
});
