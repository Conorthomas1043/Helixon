import { NextResponse } from "next/server";
import { customerRoute } from "@/lib/api/route";
import { fields, id, text } from "@/lib/api/schemas";
import { agencyDb } from "@/lib/agency-db";
import { candidateHidden } from "@/lib/agency/permissions";
import { recordSignal } from "@/lib/analytics/research-signals";
import { captureAgencyEvent } from "@/lib/analytics/server";

// POST /api/ai-writing-feedback - a recruiter's verdict on the amber
// "possibly AI-written" notice for one candidate: "right" or "wrong". Kept
// as a research signal (and an analytics event) so the check's false alarm
// rate can be measured; it changes nothing about the candidate.
const FeedbackInput = fields({ candidateId: id, verdict: text(10) });
const VERDICTS = new Set(["right", "wrong"]);

export const POST = customerRoute(
  async (_request, _context, auth, body) => {
    const verdict = typeof body.verdict === "string" ? body.verdict : "";
    if (!body.candidateId || !VERDICTS.has(verdict)) {
      return NextResponse.json({ error: "Send a candidateId and a verdict of right or wrong." }, { status: 400 });
    }
    const { data: candidate } = await (await agencyDb())
      .from("candidates")
      .select("id")
      .eq("id", body.candidateId)
      .eq("agency_id", auth.agencyId)
      .maybeSingle();
    if (!candidate || (await candidateHidden(auth, candidate.id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await recordSignal({ kind: "ai_writing_feedback", agencyId: auth.agencyId, profileId: auth.profile?.id ?? null, label: verdict, meta: { candidateId: candidate.id } });
    await captureAgencyEvent("ai_writing_feedback", auth.agencyId, { verdict });
    return NextResponse.json({ ok: true });
  },
  { body: FeedbackInput }
);
