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
  const analysisId = cleanUuid(body?.analysisId);

  const { error } = await supabase.from("feedback").insert({
    rating,
    comment,
    analysis_id: analysisId,
  });

  if (error) {
    console.error("[feedback] Insert failed:", error.message);
    return NextResponse.json({ ok: false, error: "Could not save feedback." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
