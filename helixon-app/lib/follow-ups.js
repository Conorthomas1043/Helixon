// Follow-ups: the open "next action" on a candidate (candidates.next_action,
// { label, dueAt } - cleared when completed) and talent-pool check-in dates
// (candidates.talent_pool_check_in). Shared by the Overview's Follow-ups
// panel (app/api/follow-ups), its "Needs your attention" list
// (lib/dashboard-model.js) and the daily reminder email
// (app/api/cron/reminders), so "overdue" means the same thing everywhere.
//
// Days are calendar days in a given time zone - a follow-up due at 9am
// today isn't "overdue" at 8am, but one due yesterday is, whatever the hour.

export const DEFAULT_TIME_ZONE = "Europe/London";

// "YYYY-MM-DD" for `date` in `timeZone` (the browser's own when omitted).
export function dayKey(date, timeZone) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// When a follow-up falls relative to `now`: "overdue" (an earlier day, or
// earlier today for a timed action), "today", "upcoming", or "undated".
export function followUpWhen(dueAt, now = new Date(), timeZone) {
  if (!dueAt) return "undated";
  // A bare date (a check-in) is a whole day; a timestamp is a moment.
  const dateOnly = typeof dueAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueAt);
  const due = dateOnly ? dueAt : dayKey(dueAt, timeZone);
  const today = dayKey(now, timeZone);
  if (!due || !today) return "undated";
  if (due < today) return "overdue";
  if (due > today) return "upcoming";
  if (!dateOnly && new Date(dueAt).getTime() < now.getTime()) return "overdue";
  return "today";
}

export function isOverdue(nextAction, now = new Date(), timeZone) {
  return Boolean(nextAction?.label) && followUpWhen(nextAction.dueAt, now, timeZone) === "overdue";
}

// Follow-up items from candidate rows. Each row:
//   { id, full_name|name, recruiter_id, next_action, talent_pool_check_in,
//     talent_pool_at, jobs: { title } }
// One item per next action, plus one per talent-pool check-in.
export function followUpItems(rows, now = new Date(), timeZone) {
  const items = [];
  for (const r of rows || []) {
    const base = {
      candidateId: r.id,
      candidateName: r.full_name || r.name || "Unnamed candidate",
      jobTitle: r.jobs?.title ?? null,
      recruiterId: r.recruiter_id ?? null,
    };
    if (r.next_action?.label) {
      items.push({
        ...base,
        id: `${r.id}-action`,
        kind: "action",
        label: r.next_action.label,
        dueAt: r.next_action.dueAt ?? null,
        when: followUpWhen(r.next_action.dueAt, now, timeZone),
      });
    }
    if (r.talent_pool_at && r.talent_pool_check_in) {
      items.push({
        ...base,
        id: `${r.id}-checkin`,
        kind: "check_in",
        label: "Talent pool check-in",
        dueAt: r.talent_pool_check_in,
        when: followUpWhen(r.talent_pool_check_in, now, timeZone),
      });
    }
  }
  return sortFollowUps(items);
}

// Interviews as follow-ups: ones in the next week ("today"/"upcoming"),
// and ones that have happened but are still marked scheduled ("overdue" -
// record how it went). Rows: interviews with candidates(full_name, name,
// recruiter_id) and jobs(title).
export function interviewFollowUpItems(rows, now = new Date(), timeZone) {
  const weekAhead = now.getTime() + 7 * 86400000;
  const items = [];
  for (const r of rows || []) {
    if (r.status !== "scheduled") continue;
    const start = new Date(r.starts_at).getTime();
    if (Number.isNaN(start) || start > weekAhead) continue;
    const past = start + (r.duration_minutes || 60) * 60000 < now.getTime();
    items.push({
      id: `${r.id}-interview`,
      kind: "interview",
      candidateId: r.candidate_id,
      candidateName: r.candidates?.full_name || r.candidates?.name || "Unnamed candidate",
      jobTitle: r.jobs?.title ?? null,
      recruiterId: r.candidates?.recruiter_id ?? null,
      label: past ? `Record interview outcome (round ${r.round})` : `Interview, round ${r.round}`,
      dueAt: r.starts_at,
      when: past ? "overdue" : followUpWhen(r.starts_at, now, timeZone) === "today" ? "today" : "upcoming",
    });
  }
  return items;
}

const WHEN_RANK = { overdue: 0, today: 1, upcoming: 2, undated: 3 };

// Merges follow-up lists, most urgent first.
export function sortFollowUps(items) {
  return [...items].sort((a, b) => WHEN_RANK[a.when] - WHEN_RANK[b.when] || String(a.dueAt ?? "").localeCompare(String(b.dueAt ?? "")));
}

export function groupFollowUps(items) {
  const groups = { overdue: [], today: [], upcoming: [], undated: [] };
  for (const item of items || []) groups[item.when]?.push(item);
  return groups;
}
