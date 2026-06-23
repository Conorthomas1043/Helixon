import { supabase } from "@/lib/supabase";
export async function GET(request) {
 // Password check — must pass ?key=yourkey in the URL
 const key = new URL(request.url).searchParams.get("key");
 if (key !== process.env.ADMIN_KEY) {
 return Response.json(
 { ok: false, error: "Unauthorised" },
 { status: 401 }
 );
 }
 // Get all scores
 const { data: scores, error: scoresError } = await supabase
 .from("scores")
 .select("match_score, recommendation, created_at")
 .order("created_at", { ascending: false });
 if (scoresError) {
 return Response.json({ ok: false, error: scoresError.message },
 { status: 500 });
 }
 // Get all feedback
 const { data: feedback } = await supabase
 .from("feedback")
 .select("rating");
 const thumbsUp = feedback?.filter(f => f.rating === "up").length || 0;
 const thumbsDown = feedback?.filter(f => f.rating === "down").length || 0;
 const total = thumbsUp + thumbsDown;
 const accuracy = total > 0
 ? Math.round((thumbsUp / total) * 100) + "%"
 : "No feedback yet";
 // Average score
 const avgScore = scores?.length > 0
 ? Math.round(scores.reduce((sum, s) => sum + s.match_score, 0)
 / scores.length)
 : 0;
 // Breakdown by recommendation
 const breakdown = {};
 scores?.forEach(s => {
 breakdown[s.recommendation] = (breakdown[s.recommendation] || 0) + 1;
 });
 return Response.json({
 ok: true,
 totalAnalyses: scores?.length || 0,
 thumbsUp,
 thumbsDown,
 accuracy,
 averageScore: avgScore,
 breakdown,
 recentTen: scores?.slice(0, 10),
 });
}
