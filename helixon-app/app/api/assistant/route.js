import Anthropic from "@anthropic-ai/sdk";

// Keep this on the server only - never expose ANTHROPIC_API_KEY to the client.
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Helixon's website assistant, embedded in the chat widget on the Helixon landing page.

Helixon is a CV-screening tool for agency recruiters. Facts you can rely on:
- What it does: upload a CV + a job description, Helixon scores the match, flags red flags, and drafts a follow-up email - in under 30 seconds.
- Pricing: Free (£0/forever, 3 free analyses, match score & summary, email drafting), Solo (£149/month, unlimited analyses, bulk upload, shortlists & history, priority support), Team (£349/month, everything in Solo plus multi-seat access, shared templates, dedicated onboarding).
- No card required for the free trial. GDPR-ready, data held in the EU, never used to train models.
- Sign-up is via the "Try it free" button - just an email address, no card.

Tone: concise, helpful, a little warm - you're talking to time-pressed recruiters, not enterprise buyers. Keep answers short (2-4 sentences) unless asked for detail. If someone asks something you don't know (specific integrations, exact processing times for their use case, contract terms), say so plainly and suggest they reach out via /contact rather than guessing. Don't make up features, integrations, or numbers that aren't listed above. If someone seems ready to sign up, point them at the "Try it free" button rather than trying to collect their email yourself.`;

export async function POST(req) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ ok: false, error: "No messages provided." }, { status: 400 });
    }

    // Basic shape/length guarding before it reaches the model.
    const cleaned = messages
      .filter((m) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant"))
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: cleaned,
    });

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .filter(Boolean)
      .join("\n");

    return Response.json({ ok: true, reply: text });
  } catch (err) {
    console.error("Assistant route error:", err);
    return Response.json({ ok: false, error: "The assistant is unavailable right now. Please try again." }, { status: 500 });
  }
}