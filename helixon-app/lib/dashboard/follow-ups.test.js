import { describe, expect, it } from "vitest";
import { dayKey, followUpItems, followUpWhen, groupFollowUps, interviewFollowUpItems, isOverdue } from "./follow-ups";

const TZ = "Europe/London";
const now = new Date("2026-10-01T10:00:00Z"); // 11:00 in London

describe("followUpWhen", () => {
  it("dates days in the given time zone", () => {
    expect(dayKey("2026-09-30T23:30:00Z", TZ)).toBe("2026-10-01");
    expect(dayKey("2026-09-30T23:30:00Z", "UTC")).toBe("2026-09-30");
  });

  it("classifies timestamps", () => {
    expect(followUpWhen("2026-09-30T09:00:00Z", now, TZ)).toBe("overdue");
    expect(followUpWhen("2026-10-01T08:00:00Z", now, TZ)).toBe("overdue"); // earlier today
    expect(followUpWhen("2026-10-01T15:00:00Z", now, TZ)).toBe("today");
    expect(followUpWhen("2026-10-02T09:00:00Z", now, TZ)).toBe("upcoming");
    expect(followUpWhen(null, now, TZ)).toBe("undated");
  });

  it("treats a bare date as the whole day", () => {
    expect(followUpWhen("2026-10-01", now, TZ)).toBe("today");
    expect(followUpWhen("2026-09-30", now, TZ)).toBe("overdue");
  });

  it("isOverdue needs a real action", () => {
    expect(isOverdue({ label: "Call", dueAt: "2026-09-29T09:00:00Z" }, now, TZ)).toBe(true);
    expect(isOverdue({ label: "Call", dueAt: null }, now, TZ)).toBe(false);
    expect(isOverdue(null, now, TZ)).toBe(false);
  });
});

describe("followUpItems", () => {
  const rows = [
    { id: "a", full_name: "Ana", recruiter_id: "u1", next_action: { label: "Call", dueAt: "2026-10-05T09:00:00Z" }, jobs: { title: "Dev" } },
    { id: "b", full_name: "Ben", recruiter_id: "u2", next_action: { label: "Chase client", dueAt: "2026-09-28T09:00:00Z" } },
    { id: "c", full_name: "Cat", talent_pool_at: "2026-01-01", talent_pool_check_in: "2026-10-01" },
    { id: "d", full_name: "Dan", talent_pool_at: null, talent_pool_check_in: "2026-10-01" },
  ];

  it("lists actions and pool check-ins, most urgent first", () => {
    const items = followUpItems(rows, now, TZ);
    expect(items.map((i) => [i.candidateName, i.kind, i.when])).toEqual([
      ["Ben", "action", "overdue"],
      ["Cat", "check_in", "today"],
      ["Ana", "action", "upcoming"],
    ]);
    expect(groupFollowUps(items).overdue).toHaveLength(1);
  });
});

describe("interviewFollowUpItems", () => {
  it("lists this week's interviews and past ones still scheduled", () => {
    const rows = [
      { id: "1", status: "scheduled", candidate_id: "a", round: 1, starts_at: "2026-10-01T14:00:00Z", duration_minutes: 60, candidates: { full_name: "Ana" } },
      { id: "2", status: "scheduled", candidate_id: "b", round: 2, starts_at: "2026-09-30T09:00:00Z", duration_minutes: 60, candidates: { full_name: "Ben" } },
      { id: "3", status: "scheduled", candidate_id: "c", round: 1, starts_at: "2026-10-20T09:00:00Z", duration_minutes: 60 },
      { id: "4", status: "completed", candidate_id: "d", round: 1, starts_at: "2026-09-30T09:00:00Z", duration_minutes: 60 },
    ];
    const items = interviewFollowUpItems(rows, now, TZ);
    expect(items.map((i) => [i.candidateName, i.when])).toEqual([
      ["Ana", "today"],
      ["Ben", "overdue"],
    ]);
    expect(items[1].label).toMatch(/Record interview outcome/);
  });
});
