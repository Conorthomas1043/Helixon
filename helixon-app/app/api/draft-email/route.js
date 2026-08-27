import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PURPOSES = {
  invite_to_interview:
    "Write a professional email inviting this candidate to interview for the role.",
  client_shortlist_update:
    "Write an email to our client presenting this candidate as part of a shortlist. Address to [CLIENT NAME].",
  rejection:
    "Write a kind, professional rejection email to this candidate. Be warm, not robotic.",
  chase_feedback:
    "Write a polite email to the client chasing feedback on this candidate.",
};

export async function POST(request) {
  try {
    const { candidateId, jobId, purpose } = await request.json();

    if (!candidateId || !jobId) {
      return Response.json({ ok: false, error: "Missing candidateId or jobId." }, { status: 400 });
    }

    // ── Resolve agencyId server-side, same as /api/run ─────────────────────
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          }
        }
      }
    );
    const { data: { user } } = await supabaseAuth.auth.getUser();
    const userId = user?.id || null;
    const trialAgencyId = cookieStore.get("helixon_trial")?.value || null;
    const agencyId = userId ? null : trialAgencyId; // logged-in path: look up via user's own agency below if you have that relation

    if (!agencyId && !userId) {
      return Response.json({ ok: false, error: "No trial session found." }, { status: 401 });
    }

    // ── Fetch data, scoped to this agency so nobody can draft off someone
    //    else's candidate/job by guessing IDs ─────────────────────────────
    const { data: candidate, error: candErr } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .eq("agency_id", agencyId)
      .single();

    if (candErr || !candidate) {
      return Response.json({ ok: false, error: "Candidate not found." }, { status: 404 });
    }

    const { data: job, error: jobErr } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("agency_id", agencyId)
      .single();

    if (jobErr || !job) {
      return Response.json({ ok: false, error: "Job not found." }, { status: 404 });
    }

    const { data: agency } = await supabase
      .from("agencies")
      .select("*")
      .eq("id", agencyId)
      .single();

    const { data: score } = await supabase
      .from("scores")
      .select("*")
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const signature = agency?.settings?.signature || "";
    const tone = agency?.settings?.tone || "professional";
    const company = agency?.settings?.company_name || agency?.name || "our agency";

    const instruction = PURPOSES[purpose] || PURPOSES.invite_to_interview;

    const prompt = `You are drafting an email for a recruitment agency called ${company}.
Tone: ${tone}.
${instruction}
Use [RECRUITER NAME] as a placeholder for the sender's name.
${purpose !== "client_shortlist_update" ? `Candidate name: ${candidate.name}.` : ""}
Role: ${job.title}.
${score ? `Match score: ${score.match_score}/100. Recommendation: ${score.recommendation}.` : ""}
${score?.result?.strengths?.length ? `Key strengths: ${score.result.strengths.slice(0, 3).join(", ")}.` : ""}
${signature ? `End with this signature:\n${signature}` : ""}
Return ONLY the email text. No subject line for candidate emails. No preamble.`;

    const m = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      messages: [{ role: "user", content: prompt }],
    });

    const emailText = m.content[0].text;

    const { data: artifact, error } = await supabase
      .from("artifacts")
      .insert({
        agency_id: agencyId,
        candidate_id: candidateId,
        job_id: jobId,
        kind: "email_draft",
        content: {
          purpose,
          original_text: emailText,
          final_text: emailText,
          kept: null,
          rewrite_count: 0,
          generated_at: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Send back the candidate's email so the frontend can prefill "To"
    return Response.json({
      ok: true,
      artifact,
      suggestedRecipient: purpose === "client_shortlist_update" || purpose === "chase_feedback"
        ? null // client email isn't captured anywhere yet - see note below
        : candidate?.extracted?.email || null,
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}