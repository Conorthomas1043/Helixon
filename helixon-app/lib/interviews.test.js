import { describe, expect, it } from "vitest";
import { cleanInterviewFields, cleanReviewer, cleanScorecard, formatInterviewTime, summariseScorecards } from "./interviews";

describe("cleanInterviewFields", () => {
  it("requires a start time when creating", () => {
    expect(cleanInterviewFields({}, { creating: true }).error).toBeTruthy();
    expect(cleanInterviewFields({ startsAt: "not a date" }).error).toBeTruthy();
  });

  it("maps and validates fields", () => {
    const out = cleanInterviewFields({ startsAt: "2026-10-05T09:00:00Z", durationMinutes: 45, kind: "video", location: " https://zoom.us/j/1 ", round: 2 }, { creating: true });
    expect(out).toEqual({ starts_at: "2026-10-05T09:00:00.000Z", duration_minutes: 45, kind: "video", location: "https://zoom.us/j/1", round: 2 });
    expect(cleanInterviewFields({ durationMinutes: 2 }).error).toBeTruthy();
    expect(cleanInterviewFields({ kind: "carrier pigeon" }).error).toBeTruthy();
    expect(cleanInterviewFields({ outcome: null })).toEqual({ outcome: null });
  });
});

describe("cleanScorecard", () => {
  it("needs an overall rating and a recommendation", () => {
    expect(cleanScorecard({ recommendation: "yes" }).error).toBeTruthy();
    expect(cleanScorecard({ overallRating: 4 }).error).toBeTruthy();
  });

  it("keeps only the scorecard's criteria, with valid ratings", () => {
    const out = cleanScorecard(
      {
        overallRating: "4",
        recommendation: "yes",
        criteria: [
          { name: "Communication", rating: 5, comment: "Clear" },
          { name: "Role skills", rating: 9 },
          { name: "Made up", rating: 3 },
        ],
      },
      ["Role skills", "Communication"]
    );
    expect(out.overall_rating).toBe(4);
    expect(out.criteria).toEqual([
      { name: "Role skills", rating: null, comment: null },
      { name: "Communication", rating: 5, comment: "Clear" },
    ]);
  });
});

describe("cleanReviewer", () => {
  it("needs a name or email", () => {
    expect(cleanReviewer({}).error).toBeTruthy();
    expect(cleanReviewer({ reviewerEmail: "bad" }).error).toBeTruthy();
    expect(cleanReviewer({ reviewerName: "Jo", reviewerEmail: "JO@x.com" })).toEqual({ reviewer_name: "Jo", reviewer_email: "jo@x.com" });
  });
});

describe("summariseScorecards", () => {
  it("averages submitted cards only", () => {
    const s = summariseScorecards([
      { submittedAt: "x", overallRating: 4, recommendation: "yes" },
      { submittedAt: "x", overallRating: 5, recommendation: "strong_yes" },
      { submittedAt: null, overallRating: null },
    ]);
    expect(s).toMatchObject({ submitted: 2, pending: 1, averageRating: 4.5 });
    expect(s.recommendations.yes).toBe(1);
  });
});

describe("formatInterviewTime", () => {
  it("formats in the time zone", () => {
    expect(formatInterviewTime("2026-10-05T09:00:00Z", 45, "Europe/London")).toBe("Mon 5 Oct, 10:00 (45 min)");
  });
});
