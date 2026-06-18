import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
const anthropic = new Anthropic({
apiKey: process.env.ANTHROPIC_API_KEY
});
export async function POST(request) {
try {
const { jobText, agencyId } = await request.json();
const m = await anthropic.messages.create({
model: "claude-sonnet-4-5",
max_tokens: 1200,
messages: [{
role: "user",
content: `Extract this job description's requirements.
Return ONLY valid JSON (no extra text, no markdown):
{
"title": "string",
"required_skills": ["string"],
"preferred_skills": ["string"],
"min_years_experience": 0,
"industry": "string",
"seniority": "string"
}
Job description:
<<<
${jobText}
>>>`
}]
});
const raw = m.content[0].text
  .replace(/```json/g, "")
  .replace(/```/g, "")
  .trim();

const extracted = JSON.parse(raw);
const { data, error } = await supabase
.from("jobs")
.insert({
agency_id: agencyId,
title: parsed.title,
job_text: jobText,
parsed: parsed
})
.select();
if (error) throw new Error(error.message);
return Response.json({ ok: true, job: data[0] });
} catch (err) {
return Response.json(
{ ok: false, error: err.message },
{ status: 500 }
);
}
}
