import { describe, expect, it } from "vitest";
import { feedbackRequestEmail } from "./feedback-request-email";

const base = { url: "https://x.test/feedback/abc", agencyName: "Acme Talent", recruiterName: "Sam Lee", candidateName: "Ana Ruiz", jobTitle: "Data Engineer" };

describe("feedbackRequestEmail", () => {
  it("asks a candidate about their experience", () => {
    const e = feedbackRequestEmail({ ...base, kind: "candidate_nps" });
    expect(e.subject).toBe("How was your experience with Acme Talent?");
    expect(e.text).toContain(base.url);
    expect(e.text).toContain("Sam Lee\nAcme Talent");
  });

  it("asks a client about the candidate", () => {
    const e = feedbackRequestEmail({ ...base, kind: "client_feedback" });
    expect(e.subject).toBe("Quick feedback on Ana Ruiz for Data Engineer");
    expect(e.text).toContain(base.url);
  });

  it("copes without a job", () => {
    const e = feedbackRequestEmail({ ...base, jobTitle: null, kind: "client_feedback" });
    expect(e.subject).toBe("Quick feedback on Ana Ruiz");
  });
});
