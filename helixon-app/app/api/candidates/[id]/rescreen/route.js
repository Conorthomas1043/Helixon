import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/ratelimit";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { rescreenCandidate } from "@/lib/rescreen";
import { candidateHidden } from "@/lib/permissions";
import { reportError } from "@/lib/report-error";

// POST { jobId } - screen a candidate already on file against another job
// using the CV we already hold (lib/rescreen.js). A full analysis, so it
// shares /api/run's paid-plan requirement and hourly allowance.
const RUN_LIMIT_PER_USER_PER_HOUR = 100;

export const maxDuration = 240;

export async function POST(request, { params }) {
  const auth = await requireCustomerContext({ requireSubscription: true });
  if (!auth.ok) {
    return NextResponse.json({ ok: false, upgrade: auth.upgrade || false, error: auth.error }, { status: auth.status });
  }
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const sourceId = cleanUuid(id);
  const jobId = cleanUuid(body?.jobId);
  if (!sourceId || !jobId) {
    return NextResponse.json({ ok: false, error: "Choose a job to screen them for." }, { status: 400 });
  }

  if (!(await rateLimit(`run-user:${auth.userId}`, RUN_LIMIT_PER_USER_PER_HOUR))) {
    return NextResponse.json({ ok: false, error: "Hourly analysis limit reached. Please try again later." }, { status: 429 });
  }

  try {
    const result = await rescreenCandidate(supabase, {
      agencyId: auth.agencyId,
      userId: auth.userId,
      actor: recruiterDisplayName(auth.profile) || auth.userId,
      sourceId,
      jobId,
    });
    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error, existingId: result.existingId || null }, { status: result.status });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    reportError("[rescreen] Failed:", err?.message);
    return NextResponse.json({ ok: false, error: "Something went wrong screening this candidate." }, { status: 500 });
  }
}
