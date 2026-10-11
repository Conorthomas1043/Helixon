// Request body schemas for the customer API (customerRoute's `body` option,
// or parseBody in routes that read the body themselves). Each lists the
// fields a route accepts; unknown keys are dropped, so a handler only ever
// sees what its schema names. They check shape and size at the edge:
// business rules (allowed statuses, ranges) stay in the cleaners each route
// already uses (lib/clients/core.js, lib/placements/core.js, ...), which also accept
// numbers typed as text, so these schemas do too.
//
// Schemas used by one route live in that route; the shared resources are
// below. test/request-schemas.test.js keeps any route from going back to
// accepting any object.

import { z } from "zod";

// Field types. `nested` is for a structure a cleaner validates in full
// (sequence steps, import mappings, scorecard criteria).
export const text = (max = 20000) => z.union([z.string().max(max), z.number()]).nullable().optional();
// Only a string: for values used as text straight away (trimmed, stored as-is).
export const str = (max = 20000) => z.string().max(max).nullable().optional();
export const num = z.union([z.number(), z.string().max(40)]).nullable().optional();
export const flag = z.boolean().nullable().optional();
export const id = z.string().max(100).nullable().optional();
export const date = z.string().max(40).nullable().optional();
export const ids = (max = 500) => z.array(z.string().max(100)).max(max).optional();
export const stringList = z.union([z.array(z.string().max(500)).max(500), z.string().max(20000)]).nullable().optional();
export const nested = z.unknown().optional();

// An object of exactly these fields (others are dropped).
/** @template {import("zod").ZodRawShape} S @param {S} shape */
export const fields = (shape) => z.object(shape);

// The body routes with no fields of their own take: an object, emptied.
export const NoFields = z.object({});

export const ClientInput = fields({
  name: text(),
  website: text(),
  industry: text(),
  address: text(),
  termsNotes: text(),
  status: text(),
  ownerId: id,
  feePercent: num,
  paymentTermsDays: num,
  rebateDays: num,
});

export const JobInput = fields({
  title: text(),
  client: text(),
  company: text(),
  clientId: id,
  contactId: id,
  clientEmail: text(),
  location: text(),
  employmentType: text(),
  seniority: text(),
  salaryRange: text(),
  minYearsExperience: num,
  requiredSkills: stringList,
  preferredSkills: stringList,
  jobText: text(),
  status: text(),
  published: flag,
  publicTitle: text(),
  publicDescription: text(),
  hideClient: flag,
  showSalary: flag,
  ownerId: id,
  officeId: id,
  openings: num,
  priority: text(),
  targetDate: date,
  feePercent: num,
  feeAmount: num,
});

export const PlacementInput = fields({
  candidateId: id,
  kind: text(),
  status: text(),
  currency: text(),
  rateUnit: text(),
  feeAmount: num,
  feePercent: num,
  rebateDays: num,
  salary: num,
  payRate: num,
  chargeRate: num,
  offerDate: date,
  startDate: date,
  endDate: date,
  notes: text(),
  splits: z.array(z.looseObject({ recruiterId: z.string(), percent: z.union([z.number(), z.string()]) })).max(20).nullable().optional(),
});

export const InterviewInput = fields({
  candidateId: id,
  contactId: id,
  startsAt: date,
  durationMinutes: num,
  kind: text(),
  round: num,
  location: text(),
  interviewers: text(),
  notes: text(),
  status: text(),
  outcome: text(),
  moveToInterview: flag,
  sendInvites: flag,
  notify: flag,
  invite: z
    .looseObject({ candidate: flag, contact: flag, extra: z.array(z.string()).optional() })
    .nullable()
    .optional(),
});

export const OpportunityInput = fields({
  clientId: id,
  contactId: id,
  jobId: id,
  title: text(),
  stage: text(),
  value: num,
  probability: num,
  expectedClose: date,
  ownerId: id,
  notes: text(),
  lostReason: text(),
});

export const InvoiceUpdate = fields({
  status: text(),
  paidOn: date,
});
