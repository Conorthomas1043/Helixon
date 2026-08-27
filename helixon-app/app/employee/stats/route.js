// app/api/employee/stats/route.js
// Read-only stats visible to employees - no sensitive data, no agency detail.

import { supabase } from "@/lib/supabase";
import { getEmployeeSession } from "@/lib/employee-auth";

export async function GET() {
  const emp = await getEmployeeSession();
  if (!emp) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const [
      { count: totalCandidates },
      { count: totalAgencies },
      { data: scores },
    ] = await Promise.all([
      supabase.from("candidates").select("id", { count: "exact", head: true }),
      supabase.from("agencies").select("id", { count: "exact", head: true }),
      supabase.from("scores").select("match_score").limit(500),
    ]);

    const safeScores = scores || [];
    const avgScore = safeScores.length > 0
      ? Math.round(safeScores.reduce((a, b) => a + (b.match_score || 0), 0) / safeScores.length)
      : 0;

    return Response.json({
      ok: true,
      stats: {
        totalCandidates: totalCandidates || 0,
        totalAgencies: totalAgencies || 0,
        avgScore,
        totalAnalyses: safeScores.length,
      },
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}