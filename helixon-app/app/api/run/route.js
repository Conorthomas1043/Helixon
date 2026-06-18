import Anthropic from "@anthropic-ai/sdk";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { supabase } from "@/lib/supabase";
const anthropic = new Anthropic({
apiKey: process.env.ANTHROPIC_API_KEY
});
async function askClaude(prompt, maxTokens) {
const m = await anthropic.messages.create({
model: "claude-sonnet-4-5",
max_tokens: maxTokens,
messages: [{ role: "user", content: prompt }]
});
return JSON.parse(m.content[0].text);
}
export async function POST(request) {
try {
const form = await request.formData();
const file = form.get("cv");
const jobText = form.get("jobText");
const agencyId = form.get("agencyId");
// Step 1: extract text from the PDF
const bytes = Buffer.from(await file.arrayBuffer());
const parsed = await pdf(bytes);
const cvText = parsed.text;
// Step 2: extract and save candidate
const ex = await askClaude(`Extract this candidate's details.
Return ONLY valid JSON, no other text:
{"name":"string","skills":["string"],"years_experience":0,
"positions":[{"title":"string","company":"string","duration":"string"}],
"education":["string"],"industries":["string"]}
CV: <<<${cvText}>>>`, 1500);
const { data: cand } = await supabase
.from("candidates")
.insert({
agency_id: agencyId,
name: ex.name,
cv_text: cvText,
extracted: ex
})
.select()
.single();
// Step 3: extract and save job
const jp = await askClaude(`Extract this job description's requirements.
Return ONLY valid JSON, no other text:
{"title":"string","required_skills":["string"],"preferred_skills":["string"],
"min_years_experience":0,"industry":"string","seniority":"string"}
Job: <<<${jobText}>>>`, 1200);
const { data: job } = await supabase
.from("jobs")
.insert({
agency_id: agencyId,
title: jp.title,
job_text: jobText,
parsed: jp
})
.select()
.single();
// Step 4: score and save
const result = await askClaude(`You are a senior technical recruiter
with 15 years of experience. Judge this candidate's fit for this role
as a thoughtful human recruiter would. Reward relevant, recent,
substantial experience. Do not over-reward keyword matches alone.
Return ONLY valid JSON, no other text:
{"match_score":0,"strengths":["string"],"weaknesses":["string"],
"summary":"string","recommendation":"Strong match"}
Recommendation must be exactly one of:
"Strong match" | "Worth reviewing" | "Likely not a fit"
Scoring: 85-100 clearly meets core; 70-84 solid minor gaps;
50-69 partial fit; below 50 missing core requirements.
CANDIDATE: <<<${cvText}>>>
JOB: <<<${jobText}>>>`, 1500);
await supabase.from("scores").insert({
agency_id: agencyId,
candidate_id: cand.id,
job_id: job.id,
match_score: result.match_score,
recommendation: result.recommendation,
result: result
});
return Response.json({
ok: true,
result,
candidateId: cand.id,
jobId: job.id
});
} catch (err) {
return Response.json(
{ ok: false, error: err.message },
{ status: 500 }
);
}
}
