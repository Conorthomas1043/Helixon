import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/ratelimit";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// -----------------------------
// SAFE JSON PARSER
// -----------------------------
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Invalid JSON from model");
    return JSON.parse(match[0]);
  }
}

// -----------------------------
// CLAUDE WRAPPER
// -----------------------------
async function askClaude(prompt, maxTokens = 1200) {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const text = res.content?.[0]?.text || "";
  return safeJsonParse(text.replace(/```json|```/g, "").trim());
}

// -----------------------------
// PDF EXTRACTION
// -----------------------------
async function extractTextFromPdf(file) {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Extract ALL text from this CV. Return ONLY raw text.",
          },
        ],
      },
    ],
  });

  return res.content?.[0]?.text || "";
}

// -----------------------------
// MAIN ROUTE
// -----------------------------
export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY");
    }

    const supabase = createSupabaseServerClient();

    // -----------------------------
    // AUTH USER
    // -----------------------------
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // -----------------------------
    // FREE TRIAL GATING (3 LIMIT)
    // -----------------------------
    const { count, error: countError } = await supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (countError) {
      throw new Error("Failed to check usage limit");
    }

    const analysesUsed = count || 0;

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const isSubscribed = !!subscription;

    if (!isSubscribed && analysesUsed >= 3) {
      return Response.json(
        {
          ok: false,
          upgrade: true,
          message: "You've used your 3 free analyses. Upgrade to continue.",
          analysesUsed,
        },
        { status: 402 }
      );
    }

    // -----------------------------
    // RATE LIMIT
    // -----------------------------
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      "unknown";

    if (!rateLimit(ip)) {
      return Response.json(
        { ok: false, error: "Too many requests" },
        { status: 429 }
      );
    }

    // -----------------------------
    // FORM DATA
    // -----------------------------
    const form = await request.formData();
    const file = form.get("cv");
    const jobText = form.get("jobText");
    const agencyId = form.get("agencyId");

    if (!(file instanceof File)) {
      return Response.json(
        { ok: false, error: "Invalid CV file" },
        { status: 400 }
      );
    }

    if (!jobText || !agencyId) {
      return Response.json(
        { ok: false, error: "Missing fields" },
        { status: 400 }
      );
    }

    // -----------------------------
    // STEP 1: PDF → TEXT
    // -----------------------------
    const cvText = await extractTextFromPdf(file);

    if (!cvText || cvText.length < 20) {
      throw new Error("Could not extract CV text");
    }

    // -----------------------------
    // STEP 2: EXTRACT CANDIDATE
    // -----------------------------
    const candidate = await askClaude(
      `
Extract candidate JSON:
{
  "name": "string",
  "skills": ["string"],
  "years_experience": 0,
  "positions": [{"title":"string","company":"string","duration":"string"}],
  "education": ["string"],
  "industries": ["string"]
}

CV:
"""${cvText}"""
      `,
      1500
    );

    const { data: cand, error: candError } = await supabase
      .from("candidates")
      .insert({
        user_id: user.id,
        agency_id: agencyId,
        name: candidate.name,
        cv_text: cvText,
        extracted: candidate,
      })
      .select()
      .single();

    if (candError) throw new Error(candError.message);

    // -----------------------------
    // STEP 3: EXTRACT JOB
    // -----------------------------
    const jobParsed = await askClaude(
      `
Extract job JSON:
{
  "title": "string",
  "required_skills": ["string"],
  "preferred_skills": ["string"],
  "min_years_experience": 0,
  "industry": "string",
  "seniority": "string"
}

Job:
"""${jobText}"""
      `,
      1200
    );

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        user_id: user.id,
        agency_id: agencyId,
        title: jobParsed.title,
        job_text: jobText,
        parsed: jobParsed,
      })
      .select()
      .single();

    if (jobError) throw new Error(jobError.message);

    // -----------------------------
    // STEP 4: SCORE MATCH
    // -----------------------------
    const result = await askClaude(
      `
You are a senior recruiter.

Return JSON:
{
  "match_score": 0,
  "strengths": ["string"],
  "weaknesses": ["string"],
  "summary": "string",
  "recommendation": "Strong match"
}

CANDIDATE:
"""${cvText}"""

JOB:
"""${jobText}"""
      `,
      1500
    );

    // -----------------------------
    // STEP 5: SAVE ANALYSIS (THIS ENABLES FREE TRIAL TRACKING)
    // -----------------------------
    const { error: scoreError } = await supabase.from("analyses").insert({
      user_id: user.id,
      agency_id: agencyId,
      cv_name: file.name,
      match_score: result.match_score,
      recommendation: result.recommendation,
      full_result: result,
    });

    if (scoreError) throw new Error(scoreError.message);

    // -----------------------------
    // RESPONSE
    // -----------------------------
    return Response.json({
      ok: true,
      analysesUsed: analysesUsed + 1,
      result,
      candidateId: cand.id,
      jobId: job.id,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message || "Server error" },
      { status: 500 }
    );
  }
}