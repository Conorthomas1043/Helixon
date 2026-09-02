import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";

import { requireCustomerContext } from "@/lib/customer-auth";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const PURPOSES = {
  invite_to_interview:
    "Write a professional email inviting this candidate to interview for the role.",

  client_shortlist_update:
    "Write an email to the client presenting this candidate as part of a shortlist.",

  rejection:
    "Write a kind, professional rejection email to this candidate. Be warm, not robotic.",

  chase_feedback:
    "Write a polite email to the client chasing feedback on this candidate.",
};

export async function POST(request) {
  try {
    const auth =
      await requireCustomerContext({
        requireSubscription: true,
      });

    if (!auth.ok) {
      return Response.json(
        {
          ok: false,
          upgrade: auth.upgrade || false,
          error: auth.error,
        },
        { status: auth.status }
      );
    }

    const {
      user,
      userId,
      agencyId,
    } = auth;

    const body = await request.json();

    const candidateId =
      body?.candidateId;

    const jobId =
      body?.jobId;

    const purpose =
      body?.purpose ||
      "invite_to_interview";

    if (!candidateId || !jobId) {
      return Response.json(
        {
          ok: false,
          error:
            "Missing candidateId or jobId.",
        },
        { status: 400 }
      );
    }

    const instruction =
      PURPOSES[purpose] ||
      PURPOSES.invite_to_interview;

    const {
      data: candidate,
      error: candidateError,
    } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .eq("agency_id", agencyId)
      .single();

    if (candidateError || !candidate) {
      return Response.json(
        {
          ok: false,
          error: "Candidate not found.",
        },
        { status: 404 }
      );
    }

    const {
      data: job,
      error: jobError,
    } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .eq("agency_id", agencyId)
      .single();

    if (jobError || !job) {
      return Response.json(
        {
          ok: false,
          error: "Job not found.",
        },
        { status: 404 }
      );
    }

    const {
      data: agency,
    } = await supabase
      .from("agencies")
      .select("*")
      .eq("id", agencyId)
      .single();

    const {
      data: score,
    } = await supabase
      .from("scores")
      .select("*")
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId)
      .eq("agency_id", agencyId)
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    const signature =
      agency?.settings?.signature ||
      "";

    const tone =
      agency?.settings?.tone ||
      "professional";

    const company =
      agency?.settings?.company_name ||
      agency?.name ||
      "our agency";

    const prompt = `
You are drafting an email for a recruitment agency called ${company}.

Tone: ${tone}

${instruction}

Use [RECRUITER NAME] as a placeholder for the sender's name.

Candidate:
${candidate.name || candidate.full_name || "Candidate"}

Role:
${job.title || "Role"}

${
  score
    ? `Match score: ${score.match_score}/100.
Recommendation: ${score.recommendation}.`
    : ""
}

${
  score?.result?.strengths?.length
    ? `Key strengths: ${score.result.strengths
        .slice(0, 3)
        .join(", ")}.`
    : ""
}

${
  signature
    ? `End with this signature:\n${signature}`
    : ""
}

Return ONLY the email text.
Do not include a subject line.
Do not include a preamble.
`;

    const response =
      await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 700,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

    const emailText =
      response.content?.[0]?.text ||
      "";

    if (!emailText) {
      throw new Error(
        "No email draft was generated."
      );
    }

    const {
      data: artifact,
      error: artifactError,
    } = await supabase
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
          generated_at:
            new Date().toISOString(),
          created_by: userId,
        },
      })
      .select()
      .single();

    if (artifactError) {
      throw new Error(
        artifactError.message
      );
    }

    return Response.json({
      ok: true,
      artifact,

      suggestedRecipient:
        purpose ===
          "client_shortlist_update" ||
        purpose === "chase_feedback"
          ? null
          : candidate?.email ||
            candidate?.extracted?.email ||
            null,
    });
  } catch (error) {
    console.error(
      "[draft-email] Error:",
      error
    );

    return Response.json(
      {
        ok: false,
        error:
          error?.message ||
          "Unable to create email draft.",
      },
      { status: 500 }
    );
  }
}