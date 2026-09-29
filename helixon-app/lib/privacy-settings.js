// Each agency's privacy choices, kept in agencies.settings:
//
//   retention_months   delete candidates after this many months without any
//                      activity (GDPR storage limitation). Talent pool
//                      entries last the same time unless extended.
//   presence_enabled   whether the Team page shows who's online (staff
//                      monitoring - an agency can switch it off)
//
// Defaults apply until an owner or admin changes them on /dashboard/privacy.

export const RETENTION_CHOICES = [6, 12, 24, 36];
export const DEFAULT_RETENTION_MONTHS = 12;
export const RETENTION_WARNING_DAYS = 30;

export function normaliseSettings(settings) {
  const s = settings && typeof settings === "object" ? settings : {};
  return {
    retentionMonths: RETENTION_CHOICES.includes(s.retention_months) ? s.retention_months : DEFAULT_RETENTION_MONTHS,
    presenceEnabled: s.presence_enabled !== false,
  };
}

export async function getAgencyPrivacy(supabase, agencyId) {
  const { data, error } = await supabase.from("agencies").select("settings").eq("id", agencyId).maybeSingle();
  if (error) throw new Error(error.message);
  return { ...normaliseSettings(data?.settings), rawSettings: data?.settings || {} };
}

// Adds months to a date, clamped to the month's last day (31 Jan + 1 month
// is 28/29 Feb, not 3 March).
export function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

// Candidates whose last activity is before this are due for deletion.
export function retentionCutoff(months, now = new Date()) {
  return addMonths(now, -months);
}

// When a candidate last active at `lastActiveAt` will be deleted.
export function deletionDate(lastActiveAt, months) {
  return addMonths(new Date(lastActiveAt), months);
}
