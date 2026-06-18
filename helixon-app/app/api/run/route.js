import Anthropic from "@anthropic-ai/sdk";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/ratelimit";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 🔒 safer Claude JSON handler
async function askClaude(prompt, maxTokens) {
  const m = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const text = m.content?.[0]?.text || "";

  // safer cleanup (ONLY remove code fences)
  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Claude returned invalid JSON:", text);
    throw new Error("Model returned invalid JSON");
  }
}

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY");
    }

    // ✅ RATE LIMIT (FIRST THING)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!rateLimit(ip)) {
      return Response.json(
        {
          ok: false,
          error: "Too many requests. Please try again in an hour.",
        },
        { status: 429 }
      );
    }

    const form = await request.formData();
    const file = form.get("cv");
    const jobText = form.get("jobText");
    const agencyId = form.get("agencyId");

    if (!file || !jobText || !agencyId) {
      return Response.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 🔹 Step 1: PDF → text (safe)
    let cvText = "";
    try {
      const bytes = Buffer.from(await file.arrayBuffer());
      const parsed = await pdf(bytes);
      cvText = parsed.text || "";
    } catch (err) {
      throw new Error("Failed to parse PDF");
    }

    // 🔹 Step 2: Extract candidate
    const ex = await askClaude(
      `Extract this candidate's details.
Return ONLY valid JSON:

{
"name":"string",
"skills":["string"],
"years_experience":0,
"positions":[{"title":"string","company":"string","duration":"string"}],
"education":["string"],
"industries":["string"]
}

CV:
"""${cvText}"""`,
      1500
    );

    const { data: cand, error: candError } = await supabase
      .from("candidates")
      .insert({
        agency_id: agencyId,
        name: ex.name,
        cv_text: cvText,
        extracted: ex,
      })
      .select()
      .single();

    if (candError) throw new Error(candError.message);

    // 🔹 Step 3: Extract job
    const jp = await askClaude(
      `Extract this job description.

Return ONLY valid JSON:

{
"title":"string",
"required_skills":["string"],
"preferred_skills":["string"],
"min_years_experience":0,
"industry":"string",
"seniority":"string"
}

Job:
"""${jobText}"""`,
      1200
    );

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        agency_id: agencyId,
        title: jp.title,
        job_text: jobText,
        parsed: jp,
      })
      .select()
      .single();

    if (jobError) throw new Error(jobError.message);

    // 🔹 Step 4: Score candidate
    const result = await askClaude(
      `You are a senior technical recruiter with 15 years of experience.

Return ONLY valid JSON:

{
"match_score": 0,
"strengths": ["string"],
"weaknesses": ["string"],
"summary": "string",
"recommendation": "Strong match"
}

Rules:
- "Strong match" | "Worth reviewing" | "Likely not a fit"
- 85-100 excellent
- 70-84 solid
- 50-69 partial
- <50 weak

CANDIDATE:
"""${cvText}"""

JOB:
"""${jobText}"""`,
      1500
    );

    const { error: scoreError } = await supabase.from("scores").insert({
      agency_id: agencyId,
      candidate_id: cand.id,
      job_id: job.id,
      match_score: result.match_score,
      recommendation: result.recommendation,
      result: result,
    });

    if (scoreError) throw new Error(scoreError.message);

    return Response.json({
      ok: true,
      result,
      candidateId: cand.id,
      jobId: job.id,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}