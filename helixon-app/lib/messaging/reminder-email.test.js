import { describe, expect, it } from "vitest";
import { buildReminderEmail, remindersEnabled, MAX_LISTED } from "./reminder-email";

const site = "https://app.example.com";
const item = (over) => ({ candidateId: "c1", candidateName: "Ana", jobTitle: "Dev", kind: "action", label: "Call back", dueAt: "2026-09-29T09:00:00Z", when: "overdue", ...over });

describe("buildReminderEmail", () => {
  it("sends nothing when nothing is due", () => {
    expect(buildReminderEmail({ items: [item({ when: "upcoming" })], siteUrl: site })).toBeNull();
    expect(buildReminderEmail({ items: [], siteUrl: site })).toBeNull();
  });

  it("summarises overdue and today in the subject", () => {
    const email = buildReminderEmail({ firstName: "Sam", items: [item(), item({ when: "today" }), item({ when: "upcoming" })], siteUrl: site });
    expect(email.subject).toBe("Follow-ups: 1 overdue, 1 due today");
    expect(email.count).toBe(2);
    expect(email.text).toContain("Hi Sam,");
    expect(email.html).toContain(`${site}/dashboard/candidates/c1`);
  });

  it("links check-ins to the talent pool and escapes content", () => {
    const email = buildReminderEmail({ items: [item({ kind: "check_in", candidateName: "<b>Eve</b>", when: "today", dueAt: "2026-10-01" })], siteUrl: site });
    expect(email.html).toContain(`${site}/dashboard/talent-pool?due=1`);
    expect(email.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(email.html).not.toContain("<b>Eve</b>");
  });

  it("caps the list", () => {
    const many = Array.from({ length: MAX_LISTED + 3 }, (_, i) => item({ candidateId: `c${i}` }));
    const email = buildReminderEmail({ items: many, siteUrl: site });
    expect(email.text).toContain("...and 3 more.");
  });
});

describe("remindersEnabled", () => {
  it("is on unless turned off", () => {
    expect(remindersEnabled(undefined)).toBe(true);
    expect(remindersEnabled({})).toBe(true);
    expect(remindersEnabled({ followUpReminders: false })).toBe(false);
  });
});
