// Server-side loading for the public jobs pages (/jobs/<slug>...). Only
// agencies with their jobs page switched on, and only published, open jobs.

import { supabase } from "@/lib/supabase";
import { cleanUuid } from "@/lib/sanitize";
import { isLive, toPublicJob, validSlug } from "@/lib/careers";
import { fillNotice } from "@/lib/privacy-notice";
import { normaliseSettings } from "@/lib/privacy-settings";

const AGENCY_COLUMNS = "id, name, settings, careers_slug, careers_enabled, careers_intro, careers_website, suspended_at";
const JOB_COLUMNS =
  "id, agency_id, user_id, title, public_title, client, location, employment_type, seniority, salary_range, public_description, job_text, parsed, required_skills, preferred_skills, min_years_experience, status, published, published_at, hide_client, show_salary, created_at";

export async function loadCareersAgency(slug) {
  if (!validSlug(slug)) return null;
  const { data } = await supabase.from("agencies").select(AGENCY_COLUMNS).eq("careers_slug", slug).maybeSingle();
  if (!data || !data.careers_enabled || data.suspended_at) return null;
  return data;
}

export async function listPublicJobs(agency) {
  const { data } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .eq("agency_id", agency.id)
    .eq("published", true)
    .eq("status", "open")
    .order("published_at", { ascending: false })
    .limit(200);
  return (data ?? []).map(toPublicJob);
}

// { agency, job (raw row), publicJob } or null.
export async function loadPublicJob(slug, rawJobId) {
  const agency = await loadCareersAgency(slug);
  const jobId = cleanUuid(rawJobId);
  if (!agency || !jobId) return null;
  const { data: job } = await supabase.from("jobs").select(JOB_COLUMNS).eq("id", jobId).eq("agency_id", agency.id).maybeSingle();
  if (!job || !isLive(job, agency)) return null;
  return { agency, job, publicJob: toPublicJob(job) };
}

export function agencyNotice(agency) {
  const s = agency.settings || {};
  return fillNotice({
    agencyName: agency.name,
    retentionMonths: normaliseSettings(s).retentionMonths,
    contactEmail: s.careers_privacy_email,
    custom: s.careers_privacy_notice,
  });
}

// Counts a visit from a tracked link (?src=) against the job's channel, so
// the Sourcing panel fills itself in. Best effort.
export async function recordChannelVisit(agencyId, jobId, channel) {
  try {
    const { data: row } = await supabase.from("job_channels").select("id, clicks").eq("job_id", jobId).eq("channel", channel).maybeSingle();
    if (row) {
      await supabase.from("job_channels").update({ clicks: row.clicks + 1, updated_at: new Date().toISOString() }).eq("id", row.id);
    } else {
      await supabase.from("job_channels").insert({ agency_id: agencyId, job_id: jobId, channel, clicks: 1, created_by: "jobs page" });
    }
  } catch {
    // Never let tracking break the page.
  }
}
