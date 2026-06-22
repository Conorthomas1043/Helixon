import { supabase } from "@/lib/supabase";
export async function GET(request) {
  // Simple password gate — add ADMIN_KEY to .env.local
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key !== process.env.ADMIN_KEY) {
    return Response.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  // Get all analyses
  const { data: analyses } = await supabase
    .from("analyses")
    .select("*")
    .order("created_at", { ascending: false });
  // Get feedback
  const { data: feedback } = await supabase
    .from("feedback")
    .select("*");
  const thumbsUp = feedback?.filter(f => f.rating === "up").length || 0;
  const thumbsDown = feedback?.filter(f => f.rating === "down").length || 0;
  // Count by JD type (using recommendation as a proxy)
  const byType = {};
  analyses?.forEach(a => {
    const key = a.recommendation || "Unknown";
    byType[key] = (byType[key] || 0) + 1;
  });
  return Response.json({
    ok: true,
    totalAnalyses: analyses?.length || 0,
    thumbsUp,
    thumbsDown,
    byRecommendation: byType,
    recent: analyses?.slice(0, 10)
  });
}