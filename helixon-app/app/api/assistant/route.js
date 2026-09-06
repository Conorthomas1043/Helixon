import { GoogleGenAI } from "@google/genai";

// Keep this on the server only - never expose GEMINI_API_KEY to the client.
let genAI = null;
function client() {
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAI;
}

const MODEL = "gemini-3.8-flash";
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4000;

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
- If someone is ready to create an account, direct them to /pricing to choose a plan - accounts are created as part of checkout, there's no separate sign-up page.
- If someone asks about pricing or purchasing, direct them to /pricing.
- If someone needs support or asks about something you cannot verify, direct them to /contact.
- Never ask for or collect the user's email address yourself.

Do not describe a free trial, free analyses, Solo, Team, or £149 pricing because those are no longer current.`;

function sanitizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return [];

  return rawMessages
    .filter(
      (message) =>
        message &&
        typeof message.content === "string" &&
        message.content.trim().length > 0 &&
        (message.role === "user" || message.role === "assistant"),
    )
    .slice(-MAX_MESSAGES)
    .map((message) => ({
      // Gemini uses "model" rather than "assistant" for the prior-turn role.
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content.slice(0, MAX_MESSAGE_CHARS) }],
    }));
}

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("Assistant route error: GEMINI_API_KEY is not configured.");

      return Response.json(
        {
          ok: false,
          error: "The assistant is unavailable right now. Please try again.",
        },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "No messages provided.",
        },
        { status: 400 },
      );
    }

    const contents = sanitizeMessages(body.messages);

    if (contents.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "No valid messages provided.",
        },
        { status: 400 },
      );
    }

    // Gemini requires the conversation to open on a "user" turn.
    while (contents.length > 0 && contents[0].role !== "user") {
      contents.shift();
    }

    if (contents.length === 0) {
      return Response.json(
        {
          ok: false,
          error: "No valid messages provided.",
        },
        { status: 400 },
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    let response;
    try {
      response = await client().models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          maxOutputTokens: 400,
        },
        // Not all SDK versions accept fetch options on this call; harmless
        // if ignored, but bounds the request when it is supported.
        abortSignal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const text = (response?.text || "").trim();

    if (!text) {
      return Response.json(
        {
          ok: false,
          error: "The assistant did not return a response.",
        },
        { status: 502 },
      );
    }

    return Response.json({
      ok: true,
      reply: text,
    });
  } catch (err) {
    console.error("Assistant route error:", err);

    const status = err?.status === 429 ? 429 : 500;
    const message =
      status === 429
        ? "The assistant is a little busy right now. Please try again shortly."
        : "The assistant is unavailable right now. Please try again.";

    return Response.json({ ok: false, error: message }, { status });
  }
}