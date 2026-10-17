import { describe, expect, it } from "vitest";
import { nextStepFor } from "./next-step";

const c = (extra) => ({ status: "completed", stage: "Screened", score: 70, ...extra });

describe("nextStepFor", () => {
  it("suggests shortlisting a screened candidate, and says so when they're strong", () => {
    expect(nextStepFor(c({ score: 91 }))).toMatchObject({ cta: "Shortlist", action: { stage: "Shortlisted" } });
    expect(nextStepFor(c({ score: 91 })).text).toContain("strong match at 91");
    expect(nextStepFor(c({})).text).not.toContain("strong");
  });

  it("walks the funnel", () => {
    expect(nextStepFor(c({ stage: "Shortlisted" })).action).toEqual({ scrollTo: "interviews" });
    expect(nextStepFor(c({ stage: "Interview" })).action).toEqual({ stage: "Offer" });
    expect(nextStepFor(c({ stage: "Offer" })).action).toEqual({ tab: "place" });
    expect(nextStepFor(c({ stage: "Placed" })).cta).toBe("Record fee");
    expect(nextStepFor(c({ stage: "Placed", placementFee: 4320 }))).toBeNull();
  });

  it("offers the rejection email only when there's someone to send it to", () => {
    expect(nextStepFor(c({ stage: "Rejected", email: "a@b.co" })).action).toEqual({ tab: "contact" });
    expect(nextStepFor(c({ stage: "Rejected" }))).toBeNull();
  });

  it("puts a recruiter's own next action first", () => {
    expect(nextStepFor(c({ nextAction: { label: "Call about notice period" } })).text).toBe("Next action: Call about notice period.");
  });

  it("says nothing while the analysis is still running", () => {
    expect(nextStepFor({ status: "processing", stage: "Screened" })).toBeNull();
    expect(nextStepFor(null)).toBeNull();
  });
});
