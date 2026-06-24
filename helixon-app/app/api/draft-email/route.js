import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";

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
    const { candidateId, jobId, agencyId, purpose } = await request.json();

    // Fetch all the data we need from Supabase
    const { data: candidate } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single();

    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

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

    // Pull settings from agency record (set in Agency Settings page)
    const signature = agency?.settings?.signature || "";
    const tone = agency?.settings?.tone || "professional";
    const company = agency?.settings?.company_name || "our agency";

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

    // Save the draft to the artifacts table
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

    return Response.json({ ok: true, artifact });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}