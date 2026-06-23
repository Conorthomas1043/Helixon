import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/ratelimit";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function askClaude(prompt, maxTokens) {
  const m = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  const text = m.content?.[0]?.text || "";
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Claude returned invalid JSON:", text);
    throw new Error("Model returned invalid JSON");
  }
}

async function extractTextFromPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(new Uint8Array(arrayBuffer)).toString("base64");

  const m = await anthropic.messages.create({
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
            text: "Extract all text from this CV exactly as it appears. Return only the raw text, nothing else.",
          },
        ],
      },
    ],
  });

  return m.content?.[0]?.text || "";
}

export async function POST(request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Missing ANTHROPIC_API_KEY");
    }

    // RATE LIMIT (first thing)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (!rateLimit(ip)) {
      return Response.json(
        { ok: false, error: "Too many requests. Please try again in an hour." },
        { status: 429 }
      );
    }

    // GET LOGGED-IN USER (Next.js 15 async cookies)
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    const userId = user?.id || null;

    // FREE TRIAL CHECK
    if (userId) {
      const { count } = await supabase
        .from("scores")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .single();

      const isPaid = sub?.status === "active";

      if (!isPaid && (count || 0) >= 3) {
        return Response.json(
          {
            ok: false,
            upgrade: true,
            message: "You've used your 3 free analyses. Upgrade to continue.",
            analysesUsed: count,
          },
          { status: 402 }
        );
      }
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

    // Step 1: PDF -> text
    let cvText = "";
    try {
      cvText = await extractTextFromPdf(file);
    } catch (err) {
      throw new Error("Failed to read PDF");
    }

    if (!cvText || cvText.trim().length < 20) {
      throw new Error(
        "Could not read any text from this PDF. It may be a scanned image."
      );
    }

    // Step 2: Extract candidate
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

    // Step 3: Extract job
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

    // Step 4: Score candidate
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
- below 50 weak

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
      user_id: userId,
    });

    if (scoreError) throw new Error(scoreError.message);

    return Response.json({
      ok: true,
      result,
      candidateId: cand.id,
      jobId: job.id,
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}