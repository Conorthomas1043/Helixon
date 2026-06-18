import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function cleanJson(text) {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

export async function POST(request) {
  try {
    const { candidateId, jobId, agencyId } = await request.json();

    if (!candidateId || !jobId || !agencyId) {
      return Response.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // fetch candidate
    const { data: cand, error: candError } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single();

    if (candError) throw new Error(candError.message);

    // fetch job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (jobError) throw new Error(jobError.message);

    const prompt = `
You are a senior technical recruiter with 15 years of experience.

Return ONLY valid JSON. No markdown. No backticks.

JSON format:
{
  "match_score": 0,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "summary": "string",
  "recommendation": "Strong match"
}

Rules:
- Recommendation must be exactly one of:
  "Strong match" | "Worth reviewing" | "Likely not a fit"

Scoring bands:
85-100: excellent match
70-84: solid match
50-69: partial match
<50: weak match

CANDIDATE CV:
${cand.cv_text}

JOB DESCRIPTION:
${job.job_text}
`;

    const m = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = m.content?.[0]?.text || "";
    const cleaned = cleanJson(raw);

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch (err) {
      console.error("Failed JSON parse:", raw);
      return Response.json(
        {
          ok: false,
          error: "Model returned invalid JSON",
          raw,
        },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("scores")
      .insert({
        agency_id: agencyId,
        candidate_id: candidateId,
        job_id: jobId,
        match_score: result.match_score,
        recommendation: result.recommendation,
        result: result,
      })
      .select();

    if (error) throw new Error(error.message);

    return Response.json({
      ok: true,
      score: data[0],
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}