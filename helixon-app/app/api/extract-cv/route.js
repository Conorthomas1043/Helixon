import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
const anthropic = new Anthropic({
apiKey: process.env.ANTHROPIC_API_KEY
});
export async function POST(request) {
try {
const { cvText, agencyId } = await request.json();
const m = await anthropic.messages.create({
model: "claude-sonnet-4-5",
max_tokens: 1500,
messages: [{
role: "user",
content: `Extract this candidate's details.
Return ONLY valid JSON (no extra text, no markdown):
{
"name": "string",
"skills": ["string"],
"years_experience": 0,
"positions": [
{ "title": "string", "company": "string", "duration": "string" }
],
"education": ["string"],
"industries": ["string"]
}
CV:
<<<
${cvText}
>>>`
}]
});
const raw = m.content[0].text
  .replace(/```json/g, "")
  .replace(/```/g, "")
  .trim();

const extracted = JSON.parse(raw);
const { data, error } = await supabase
.from("candidates")
.insert({
agency_id: agencyId,
name: extracted.name,
cv_text: cvText,
extracted: extracted
})
.select();
if (error) throw new Error(error.message);
return Response.json({ ok: true, candidate: data[0] });
} catch (err) {
return Response.json(
{ ok: false, error: err.message },
{ status: 500 }
);
}
}
