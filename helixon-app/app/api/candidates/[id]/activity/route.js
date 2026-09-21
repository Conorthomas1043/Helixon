// app/api/candidates/[id]/activity/route.js
// Manual outreach logging: a recruiter records that they made a call,
// sent an email, booked a meeting, or sent a CV - after the fact, by
// hand. Helixon has no telephony/email-sending integration, so this
// isn't "Helixon placed the call" - it's the same kind of self-reported
// record placement_fee/retention already are, just for activity metrics
// (calls made, emails sent, meetings booked, CVs sent, candidates
// contacted) instead of financial/retention ones.
//
// Writes to candidate_activity, same table stage changes already use -
// see lib/candidate-activity.js. No new table needed; "type" there was
// always free-text with no CHECK constraint.

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { logActivity } from "@/lib/candidate-activity";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanText } from "@/lib/sanitize";

const ACTIVITY_TYPES = new Set(["call_logged", "email_logged", "meeting_logged", "cv_sent_logged"]);

export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { agencyId, userId, profile } = auth;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const type = body?.type;
  if (!ACTIVITY_TYPES.has(type)) {
    return NextResponse.json({ error: "Invalid activity type." }, { status: 400 });
  }
  const note = cleanText(body?.note, { max: 500 }) || null;

  const { data: candidate } = await supabase
    .from("candidates")
    .select("id")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (!candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const actor = recruiterDisplayName(profile) || userId;
  await logActivity(supabase, id, type, actor, note ? { note } : null);

  const { data: latest } = await supabase
    .from("candidate_activity")
    .select("id, type, actor, meta, created_at")
    .eq("candidate_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    activity: latest
      ? { id: latest.id, type: latest.type, actor: latest.actor, meta: latest.meta, timestamp: latest.created_at }
      : null,
  });
}
