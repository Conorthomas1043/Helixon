import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanText, cleanUuid } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidate-activity";
import { rateLimit } from "@/lib/ratelimit";
import { candidateHidden } from "@/lib/permissions";
import { CALL_NOTES_SCHEMA, MAX_NOTES, SYSTEM_PROMPT, buildPrompt, cleanCallNotes, noteText } from "@/lib/call-notes";
import { reportError } from "@/lib/report-error";

// POST { notes, kind?: "call" | "meeting", save?: true }
// Rough call notes or a transcript in, a tidy summary out (lib/call-notes.js):
// summary, key points, next steps, a suggested follow-up, and notice /
// salary / availability as said. With save, it's added to the candidate's
// notes and timeline. Paid plans, like the other AI features.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const maxDuration = 120;

export async function POST(request, { params }) {
  const auth = await requireCustomerContext({ requireSubscription: true });
  if (!auth.ok) return NextResponse.json({ error: auth.error, upgrade: auth.upgrade || false }, { status: auth.status });
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const id = cleanUuid((await params).id);
  const { data: candidate } = id
    ? await supabase.from("candidates").select("id, full_name, name, jobs(title)").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle()
    : { data: null };
  if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json().catch(() => null)) ?? {};
  const notes = cleanText(body.notes, { max: MAX_NOTES });
  if (!notes || notes.length < 20) return NextResponse.json({ error: "Paste your notes or the transcript first." }, { status: 400 });
  const kind = body.kind === "meeting" ? "meeting" : "call";
  if (!(await rateLimit(`call-notes:${auth.userId}`, 60))) return NextResponse.json({ error: "That's a lot of summaries this hour - try again shortly." }, { status: 429 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "AI isn't set up yet." }, { status: 503 });

  let response;
  try {
    response = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      // If the model declines (a safety classifier), the API re-runs on a
      // fallback model rather than returning nothing.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: CALL_NOTES_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildPrompt({
            notes,
            kind,
            candidateName: candidate.full_name || candidate.name,
            jobTitle: candidate.jobs?.title,
            today: new Date().toISOString().slice(0, 10),
          }),
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "The AI is busy - try again in a minute." }, { status: 429 });
    reportError("[call-notes] Request failed:", err?.status, err?.message);
    return NextResponse.json({ error: "Couldn't summarise those notes - try again." }, { status: 502 });
  }
  if (response.stop_reason === "refusal") return NextResponse.json({ error: "Those notes couldn't be summarised." }, { status: 422 });

  const text = response.content.find((b) => b.type === "text")?.text || "";
  let parsed = null;
  try {
    parsed = cleanCallNotes(JSON.parse(text));
  } catch {
    parsed = null;
  }
  if (!parsed) return NextResponse.json({ error: "Couldn't summarise those notes - try again." }, { status: 502 });

  if (body.save === true) {
    const author = recruiterDisplayName(auth.profile) || auth.userId;
    const { error } = await supabase
      .from("candidate_notes")
      .insert({ agency_id: auth.agencyId, candidate_id: candidate.id, author_id: auth.userId, author_name: author, note: noteText(parsed, kind) });
    if (error) return NextResponse.json({ error: "Summarised, but the note couldn't be saved." }, { status: 500 });
    await logActivity(supabase, candidate.id, kind === "meeting" ? "meeting_logged" : "call_logged", author, { note: parsed.summary.slice(0, 300) });
    await logActivity(supabase, candidate.id, "call_notes_summarised", author, { note: "Summary saved to notes" });
  }
  return NextResponse.json({ result: parsed, saved: body.save === true });
}
