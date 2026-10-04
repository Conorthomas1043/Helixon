// Request body schemas for the customer API (used with customerRoute's
// `body` option). They check shape and types at the edge: a JSON object,
// scalars where scalars belong, lists where lists belong. Business rules
// (allowed statuses, ranges, lengths) stay in the cleaners each route already
// uses (lib/clients.js, lib/placements.js, ...), which also accept numbers
// typed as text, so these schemas do too. Unknown keys pass through.

import { z } from "zod";

const text = z.union([z.string(), z.number()]).nullable().optional();
const num = z.union([z.number(), z.string()]).nullable().optional();
const flag = z.boolean().nullable().optional();
const id = z.string().max(100).nullable().optional();
const date = z.string().max(40).nullable().optional();
const stringList = z.union([z.array(z.string()), z.string()]).nullable().optional();

// Any JSON object. The baseline for routes without a field-level schema.
export const JsonObject = z.looseObject({});

export const ClientInput = z.looseObject({
  name: text,
  website: text,
  industry: text,
  address: text,
  termsNotes: text,
  status: text,
  ownerId: id,
  feePercent: num,
  paymentTermsDays: num,
  rebateDays: num,
});

export const JobInput = z.looseObject({
  title: text,
  client: text,
  company: text,
  clientId: id,
  contactId: id,
  clientEmail: text,
  location: text,
  employmentType: text,
  seniority: text,
  salaryRange: text,
  minYearsExperience: num,
  requiredSkills: stringList,
  preferredSkills: stringList,
  jobText: text,
  status: text,
  published: flag,
  publicTitle: text,
  publicDescription: text,
  hideClient: flag,
  showSalary: flag,
  ownerId: id,
  officeId: id,
  openings: num,
  priority: text,
  targetDate: date,
  feePercent: num,
  feeAmount: num,
});

export const PlacementInput = z.looseObject({
  candidateId: id,
  kind: text,
  status: text,
  currency: text,
  rateUnit: text,
  feeAmount: num,
  feePercent: num,
  rebateDays: num,
  notes: text,
  splits: z.array(z.looseObject({ recruiterId: z.string(), percent: z.union([z.number(), z.string()]) })).nullable().optional(),
});

export const InterviewInput = z.looseObject({
  candidateId: id,
  contactId: id,
  startsAt: date,
  durationMinutes: num,
  kind: text,
  round: num,
  location: text,
  interviewers: text,
  notes: text,
  status: text,
  outcome: text,
  moveToInterview: flag,
  notify: flag,
  invite: z
    .looseObject({ candidate: flag, contact: flag, extra: z.array(z.string()).optional() })
    .nullable()
    .optional(),
});

export const OpportunityInput = z.looseObject({
  clientId: id,
  contactId: id,
  jobId: id,
  title: text,
  stage: text,
  value: num,
  probability: num,
  expectedClose: date,
  ownerId: id,
  notes: text,
  lostReason: text,
});

export const InvoiceUpdate = z.looseObject({
  status: text,
  paidOn: date,
});
