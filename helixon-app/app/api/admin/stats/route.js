import { supabase } from "@/lib/supabase";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(request) {
  try {
    // Accept EITHER a valid admin session cookie (new, used by the dashboard
    // UI after login) OR the legacy x-admin-key header (kept for any other
    // internal tooling that already calls this route directly).
    const session = await getAdminSession();
    const adminKey = request.headers.get("x-admin-key");
    const keyValid = adminKey && adminKey === process.env.ADMIN_KEY;

    if (!session && !keyValid) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const [
      { data: scores },
      { data: candidates },
      { data: subscriptions },
      { data: agencies },
    ] = await Promise.all([
      supabase
        .from("scores")
        .select("*, candidates(name, agency_id), jobs(title, agency_id)")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("candidates")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("agencies")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    const safeScores = scores || [];
    const safeCandidates = candidates || [];
    const safeSubs = subscriptions || [];
    const safeAgencies = agencies || [];

    const totalScores = safeScores.length;
    const avgScore =
      totalScores > 0
        ? Math.round(
            safeScores.reduce((a, b) => a + (b.match_score || 0), 0) / totalScores
          )
        : 0;

    const stats = {
      totalScores,
      totalCandidates: safeCandidates.length,
      totalAgencies: safeAgencies.length,
      avgScore,
      activeSubscriptions: safeSubs.filter((s) => s.status === "active").length,
      strongMatches: safeScores.filter((s) => s.recommendation === "Strong match").length,
      worthReviewing: safeScores.filter((s) => s.recommendation === "Worth reviewing").length,
      notAFit: safeScores.filter((s) => s.recommendation === "Likely not a fit").length,
    };

    return Response.json({
      ok: true,
      stats,
      scores: safeScores,
      candidates: safeCandidates,
      subscriptions: safeSubs,
      agencies: safeAgencies,
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}