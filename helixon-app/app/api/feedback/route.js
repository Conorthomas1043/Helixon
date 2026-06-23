import { supabase } from "@/lib/supabase";
export async function POST(request) {
 try {
 const body = await request.json();
 const { rating, comment, analysisId } = body;
 if (!rating || !["up", "down"].includes(rating)) {
 return Response.json(
 { ok: false, error: "Rating must be up or down" },
 { status: 400 }
 );
 }
 const { error } = await supabase.from("feedback").insert({
 rating,
 comment: comment || null,
 analysis_id: analysisId || null,
 });
 if (error) throw new Error(error.message);
 return Response.json({ ok: true });
 } catch (err) {
 return Response.json(
 { ok: false, error: err.message },
 { status: 500 }
 );
 }
}
