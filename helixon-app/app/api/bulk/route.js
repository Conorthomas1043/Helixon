import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Extracts text from a PDF using Claude (same as your /api/run endpoint)
async function extractPdfText(file) {
 const arrayBuffer = await file.arrayBuffer();
 const base64 = Buffer.from(new Uint8Array(arrayBuffer)).toString("base64");
 const m = await anthropic.messages.create({
 model: "claude-sonnet-4-5",
 max_tokens: 4000,
 messages: [{
 role: "user",
 content: [
 {
 type: "document",
 source: { type: "base64", media_type: "application/pdf",
 data: base64 },
 },
 {
 type: "text",
 text: "Extract all text from this CV. Return only the raw text.",
 },
 ],
 }],
 });
 return m.content?.[0]?.text || "";
}
// Scores one CV against a job description
async function scoreOne(cvText, jobText, fileName) {
 const prompt = `You are a senior recruiter. Score this candidate.
Return ONLY valid JSON:
{
 "name": "candidate name from CV or filename if not found",
 "match_score": number 0-100,
 "strengths": ["string"],
 "weaknesses": ["string"],
 "summary": "one sentence",
 "recommendation": "Strong match" | "Worth reviewing" | "Likely not a fit"
}
Bands: 85-100 clearly meets core; 70-84 solid; 50-69 partial;
below 50 missing core requirements.
CV:
"""${cvText}"""
JOB:
"""${jobText}"""`;
 const m = await anthropic.messages.create({
 model: "claude-sonnet-4-5",
 max_tokens: 1500,
 messages: [{ role: "user", content: prompt }],
 });
 const text = m.content?.[0]?.text || "{}";
 const cleaned = text.replace(/```json/g,"").replace(/```/g,"").trim();
 const result = JSON.parse(cleaned);
 return { fileName, ...result };
}
export async function POST(request) {
 try {
 const form = await request.formData();
 const cvFiles = form.getAll("cvs"); // multiple files
 const jobText = form.get("jobText");
 const agencyId = form.get("agencyId");
 if (!cvFiles.length || !jobText) {
 return Response.json(
 { ok: false, error: "Please provide CVs and a job description" },
 { status: 400 }
 );
 }
 const allResults = [];
 const BATCH = 5; // process 5 at a time — never all at once
 for (let i = 0; i < cvFiles.length; i += BATCH) {
 const batch = cvFiles.slice(i, i + BATCH);
 const batchResults = await Promise.all(
 batch.map(async (file) => {
 try {
 const cvText = await extractPdfText(file);
 const result = await scoreOne(cvText, jobText, file.name);
 // Save each result to Supabase
 await supabase.from("scores").insert({
 agency_id: agencyId,
 match_score: result.match_score,
 recommendation: result.recommendation,
 result: result,
 });
 return result;
 } catch (err) {
 // One bad file doesn't kill the whole batch
 return {
 fileName: file.name,
 name: file.name,
 match_score: 0,
 recommendation: "Could not read",
 strengths: [],
 weaknesses: [],
 summary: "This file could not be processed: " + err.message,
 error: true,
 };
 }
 })
 );
 allResults.push(...batchResults);
 }
 // Sort highest score first
 allResults.sort((a, b) => b.match_score - a.match_score);
 return Response.json({
 ok: true,
 results: allResults,
 total: allResults.length,
 });
 } catch (err) {
 return Response.json(
 { ok: false, error: err.message },
 { status: 500 }
 );
 }
}