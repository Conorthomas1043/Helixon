// Shared bits of the agency REST API (/api/v1): authentication by API key
// (lib/api-keys.js), JSON errors, paging, and the public shape of each
// record. Field names are camelCase and stable - changing one breaks
// people's Zaps and scripts.

import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";

export const API_VERSION = "2026-10-01";

export function apiError(status, message) {
  return NextResponse.json({ error: { status, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiJson(body, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Helixon-API-Version": API_VERSION } });
}

// Runs `handler(ctx, request, params)` for a valid key, else the error.
export function withApiKey(handler) {
  return async (request, context) => {
    const ctx = await authenticateApiKey(request);
    if (!ctx.ok) return apiError(ctx.status, ctx.error);
    try {
      return await handler(ctx, request, context?.params ? await context.params : {});
    } catch (err) {
      console.error("[api/v1] Handler failed:", err?.message);
      return apiError(500, "Something went wrong.");
    }
  };
}

// ?page=&pageSize= (max 100). { page, pageSize, from, to }.
export function paging(params) {
  const page = Math.max(1, Math.floor(Number(params.get("page")) || 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(params.get("pageSize")) || 25)));
  return { page, pageSize, from: (page - 1) * pageSize, to: page * pageSize - 1 };
}

export function pageMeta({ page, pageSize }, total) {
  return { page, pageSize, total: total ?? 0, totalPages: Math.max(1, Math.ceil((total ?? 0) / pageSize)) };
}

// An ISO timestamp from ?updatedSince= / ?createdSince=, or null.
export function sinceParam(value) {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export const CANDIDATE_COLUMNS =
  "id, full_name, name, email, phone, linkedin, location, current_title, current_company, stage, match_score, recommendation, match_summary, tags, source, job_id, recruiter_id, processing_status, talent_pool_at, created_at, last_activity_at, jobs(id, title, client)";

export function toApiCandidate(c) {
  return {
    id: c.id,
    name: c.full_name || c.name || null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    linkedin: c.linkedin ?? null,
    location: c.location ?? null,
    currentTitle: c.current_title ?? null,
    currentCompany: c.current_company ?? null,
    stage: c.stage ?? null,
    matchScore: c.match_score ?? null,
    recommendation: c.recommendation ?? null,
    summary: c.match_summary ?? null,
    tags: c.tags ?? [],
    source: c.source ?? null,
    job: c.jobs ? { id: c.jobs.id, title: c.jobs.title, client: c.jobs.client } : c.job_id ? { id: c.job_id } : null,
    recruiterId: c.recruiter_id ?? null,
    inTalentPool: Boolean(c.talent_pool_at),
    status: c.processing_status ?? null,
    createdAt: c.created_at,
    lastActivityAt: c.last_activity_at ?? null,
    url: `/dashboard/candidates/${c.id}`,
  };
}

export const JOB_COLUMNS = "id, title, client, client_id, status, location, employment_type, seniority, salary_range, required_skills, published, created_at";

export function toApiJob(j) {
  return {
    id: j.id,
    title: j.title,
    client: j.client ?? null,
    clientId: j.client_id ?? null,
    status: j.status ?? null,
    location: j.location ?? null,
    employmentType: j.employment_type ?? null,
    seniority: j.seniority ?? null,
    salaryRange: j.salary_range ?? null,
    requiredSkills: j.required_skills ?? [],
    published: Boolean(j.published),
    createdAt: j.created_at,
  };
}
