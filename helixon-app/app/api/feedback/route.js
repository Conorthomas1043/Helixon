import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { rateLimit } from "@/lib/ratelimit";
import { cleanText, cleanUuid } from "@/lib/sanitize";

// Thumbs up/down on an analysis (see the feedback buttons in app/analyse).
//
// Previously this had no authentication, no length limit and no validation, so
// anyone could POST unlimited rows of arbitrary text into the feedback table.
// It now needs a signed-in user (the page that calls it already does), is
// rate-limited per user, and stores only cleaned, length-capped text.
//
// The client sends the free-text explanation as `reason`; older callers sent
// `comment`. Both are accepted.
const MAX_FEEDBACK_PER_HOUR = 60;

export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  if (!(await rateLimit(`feedback:${auth.userId}`, MAX_FEEDBACK_PER_HOUR))) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);

  const rating = body?.rating;
  if (rating !== "up" && rating !== "down") {
    return NextResponse.json({ ok: false, error: "Rating must be up or down" }, { status: 400 });
  }

  const comment = cleanText(body?.reason ?? body?.comment, { max: 2000 }) || null;

  // Optional link to the score being rated - only kept if it really belongs to
  // this agency, so feedback can't be pinned to someone else's record.
  let scoreId = cleanUuid(body?.scoreId);
  if (scoreId) {
    const { data: score } = await supabase
      .from("scores")
      .select("id")
      .eq("id", scoreId)
      .eq("agency_id", auth.agencyId)
      .maybeSingle();
    if (!score) scoreId = null;
  }

  // The feedback table's columns are score_id / agency_id / user_id. This route
  // used to insert an `analysis_id` column that doesn't exist, so every
  // submission failed and nothing was ever saved. user_id is left null on
  // purpose: it is a foreign key to auth.users (the old Supabase Auth table),
  // which a Clerk user's id can never satisfy - the agency is what identifies
  // who the feedback came from.
  const { error } = await supabase.from("feedback").insert({
    agency_id: auth.agencyId,
    user_id: null,
    score_id: scoreId,
    rating,
    comment,
  });

  if (error) {
    console.error("[feedback] Insert failed:", error.message);
    return NextResponse.json({ ok: false, error: "Could not save feedback." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
