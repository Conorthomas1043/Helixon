import { describe, expect, it } from "vitest";
import { checkState, cleanCheck, cleanReferee, cleanReferenceAnswers, documentExtension, privacyNoticeStatus } from "@/lib/compliance";

describe("cleanCheck", () => {
  it("requires a kind when creating and validates dates", () => {
    expect(cleanCheck({}, { creating: true }).error).toBeTruthy();
    expect(cleanCheck({ kind: "right_to_work", expiresOn: "31/01/2027" }).error).toMatch(/dates/);
    expect(cleanCheck({ kind: "right_to_work", status: "verified", checkedOn: "2026-10-01", expiresOn: "", documentType: "  Online check  " })).toEqual({
      kind: "right_to_work",
      status: "verified",
      checked_on: "2026-10-01",
      expires_on: null,
      document_type: "Online check",
    });
  });
});

describe("checkState", () => {
  const now = "2026-10-01";
  it("orders failed / pending before dates", () => {
    expect(checkState({ status: "failed", expiresOn: "2020-01-01" }, now)).toBe("failed");
    expect(checkState({ status: "pending" }, now)).toBe("pending");
  });
  it("flags expired, expiring within 30 days and a due follow-up", () => {
    expect(checkState({ status: "verified", expiresOn: "2026-09-30" }, now)).toBe("expired");
    expect(checkState({ status: "verified", expires_on: "2026-10-31" }, now)).toBe("expiring");
    expect(checkState({ status: "verified", expiresOn: "2026-11-01" }, now)).toBe("ok");
    expect(checkState({ status: "verified", followUpOn: "2026-10-10" }, now)).toBe("expiring");
    expect(checkState({ status: "verified" }, now)).toBe("ok");
  });
});

describe("privacyNoticeStatus", () => {
  it("is not needed for applicants, people with consent or a notice already sent", () => {
    expect(privacyNoticeStatus({ source: "careers_page", created_at: "2026-01-01" })).toBeNull();
    expect(privacyNoticeStatus({ consent_given_at: "2026-01-01", created_at: "2026-01-01" })).toBeNull();
    expect(privacyNoticeStatus({ privacy_notice_sent_at: "2026-01-02", created_at: "2026-01-01" })).toBeNull();
  });
  it("is due a month after they were added", () => {
    expect(privacyNoticeStatus({ created_at: "2026-09-20T10:00:00Z" }, "2026-10-01")).toEqual({ dueOn: "2026-10-20", overdue: false });
    expect(privacyNoticeStatus({ created_at: "2026-08-01T10:00:00Z" }, "2026-10-01")).toEqual({ dueOn: "2026-08-31", overdue: true });
  });
});

describe("references", () => {
  it("needs the referee's name and a valid email if given", () => {
    expect(cleanReferee({}).error).toBeTruthy();
    expect(cleanReferee({ refereeName: "Sam", refereeEmail: "nope" }).error).toMatch(/email/);
    expect(cleanReferee({ refereeName: " Sam Lee ", refereeEmail: "Sam@Example.com" }).referee_email).toBe("sam@example.com");
  });
  it("validates answers and needs a name, confirmation and some answers", () => {
    const ok = cleanReferenceAnswers({ completedBy: "Sam", confirm: true, role: "Engineer", performance: 4, rehire: "Yes", bogus: "x" });
    expect(ok.answers).toEqual({ completedBy: "Sam", role: "Engineer", performance: 4, rehire: "Yes" });
    expect(cleanReferenceAnswers({ completedBy: "Sam", confirm: true, performance: 9, role: "x" }).error).toMatch(/1 to 5/);
    expect(cleanReferenceAnswers({ completedBy: "Sam", confirm: true, rehire: "Maybe", role: "x" }).error).toMatch(/options/);
    expect(cleanReferenceAnswers({ confirm: true, role: "a", rehire: "Yes" }).error).toMatch(/name/);
    expect(cleanReferenceAnswers({ completedBy: "Sam", role: "a", rehire: "Yes" }).error).toMatch(/confirm/);
    expect(cleanReferenceAnswers({ completedBy: "Sam", confirm: true, role: "a" }).error).toMatch(/couple/);
  });
});

describe("documentExtension", () => {
  it("accepts PDFs and images whose type matches", () => {
    expect(documentExtension("passport.PDF", "application/pdf")).toBe("pdf");
    expect(documentExtension("scan.jpg", "image/jpeg")).toBe("jpg");
    expect(documentExtension("scan.jpg", "application/pdf")).toBeNull();
    expect(documentExtension("x.exe", "")).toBeNull();
  });
});
