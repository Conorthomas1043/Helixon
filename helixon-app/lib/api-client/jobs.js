"use client";

// Dashboard API calls: jobs (re-exported by lib/dashboard-api.js).

import { track } from "@/lib/analytics";
import { apiFetch } from "./core";

// Job rows come back from the API in their raw (snake_case) DB column
// names; the pages use a camelCase job shape, so adapt here rather than in
// every page.
export function adaptJob(j) {
  return {
    ...j,
    company: j.client,
    clientEmail: j.client_email ?? null,
    clientId: j.client_id ?? null,
    contactId: j.contact_id ?? null,
    published: Boolean(j.published),
    publishedAt: j.published_at ?? null,
    publicTitle: j.public_title ?? null,
    publicDescription: j.public_description ?? null,
    hideClient: j.hide_client ?? true,
    showSalary: j.show_salary ?? true,
    employmentType: j.employment_type,
    salaryRange: j.salary_range,
    requiredSkills: j.required_skills ?? [],
    preferredSkills: j.preferred_skills ?? [],
    minYearsExperience: j.min_years_experience,
    // lib/job-details.js - owner falls back to whoever created the job.
    ownerId: j.owner_id || j.user_id || null,
    openings: j.openings ?? null,
    feePercent: j.fee_percent == null ? null : Number(j.fee_percent),
    feeAmount: j.fee_amount == null ? null : Number(j.fee_amount),
    priority: j.priority ?? null,
    targetDate: j.target_date ?? null,
    officeId: j.office_id ?? null,
  };
}

// Creates a job directly (not as a side effect of screening a CV) - see
// app/api/jobs/route.js's POST. `fields`: { title, company, location,
// employmentType, seniority, salaryRange, requiredSkills, preferredSkills,
// minYearsExperience, jobText }.
export async function createJob(fields) {
  const job = await apiFetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  track("job_created", { source: "manual" });
  return adaptJob(job);
}

export async function getJobs() {
  const jobs = await apiFetch("/api/jobs");
  return jobs.map(adaptJob);
}

export async function getJobById(id) {
  const job = await apiFetch(`/api/jobs/${id}`);
  return adaptJob(job);
}

export async function getJobCandidates(jobId) {
  return apiFetch(`/api/jobs/${jobId}/candidates`);
}

// Sourcing-channel clicks/spend for one job - see
// app/api/jobs/[id]/channels/route.js.
export async function getJobChannels(jobId) {
  const res = await apiFetch(`/api/jobs/${jobId}/channels`);
  return res.channels;
}

export async function setJobChannel(jobId, { channel, clicks, spend }) {
  const res = await apiFetch(`/api/jobs/${jobId}/channels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, clicks, spend }),
  });
  return res.channel;
}

export async function updateJobStatus(jobId, status) {
  return apiFetch(`/api/jobs/${jobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

// `fields` is whatever subset of { title, client, location, employmentType,
// seniority, minYearsExperience, requiredSkills, preferredSkills, status }
// changed - api/jobs/[id]'s PATCH only updates the keys actually present.
export async function updateJob(jobId, fields) {
  const job = await apiFetch(`/api/jobs/${jobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return adaptJob(job.job);
}

// Refuses (409) if the job has any candidates attached - see api/jobs/[id]'s
// DELETE handler for why.
export async function deleteJob(jobId) {
  return apiFetch(`/api/jobs/${jobId}`, { method: "DELETE" });
}
