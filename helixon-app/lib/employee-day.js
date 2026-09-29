// lib/employee-day.js
// Pure helpers behind the employee dashboard's "your day" view: which
// bucket a task falls in, goal progress, which cold-call follow-ups are
// due, and what's on the calendar. No fetching and no React, so they can be
// unit tested (lib/employee-day.test.js).
//
// Dates are compared as local calendar days ("YYYY-MM-DD" keys), never as
// timestamps. A to-do's due_date is a plain date; parsing it with
// new Date("2026-09-29") gives UTC midnight, which made a task due today
// read as overdue for anyone east of UTC and, west of UTC, as due
// yesterday.

export const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad(n) {
  return String(n).padStart(2, "0");
}

/** Local calendar day of a Date (or now) as "YYYY-MM-DD". */
export function dayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Day key for a stored value: a plain "YYYY-MM-DD" is taken as-is; a full
 * timestamp is converted to the local day it falls on.
 */
export function toDayKey(value) {
  if (!value) return null;
  const s = String(value);
  if (DATE_ONLY_RE.test(s)) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : dayKey(d);
}

/** Local Date at midnight for a day key. */
export function fromDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Whole days from `fromKey` to `toKey` (negative when `toKey` is earlier). */
export function daysBetween(fromKey, toKey) {
  return Math.round((fromDayKey(toKey) - fromDayKey(fromKey)) / DAY_MS);
}

/** "Today", "Tomorrow", "Yesterday", a weekday within the week, else "3 Oct". */
export function relativeDayLabel(key, todayKey = dayKey()) {
  if (!key) return "";
  const diff = daysBetween(todayKey, key);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const d = fromDayKey(key);
  if (diff > 1 && diff < 7) return d.toLocaleDateString("en-GB", { weekday: "long" });
  const sameYear = key.slice(0, 4) === todayKey.slice(0, 4);
  return d.toLocaleDateString("en-GB", sameYear ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", year: "numeric" });
}

/* ── Tasks ─────────────────────────────────────────────────────────────── */

export const TASK_BUCKETS = ["overdue", "today", "upcoming", "later", "someday", "done"];

/** Which list section a to-do belongs in. "upcoming" is the next 7 days. */
export function taskBucket(task, todayKey = dayKey()) {
  if (task.done) return "done";
  const due = toDayKey(task.due_date);
  if (!due) return "someday";
  const diff = daysBetween(todayKey, due);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  if (diff <= 7) return "upcoming";
  return "later";
}

function byDueThenPriority(a, b) {
  const da = toDayKey(a.due_date);
  const db = toDayKey(b.due_date);
  if (da !== db) {
    if (!da) return 1;
    if (!db) return -1;
    return da < db ? -1 : 1;
  }
  const pa = PRIORITY_ORDER[a.priority || "medium"] ?? 1;
  const pb = PRIORITY_ORDER[b.priority || "medium"] ?? 1;
  if (pa !== pb) return pa - pb;
  return String(b.created_at || "").localeCompare(String(a.created_at || ""));
}

/** Tasks split into TASK_BUCKETS, each sorted by due date then priority. */
export function groupTasks(tasks, todayKey = dayKey()) {
  const groups = Object.fromEntries(TASK_BUCKETS.map((b) => [b, []]));
  for (const t of tasks) groups[taskBucket(t, todayKey)].push(t);
  for (const b of TASK_BUCKETS) {
    if (b === "done") {
      groups.done.sort((a, z) => String(z.updated_at || z.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
    } else {
      groups[b].sort(byDueThenPriority);
    }
  }
  return groups;
}

/** Tasks completed on or after `sinceKey` (uses updated_at as the completion time). */
export function completedSince(tasks, sinceKey) {
  return tasks.filter((t) => t.done && toDayKey(t.updated_at || t.created_at) >= sinceKey).length;
}

/** Monday of the week containing `key`. */
export function startOfWeekKey(key = dayKey()) {
  const d = fromDayKey(key);
  const offset = (d.getDay() + 6) % 7;
  return addDays(key, -offset);
}

/* ── Goals ─────────────────────────────────────────────────────────────── */

export function goalProgress(goal) {
  const items = goal.items || [];
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  if (total === 0) return { done: 0, total: 0, pct: goal.status === "done" ? 100 : 0 };
  return { done, total, pct: Math.round((done / total) * 100) };
}

/**
 * Open goals this employee is responsible for: assigned to them, or created
 * by them with nobody else assigned. Blocked first, then by deadline.
 */
export function myOpenGoals(goals, employeeId) {
  const rank = { blocked: 0, in_progress: 1, not_started: 2 };
  return goals
    .filter((g) => g.status !== "done")
    .filter((g) => g.assigned_to === employeeId || (g.created_by === employeeId && !g.assigned_to))
    .sort((a, b) => {
      const r = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      if (r !== 0) return r;
      const da = toDayKey(a.deadline);
      const db = toDayKey(b.deadline);
      if (da === db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : 1;
    });
}

/* ── Cold-call follow-ups ──────────────────────────────────────────────── */

// Once a call ends like this, a follow-up date left on it isn't a to-do.
const CLOSED_OUTCOMES = new Set(["meeting_booked", "not_interested", "wrong_number"]);

function contactKey(call) {
  const phone = (call.phone || "").replace(/\D/g, "");
  if (phone) return `p:${phone}`;
  const who = `${call.contact_name || ""}|${call.company || ""}`.trim().toLowerCase();
  return who === "|" ? `id:${call.id}` : `n:${who}`;
}

/**
 * This employee's follow-ups: calls they logged with a follow-up date, where
 * they haven't called that contact again since. `due` is today or earlier
 * (oldest first), `upcoming` is the next 7 days.
 */
export function followUps(calls, employeeId, todayKey = dayKey()) {
  const mine = calls.filter((c) => c.employee_id === employeeId);
  const latestCall = new Map();
  for (const c of mine) {
    const k = contactKey(c);
    const prev = latestCall.get(k);
    if (!prev || String(c.called_at) > String(prev)) latestCall.set(k, c.called_at);
  }

  const due = [];
  const upcoming = [];
  for (const c of mine) {
    if (!c.follow_up_at || CLOSED_OUTCOMES.has(c.outcome)) continue;
    if (String(latestCall.get(contactKey(c))) > String(c.called_at)) continue; // called again since
    const key = toDayKey(c.follow_up_at);
    if (!key) continue;
    const diff = daysBetween(todayKey, key);
    if (diff <= 0) due.push({ ...c, followUpKey: key });
    else if (diff <= 7) upcoming.push({ ...c, followUpKey: key });
  }
  const byKey = (a, b) => (a.followUpKey < b.followUpKey ? -1 : a.followUpKey > b.followUpKey ? 1 : 0);
  return { due: due.sort(byKey), upcoming: upcoming.sort(byKey) };
}

/* ── Calendar ──────────────────────────────────────────────────────────── */

/** Events that touch the given day (multi-day and all-day events included). */
export function eventsOnDay(events, key) {
  return events
    .filter((e) => {
      const start = toDayKey(e.start_at);
      const end = toDayKey(e.end_at || e.start_at) || start;
      return start && start <= key && key <= end;
    })
    .sort((a, b) => {
      if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
      return String(a.start_at).localeCompare(String(b.start_at));
    });
}

/** Events starting after today and within `days` days, soonest first. */
export function upcomingEvents(events, todayKey = dayKey(), days = 7) {
  const last = addDays(todayKey, days);
  return events
    .filter((e) => {
      const start = toDayKey(e.start_at);
      return start && start > todayKey && start <= last;
    })
    .sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
}

export function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
