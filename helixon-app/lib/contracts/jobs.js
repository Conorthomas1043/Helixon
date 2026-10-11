// Jobs as the API returns them (GET /api/jobs, GET /api/jobs/[id]) and as
// the pages use them (adaptJob in lib/api-client/jobs.js).
//
// The API keeps the database's column names, so a row carries every column
// of `jobs`; the contract names the ones the pages read and lets the rest
// through. The screening counts are added by lib/job-list.js.

import { z } from "zod";
import { nullableNumber, nullableString, timestamp } from "./common";

// A number column can come back as a string from Postgres (numeric).
const numeric = z.union([z.number(), z.string()]).nullable().optional();

export const JobCountsSchema = z.object({
  candidateCount: z.number().int(),
  strongMatches: z.number().int(),
  shortlisted: z.number().int(),
  interviewing: z.number().int(),
  offers: z.number().int(),
  placed: z.number().int(),
});

export const JobRowSchema = z.looseObject({
  id: z.string(),
  agency_id: nullableString,
  user_id: nullableString.optional(),
  owner_id: nullableString.optional(),
  title: nullableString,
  client: nullableString.optional(),
  client_id: nullableString.optional(),
  client_email: nullableString.optional(),
  contact_id: nullableString.optional(),
  status: nullableString.optional(),
  is_saved: z.boolean().nullable().optional(),
  location: nullableString.optional(),
  employment_type: nullableString.optional(),
  seniority: nullableString.optional(),
  salary_range: nullableString.optional(),
  required_skills: z.array(z.string()).nullable().optional(),
  preferred_skills: z.array(z.string()).nullable().optional(),
  min_years_experience: nullableNumber.optional(),
  published: z.boolean().nullable().optional(),
  published_at: timestamp.nullable().optional(),
  public_title: nullableString.optional(),
  public_description: nullableString.optional(),
  hide_client: z.boolean().nullable().optional(),
  show_salary: z.boolean().nullable().optional(),
  openings: nullableNumber.optional(),
  // Null, with financialsHidden set, for members who can't see money
  // (redactJob in lib/permissions.js).
  fee_percent: numeric,
  fee_amount: numeric,
  financialsHidden: z.boolean().optional(),
  priority: nullableString.optional(),
  target_date: nullableString.optional(),
  office_id: nullableString.optional(),
  created_at: timestamp.nullable(),
});

// One job in GET /api/jobs, and the body of GET /api/jobs/[id].
export const JobWithCountsSchema = JobRowSchema.extend(JobCountsSchema.shape);
export const JobListSchema = z.array(JobWithCountsSchema);

/** @typedef {z.infer<typeof JobRowSchema>} JobRow */
/** @typedef {z.infer<typeof JobCountsSchema>} JobCounts */
/** @typedef {z.infer<typeof JobWithCountsSchema>} JobWithCounts */

/**
 * A job as the pages use it: the API row plus camelCase names for the
 * columns they read (adaptJob in lib/api-client/jobs.js).
 *
 * @typedef {JobRow & Partial<JobCounts> & {
 *   company: string | null | undefined,
 *   clientEmail: string | null,
 *   clientId: string | null,
 *   contactId: string | null,
 *   published: boolean,
 *   publishedAt: string | null,
 *   publicTitle: string | null,
 *   publicDescription: string | null,
 *   hideClient: boolean,
 *   showSalary: boolean,
 *   employmentType: string | null | undefined,
 *   salaryRange: string | null | undefined,
 *   requiredSkills: string[],
 *   preferredSkills: string[],
 *   minYearsExperience: number | null | undefined,
 *   ownerId: string | null,
 *   openings: number | null,
 *   feePercent: number | null,
 *   feeAmount: number | null,
 *   priority: string | null,
 *   targetDate: string | null,
 *   officeId: string | null,
 * }} Job
 */
