import Anthropic from "@anthropic-ai/sdk";

// Keep this on the server only - never expose ANTHROPIC_API_KEY to the client.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are Helixon's website assistant, embedded in the chat widget on the Helixon landing page.

Helixon is a CV-screening tool for agency recruiters.

Facts you can rely on:
- Upload a CV and a job description and Helixon scores the match.
- Helixon can flag red flags and other concerns in a candidate's CV.
- Helixon can draft follow-up recruitment emails.
- Screening is designed to be fast, typically completing in under 30 seconds.
- Individual costs £249/month.
- Agency costs £349/month.
- There is no free trial or free three-analysis plan.
- An active subscription is required to use candidate screening.

Tone:
Be concise, helpful, and a little warm. You're talking to time-pressed recruiters, not enterprise buyers. Keep answers short (2-4 sentences) unless the user asks for more detail.

Accuracy:
- Never invent features, integrations, pricing, processing times, contract terms, or capabilities.
- If you don't know something, say so plainly.
- For questions about specific integrations, exact processing times for a particular use case, contract terms, or anything else you cannot verify from these instructions, direct the user to /contact.
- Do not pretend Helixon supports an integration or feature unless it is explicitly listed above.

Navigation:
- If someone is ready to create an account, direct them to /signup.
- If someone asks about pricing or purchasing, direct them to /pricing.
- If someone needs support or asks about something you cannot verify, direct them to /contact.
- Never ask for or collect the user's email address yourself.

Do not describe a free trial, free analyses, Solo, Team, or £149 pricing because those are no longer current.`;

export async function POST(req) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        "Assistant route error: ANTHROPIC_API_KEY is not configured."
      );

      return Response.json(
        {
          ok: false,
          error:
            "The assistant is unavailable right now. Please try again.",
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const messages = body?.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "No messages provided.",
        },
        { status: 400 }
      );
    }

    // Only accept the two roles supported by the conversation.
    // Limit the number and size of messages before sending them to Anthropic.
    const cleaned = messages
      .filter(
        (message) =>
          message &&
          typeof message.content === "string" &&
          (message.role === "user" ||
            message.role === "assistant")
      )
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: message.content.slice(0, 4000),
      }));

    if (cleaned.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "No valid messages provided.",
        },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: cleaned,
    });

    const text = response.content
      .map((block) =>
        block.type === "text" ? block.text : ""
      )
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!text) {
      return Response.json(
        {
          ok: false,
          error:
            "The assistant did not return a response.",
        },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      reply: text,
    });
  } catch (err) {
    console.error(
      "Assistant route error:",
      err
    );

    return Response.json(
      {
        ok: false,
        error:
          "The assistant is unavailable right now. Please try again.",
      },
      { status: 500 }
    );
  }
}