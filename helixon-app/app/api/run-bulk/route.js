import Anthropic from "@anthropic-ai/sdk";
import pdf from "pdf-parse";
import { supabase } from "@/lib/supabase";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Score one CV against one job (reuses your existing scoring logic)
async function scoreOne(cvText, jobText, agencyId) {
  const prompt = `You are a senior technical recruiter with 15 years of
experience. Judge this candidate against this role as a thoughtful human
recruiter would. Return ONLY valid JSON:
{
  "name": string,
  "match_score": number,
  "strengths": string[],
  "weaknesses": string[],
  "summary": string,
  "recommendation": "Strong match" | "Worth reviewing" | "Likely not a fit"
}
Bands: 85-100 clearly meets core requirements; 70-84 solid minor gaps;
50-69 partial; below 50 missing core requirements.
CANDIDATE CV:
"""
${cvText}
"""
JOB DESCRIPTION:
"""
${jobText}
"""`;
  const m = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }]
  });
  return JSON.parse(m.content[0].text);
}
export async function POST(request) {
  try {
    const form = await request.formData();
    const cvFiles = form.getAll("cvs");      // multiple files
    const jobText = form.get("jobText");
    const agencyId = form.get("agencyId");
    if (!cvFiles.length || !jobText) {
      return Response.json({ ok: false, error: "Missing CVs or job description" }, 
        { status: 400 });
    }
    // Process in batches of 5 — never fire all at once (rate limits + cost)
    const BATCH_SIZE = 5;
    const allResults = [];
    for (let i = 0; i < cvFiles.length; i += BATCH_SIZE) {
      const batch = cvFiles.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async (file) => {
          try {
            const bytes = Buffer.from(await file.arrayBuffer());
            const cvText = (await pdf(bytes)).text;
            const result = await scoreOne(cvText, jobText, agencyId);
            
            // Save each to Supabase
            await supabase.from("analyses").insert({
              cv_name: file.name,
              match_score: result.match_score,
              recommendation: result.recommendation,
              full_result: result,
              agency_id: agencyId
            });
            return { fileName: file.name, ...result };
          } catch (err) {
            // One bad file shouldn't kill the whole batch
            return { 
              fileName: file.name, 
              match_score: 0, 
              recommendation: "Could not read",
              error: err.message,
              strengths: [],
              weaknesses: [],
              summary: "File could not be processed"
            };
          }
        })
      );
      allResults.push(...batchResults);
    }
    // Sort highest score first
    allResults.sort((a, b) => b.match_score - a.match_score);
    return Response.json({ ok: true, results: allResults, total: allResults.length });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}