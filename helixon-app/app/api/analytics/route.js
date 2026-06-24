import { supabase } from "@/lib/supabase";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const agencyId = searchParams.get("agencyId");
    const days = parseInt(searchParams.get("days") || "30");

    if (!agencyId) {
      return Response.json({ ok: false, error: "agencyId required" }, { status: 400 });
    }

    // Calculate the start of the period
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceISO = since.toISOString();

    // Run all queries in parallel for speed
    const [
      { count: totalAll },
      { count: totalPeriod },
      { data: periodScores },
      { count: totalCandidates },
      { count: summaries },
      { count: emails },
      { data: feedback },
    ] = await Promise.all([
      // Total analyses ever
      supabase
        .from("scores")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId),
      // Analyses in the selected period
      supabase
        .from("scores")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .gte("created_at", sinceISO),
      // Score rows in the period (for time series and recommendation breakdown)
      supabase
        .from("scores")
        .select("match_score, recommendation, created_at, recruiter_feedback")
        .eq("agency_id", agencyId)
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: true }),
      // Total candidates ever
      supabase
        .from("candidates")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId),
      // Total summaries generated (artifacts with kind = 'summary')
      supabase
        .from("artifacts")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("kind", "summary"),
      // Total emails drafted (artifacts with kind = 'email_draft')
      supabase
        .from("artifacts")
        .select("*", { count: "exact", head: true })
        .eq("agency_id", agencyId)
        .eq("kind", "email_draft"),
      // Feedback ratings (for accuracy calculation)
      supabase.from("feedback").select("rating"),
    ]);

    // Build time series — group scores by day
    const byDay = {};
    (periodScores || []).forEach((s) => {
      const day = s.created_at.substring(0, 10); // "YYYY-MM-DD"
      if (!byDay[day]) byDay[day] = { count: 0, total: 0 };
      byDay[day].count++;
      byDay[day].total += s.match_score;
    });
    const timeSeries = Object.entries(byDay).map(([date, d]) => ({
      date,
      count: d.count,
      avg: Math.round(d.total / d.count),
    }));

    // Recommendations breakdown — how many strong / worth reviewing / not a fit
    const recs = {
      "Strong match": 0,
      "Worth reviewing": 0,
      "Likely not a fit": 0,
    };
    (periodScores || []).forEach((s) => {
      if (recs[s.recommendation] !== undefined) recs[s.recommendation]++;
    });

    // Accuracy rate — what % of feedback ratings were thumbs up
    const up = (feedback || []).filter((f) => f.rating === "up").length;
    const down = (feedback || []).filter((f) => f.rating === "down").length;
    const accuracyRate = up + down > 0 ? Math.round((up / (up + down)) * 100) : null;

    // Top roles — join scores with jobs to get job titles, group and count
    const { data: scoredJobs } = await supabase
      .from("scores")
      .select("match_score, jobs(title)")
      .eq("agency_id", agencyId)
      .gte("created_at", sinceISO);

    const byRole = {};
    (scoredJobs || []).forEach((s) => {
      const t = s.jobs?.title || "Unknown";
      if (!byRole[t]) byRole[t] = { count: 0, total: 0 };
      byRole[t].count++;
      byRole[t].total += s.match_score;
    });
    const topRoles = Object.entries(byRole)
      .map(([title, d]) => ({
        title,
        count: d.count,
        avg: Math.round(d.total / d.count),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return Response.json({
      ok: true,
      analytics: {
        period_days: days,
        totals: {
          all_time: totalAll,
          period: totalPeriod,
          candidates: totalCandidates,
          summaries,
          emails,
        },
        accuracy: { up, down, rate: accuracyRate },
        recommendations: recs,
        time_series: timeSeries,
        top_roles: topRoles,
      },
    });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}