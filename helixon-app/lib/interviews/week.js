// Week view helpers for /dashboard/interviews. Weeks run Monday to Sunday in
// the viewer's local time.

const DAY = 86400000;

// Midnight on the Monday of the week containing `date`.
export function startOfWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return d;
}

export function addWeeks(start, n) {
  const d = new Date(start);
  d.setDate(d.getDate() + n * 7);
  return d;
}

// The seven days of the week starting `start`, as Date objects at midnight.
export function weekDays(start) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

// Interviews bucketed into the seven days (index 0 = Monday), each day
// sorted by start time. Interviews outside the week are dropped.
export function groupByWeekday(interviews, start) {
  const days = Array.from({ length: 7 }, () => []);
  const from = new Date(start).getTime();
  for (const i of interviews ?? []) {
    const t = new Date(i.startsAt);
    if (Number.isNaN(t.getTime())) continue;
    const midnight = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
    // Round, not floor: a clock change inside the week makes one day 23 or 25 hours.
    const index = Math.round((midnight - from) / DAY);
    if (index >= 0 && index < 7) days[index].push(i);
  }
  for (const list of days) list.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  return days;
}

// "6 – 12 October 2026", "29 September – 5 October 2026"
export function weekLabel(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const first = start.toLocaleDateString("en-GB", sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" });
  const last = end.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `${first} – ${last}`;
}
