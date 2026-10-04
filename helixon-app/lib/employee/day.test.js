import { describe, expect, it } from "vitest";
import {
  addDays,
  completedSince,
  daysBetween,
  eventsOnDay,
  followUps,
  goalProgress,
  groupTasks,
  myOpenGoals,
  relativeDayLabel,
  startOfWeekKey,
  taskBucket,
  toDayKey,
  upcomingEvents,
} from "./day";

const TODAY = "2026-09-29"; // a Tuesday

describe("day keys", () => {
  it("keeps a plain date as the same calendar day", () => {
    expect(toDayKey("2026-09-29")).toBe("2026-09-29");
  });

  it("converts a timestamp to its local calendar day", () => {
    const local = new Date(2026, 8, 29, 23, 30);
    expect(toDayKey(local.toISOString())).toBe("2026-09-29");
  });

  it("does day arithmetic across month ends", () => {
    expect(addDays("2026-09-29", 3)).toBe("2026-10-02");
    expect(daysBetween("2026-09-29", "2026-10-02")).toBe(3);
    expect(daysBetween("2026-09-29", "2026-09-27")).toBe(-2);
  });

  it("finds the Monday of the week", () => {
    expect(startOfWeekKey(TODAY)).toBe("2026-09-28");
    expect(startOfWeekKey("2026-10-04")).toBe("2026-09-28"); // Sunday
  });

  it("labels nearby days in words", () => {
    expect(relativeDayLabel(TODAY, TODAY)).toBe("Today");
    expect(relativeDayLabel("2026-09-30", TODAY)).toBe("Tomorrow");
    expect(relativeDayLabel("2026-09-28", TODAY)).toBe("Yesterday");
    expect(relativeDayLabel("2026-10-02", TODAY)).toBe("Friday");
    expect(relativeDayLabel("2026-10-20", TODAY)).toBe("20 Oct");
  });
});

describe("taskBucket", () => {
  it("treats a task due today as due today, not overdue", () => {
    expect(taskBucket({ due_date: TODAY }, TODAY)).toBe("today");
  });

  it("sorts tasks into overdue, upcoming, later and someday", () => {
    expect(taskBucket({ due_date: "2026-09-28" }, TODAY)).toBe("overdue");
    expect(taskBucket({ due_date: "2026-10-06" }, TODAY)).toBe("upcoming");
    expect(taskBucket({ due_date: "2026-10-07" }, TODAY)).toBe("later");
    expect(taskBucket({ due_date: null }, TODAY)).toBe("someday");
  });

  it("puts done tasks in done whatever their date", () => {
    expect(taskBucket({ done: true, due_date: "2026-09-01" }, TODAY)).toBe("done");
  });
});

describe("groupTasks", () => {
  it("orders each section by due date, then priority", () => {
    const tasks = [
      { id: "a", due_date: "2026-10-01", priority: "low" },
      { id: "b", due_date: "2026-10-01", priority: "high" },
      { id: "c", due_date: "2026-09-30", priority: "low" },
      { id: "d", due_date: TODAY, priority: "medium" },
      { id: "e", done: true, due_date: TODAY },
    ];
    const g = groupTasks(tasks, TODAY);
    expect(g.upcoming.map((t) => t.id)).toEqual(["c", "b", "a"]);
    expect(g.today.map((t) => t.id)).toEqual(["d"]);
    expect(g.done.map((t) => t.id)).toEqual(["e"]);
  });

  it("counts tasks completed since a day", () => {
    const tasks = [
      { done: true, updated_at: "2026-09-29T10:00:00" },
      { done: true, updated_at: "2026-09-20T10:00:00" },
      { done: false, updated_at: "2026-09-29T10:00:00" },
    ];
    expect(completedSince(tasks, "2026-09-28")).toBe(1);
  });
});

describe("goals", () => {
  it("measures progress from checklist items", () => {
    expect(goalProgress({ items: [{ done: true }, { done: false }, { done: true }, { done: true }] })).toEqual({ done: 3, total: 4, pct: 75 });
    expect(goalProgress({ items: [], status: "in_progress" }).pct).toBe(0);
  });

  it("lists open goals assigned to me, or mine with no assignee, blocked first", () => {
    const goals = [
      { id: "1", status: "in_progress", assigned_to: "me", deadline: "2026-10-10" },
      { id: "2", status: "blocked", assigned_to: "me" },
      { id: "3", status: "not_started", created_by: "me", assigned_to: null },
      { id: "4", status: "in_progress", created_by: "me", assigned_to: "someone" },
      { id: "5", status: "done", assigned_to: "me" },
    ];
    expect(myOpenGoals(goals, "me").map((g) => g.id)).toEqual(["2", "1", "3"]);
  });
});

describe("followUps", () => {
  const call = (over) => ({ id: Math.random().toString(36), employee_id: "me", outcome: "callback_requested", called_at: "2026-09-20T10:00:00Z", ...over });

  it("returns my due and upcoming follow-ups", () => {
    const calls = [
      call({ phone: "0111", follow_up_at: "2026-09-29T09:00:00" }),
      call({ phone: "0222", follow_up_at: "2026-09-25T09:00:00" }),
      call({ phone: "0333", follow_up_at: "2026-10-02T09:00:00" }),
      call({ phone: "0444", follow_up_at: "2026-10-20T09:00:00" }),
      call({ phone: "0555", follow_up_at: "2026-09-29T09:00:00", employee_id: "someone-else" }),
    ];
    const { due, upcoming } = followUps(calls, "me", TODAY);
    expect(due.map((c) => c.phone)).toEqual(["0222", "0111"]);
    expect(upcoming.map((c) => c.phone)).toEqual(["0333"]);
  });

  it("drops a follow-up once the contact has been called again", () => {
    const calls = [
      call({ phone: "07700 900123", follow_up_at: "2026-09-28T09:00:00" }),
      call({ phone: "07700900123", called_at: "2026-09-28T11:00:00Z", outcome: "no_answer" }),
    ];
    expect(followUps(calls, "me", TODAY).due).toEqual([]);
  });

  it("ignores follow-up dates on closed outcomes", () => {
    const calls = [call({ phone: "0111", follow_up_at: "2026-09-29T09:00:00", outcome: "meeting_booked" })];
    expect(followUps(calls, "me", TODAY).due).toEqual([]);
  });
});

describe("calendar", () => {
  const ev = (over) => ({ id: Math.random().toString(36), all_day: false, ...over });

  it("finds events on a day, all-day and multi-day ones included", () => {
    const events = [
      ev({ id: "timed", start_at: "2026-09-29T14:00:00", end_at: "2026-09-29T15:00:00" }),
      ev({ id: "allday", all_day: true, start_at: "2026-09-29T00:00:00", end_at: "2026-09-29T23:59:00" }),
      ev({ id: "span", start_at: "2026-09-27T09:00:00", end_at: "2026-10-01T17:00:00" }),
      ev({ id: "other", start_at: "2026-09-30T09:00:00", end_at: "2026-09-30T10:00:00" }),
    ];
    expect(eventsOnDay(events, TODAY).map((e) => e.id)).toEqual(["allday", "span", "timed"]);
  });

  it("lists events in the coming week, soonest first", () => {
    const events = [
      ev({ id: "b", start_at: "2026-10-03T09:00:00" }),
      ev({ id: "a", start_at: "2026-09-30T09:00:00" }),
      ev({ id: "today", start_at: "2026-09-29T09:00:00" }),
      ev({ id: "far", start_at: "2026-10-20T09:00:00" }),
    ];
    expect(upcomingEvents(events, TODAY).map((e) => e.id)).toEqual(["a", "b"]);
  });
});
