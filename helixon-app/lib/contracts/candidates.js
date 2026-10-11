// Candidates as the API returns them: one page of the list
// (GET /api/candidates, lib/candidates/list.js), the per-stage counts
// (GET /api/candidates/stage-counts) and one profile
// (GET /api/candidates/[id], lib/candidates/profile.js).

import { z } from "zod";
import { nullableNumber, nullableString, timestamp } from "./common";
import { JobRowSchema } from "./jobs";

// candidates.next_action (app/api/candidates/[id]/next-action).
export const NextActionSchema = z.looseObject({
  label: z.string(),
  dueAt: nullableString.optional(),
  completed: z.boolean().optional(),
});

const common = {
  id: z.string(),
  fullName: z.string(),
  currentTitle: nullableString,
  currentCompany: nullableString,
  location: nullableString,
  jobId: nullableString,
  jobTitle: z.string(),
  company: nullableString,
  recruiterId: nullableString,
  recruiterName: nullableString,
  // candidates.processing_status
  status: nullableString,
  stage: nullableString,
  subStage: nullableString,
  score: nullableNumber,
  tags: z.array(z.string()),
  nextAction: NextActionSchema.nullable(),
  source: nullableString,
  createdAt: timestamp.nullable(),
  lastActivityAt: timestamp.nullable(),
};

export const CandidateListItemSchema = z.strictObject({
  ...common,
  skills: z.array(z.unknown()),
  // The amber "possibly AI-written" prompt (lib/screening/ai-writing.js).
  aiWritten: z.boolean(),
  inTalentPool: z.boolean(),
  // Only with a radius search.
  distanceMiles: nullableNumber,
});

export const CandidateListPageSchema = z.strictObject({
  items: z.array(CandidateListItemSchema),
  total: z.number().int(),
  searchMode: z.enum(["boolean", "text"]).nullable(),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalPages: z.number().int(),
});

// { all, Screened, Shortlisted, ... } - one key per stage in
// lib/candidates/stage-labels.js, plus `all`.
export const StageCountsSchema = z.record(z.string(), z.number().int()).refine((c) => typeof c.all === "number", "all is required");

export const CandidateNoteSchema = z.strictObject({
  id: z.string(),
  author: nullableString,
  authorId: nullableString,
  createdAt: timestamp.nullable(),
  body: nullableString,
  pinnedAt: timestamp.nullable(),
});

export const CandidateActivitySchema = z.strictObject({
  id: z.string(),
  type: z.string(),
  actor: nullableString,
  meta: z.unknown(),
  timestamp: timestamp.nullable(),
});

export const OtherRoleSchema = z.strictObject({
  candidateId: z.string(),
  jobId: z.string(),
  jobTitle: z.string(),
  client: nullableString,
  score: nullableNumber,
  stage: nullableString,
});

export const TalentPoolEntrySchema = z.strictObject({
  savedAt: timestamp,
  savedBy: nullableString,
  note: nullableString,
  status: nullableString,
  checkIn: nullableString,
  expiresAt: timestamp.nullable(),
});

export const CandidateProfileSchema = z.strictObject({
  ...common,
  email: nullableString,
  phone: nullableString,
  linkedin: nullableString,
  yearsExperience: z.union([z.number(), z.string()]).nullable(),
  // The job row, with money hidden from members who can't see it.
  job: JobRowSchema.nullable(),
  customFields: z.record(z.string(), z.unknown()),
  matchSummary: nullableString,
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  skills: z.array(z.unknown()),
  education: z.array(z.unknown()),
  workHistory: z.array(
    z.strictObject({ title: z.string(), company: nullableString, start: nullableString, end: z.null(), description: z.null() })
  ),
  resume: z.strictObject({ name: z.string(), uploadedAt: timestamp.nullable() }).nullable(),
  hasCvText: z.boolean(),
  screenedBlind: z.boolean(),
  // The latest analysis; `report` is the same shape POST /api/run returns.
  analysis: z
    .strictObject({
      scoreId: z.string(),
      jobId: nullableString,
      jobTitle: nullableString,
      jobClient: nullableString,
      analysedAt: timestamp.nullable(),
      report: z.record(z.string(), z.unknown()),
    })
    .nullable(),
  talentPool: TalentPoolEntrySchema.nullable(),
  otherRoles: z.array(OtherRoleSchema),
  rejectionReason: nullableString,
  // Null for members who can't see money.
  placementFee: z.union([z.number(), z.string()]).nullable(),
  placementCost: z.union([z.number(), z.string()]).nullable(),
  // RETENTION_VALUES in app/api/candidates/[id]/details (a text column).
  retention30d: nullableString,
  retention90d: nullableString,
  notes: z.array(CandidateNoteSchema),
  activity: z.array(CandidateActivitySchema),
});

/** @typedef {z.infer<typeof NextActionSchema>} NextAction */
/** @typedef {z.infer<typeof CandidateListItemSchema>} CandidateListItem */
/** @typedef {z.infer<typeof CandidateListPageSchema>} CandidateListPage */
/** @typedef {z.infer<typeof StageCountsSchema>} StageCounts */
/** @typedef {z.infer<typeof CandidateNoteSchema>} CandidateNote */
/** @typedef {z.infer<typeof CandidateActivitySchema>} CandidateActivity */
/** @typedef {z.infer<typeof OtherRoleSchema>} OtherRole */
/** @typedef {z.infer<typeof TalentPoolEntrySchema>} TalentPoolEntry */
/** @typedef {z.infer<typeof CandidateProfileSchema>} CandidateProfile */
/**
 * The profile as the page uses it: job.company is the job's client
 * (shapeCandidate in lib/candidates/shape.js).
 * @typedef {Omit<CandidateProfile, "job"> & { job: (NonNullable<CandidateProfile["job"]> & { company: string | null }) | null }} ShapedCandidateProfile
 */
