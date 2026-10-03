import { describe, expect, it } from "vitest";
import { addWeeks, groupByWeekday, startOfWeek, weekDays, weekLabel } from "./interview-week";

describe("interview week", () => {
  it("starts weeks on Monday", () => {
    const sunday = new Date(2026, 9, 4, 15, 0); // Sun 4 Oct 2026
    const start = startOfWeek(sunday);
    expect(start.getDay()).toBe(1);
    expect(start.getDate()).toBe(28); // Mon 28 Sep
    expect(start.getHours()).toBe(0);
    expect(startOfWeek(new Date(2026, 9, 5, 9)).getDate()).toBe(5); // a Monday is its own start
  });

  it("lists seven days and moves by weeks", () => {
    const start = startOfWeek(new Date(2026, 9, 7));
    const days = weekDays(start);
    expect(days).toHaveLength(7);
    expect(days[6].getDay()).toBe(0);
    expect(addWeeks(start, 1).getDate()).toBe(12);
    expect(addWeeks(start, -1).getDate()).toBe(28);
  });

  it("buckets interviews by weekday, sorted, dropping other weeks", () => {
    const start = startOfWeek(new Date(2026, 9, 7));
    const at = (d, h) => new Date(2026, 9, d, h).toISOString();
    const days = groupByWeekday(
      [
        { id: "b", startsAt: at(7, 14) },
        { id: "a", startsAt: at(7, 9) },
        { id: "mon", startsAt: at(5, 10) },
        { id: "sun", startsAt: at(11, 23) },
        { id: "next", startsAt: at(12, 9) },
        { id: "bad", startsAt: "nope" },
      ],
      start
    );
    expect(days[0].map((i) => i.id)).toEqual(["mon"]);
    expect(days[2].map((i) => i.id)).toEqual(["a", "b"]);
    expect(days[6].map((i) => i.id)).toEqual(["sun"]);
    expect(days.flat()).toHaveLength(4);
  });

  it("labels the week", () => {
    expect(weekLabel(new Date(2026, 9, 5))).toBe("5 – 11 October 2026");
    expect(weekLabel(new Date(2026, 8, 28))).toBe("28 September – 4 October 2026");
  });
});
