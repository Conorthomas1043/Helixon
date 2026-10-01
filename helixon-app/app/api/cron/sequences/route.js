import { NextResponse } from "next/server";
import crypto from "crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { mergeContext, renderTemplate } from "@/lib/email-merge";
import { stepDueAt, stopReason } from "@/lib/sequences";
import { agencyFromName, mailConfigured } from "@/lib/mailer";
import { sendTrackedEmail } from "@/lib/tracked-email";
import { logActivity } from "@/lib/candidate-activity";

// Sends the sequence emails that are due (lib/sequences.js). For each due
// enrolment: stop it if the candidate has no email or has been rejected or
// placed; otherwise send the step - merge fields filled in, from the agency,
// replies to the recruiter who enrolled them - and schedule the next one.
//
// Each enrolment is claimed (next_send_at cleared) before sending, so an
// overlapping run can't send the same step twice. Vercel Cron, Bearer
// CRON_SECRET, fail-closed - same as the other crons.

const BATCH = 300;

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export async function GET(request) {
  const provided = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!timingSafeEqualStr(provided, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!mailConfigured()) return NextResponse.json({ ok: false, error: "Email isn't configured." }, { status: 503 });

  const now = new Date();
  const { data: due, error } = await supabase
    .from("sequence_enrollments")
    .select("id, agency_id, candidate_id, next_step, enrolled_by, email_sequences!inner(id, name, steps, active), agencies(suspended_at)")
    .eq("status", "active")
    .eq("email_sequences.active", true)
    .lte("next_send_at", now.toISOString())
    .order("next_send_at")
    .limit(BATCH);
  if (error) {
    console.error("[cron/sequences] Query failed:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const rows = (due ?? []).filter((r) => !r.agencies?.suspended_at);
  const candidateIds = [...new Set(rows.map((r) => r.candidate_id))];
  const enrollerIds = [...new Set(rows.map((r) => r.enrolled_by).filter(Boolean))];
  const [{ data: candidates }, { data: profiles }] = await Promise.all([
    candidateIds.length
      ? supabase.from("candidates").select("id, agency_id, full_name, name, email, current_title, current_company, stage, jobs(title, client, location, salary_range, client_contacts(name, email))").in("id", candidateIds)
      : { data: [] },
    enrollerIds.length ? supabase.from("profiles").select("clerk_user_id, first_name, last_name, username").in("clerk_user_id", enrollerIds) : { data: [] },
  ]);
  const candidateById = new Map((candidates ?? []).map((c) => [c.id, c]));
  const profileById = new Map((profiles ?? []).map((p) => [p.clerk_user_id, p]));
  const emailById = new Map();
  if (enrollerIds.length) {
    const client = await clerkClient();
    for (let i = 0; i < enrollerIds.length; i += 100) {
      const { data } = await client.users.getUserList({ userId: enrollerIds.slice(i, i + 100), limit: 100 });
      for (const u of data ?? []) emailById.set(u.id, u.primaryEmailAddress?.emailAddress ?? null);
    }
  }
  const agencyNames = new Map();

  let sent = 0;
  let stopped = 0;
  let failed = 0;
  for (const r of rows) {
    // Claim it.
    const { data: claimed } = await supabase
      .from("sequence_enrollments")
      .update({ next_send_at: null, updated_at: now.toISOString() })
      .eq("id", r.id)
      .eq("status", "active")
      .eq("next_step", r.next_step)
      .not("next_send_at", "is", null)
      .select("id");
    if (!claimed?.length) continue;

    const steps = Array.isArray(r.email_sequences.steps) ? r.email_sequences.steps : [];
    const step = steps[r.next_step];
    const candidate = candidateById.get(r.candidate_id);
    const reason = candidate?.agency_id === r.agency_id ? stopReason(candidate) : "Candidate removed";
    if (!step || reason) {
      await supabase
        .from("sequence_enrollments")
        .update({ status: step ? "stopped" : "completed", stopped_reason: step ? reason : null, updated_at: now.toISOString() })
        .eq("id", r.id);
      if (step) {
        stopped += 1;
        if (candidate) await logActivity(supabase, candidate.id, "sequence_stopped", "Helixon", { note: `${r.email_sequences.name}: ${reason}` });
      }
      continue;
    }

    if (!agencyNames.has(r.agency_id)) agencyNames.set(r.agency_id, await agencyFromName(r.agency_id));
    const recruiter = profileById.get(r.enrolled_by) ?? null;
    const ctx = mergeContext({ candidate, job: candidate.jobs, contact: candidate.jobs?.client_contacts, recruiter, agencyName: agencyNames.get(r.agency_id) });
    const res = await sendTrackedEmail({
      agencyId: r.agency_id,
      actor: `Sequence: ${r.email_sequences.name}`,
      sentBy: r.enrolled_by,
      candidateId: candidate.id,
      to: candidate.email,
      subject: renderTemplate(step.subject, ctx).text,
      body: renderTemplate(step.body, ctx).text,
      enrollmentId: r.id,
      recruiterEmail: emailById.get(r.enrolled_by) ?? null,
      fromName: agencyNames.get(r.agency_id),
    });
    if (res.error) {
      failed += 1;
      // Put it back to try again on the next run.
      await supabase.from("sequence_enrollments").update({ next_send_at: now.toISOString() }).eq("id", r.id);
      continue;
    }
    sent += 1;
    const next = r.next_step + 1;
    await supabase
      .from("sequence_enrollments")
      .update(
        next >= steps.length
          ? { status: "completed", next_step: next, next_send_at: null, updated_at: now.toISOString() }
          : { next_step: next, next_send_at: stepDueAt(steps, next, now), updated_at: now.toISOString() }
      )
      .eq("id", r.id);
  }

  return NextResponse.json({ ok: failed === 0, due: rows.length, sent, stopped, failed });
}
