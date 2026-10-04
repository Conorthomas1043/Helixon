import { requireAdminSession } from "@/lib/admin/auth";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { adminJson as json, adminErrorResponse } from "@/lib/admin/http";
import { RUBRIC_VERSION } from "@/lib/cv-analysis/config";
import { calibrate, componentShares } from "@/lib/cv-analysis/calibration";
import { loadScores } from "@/lib/cv-analysis/calibration/load";

// Scoring calibration for Admin > Health: how many analyses recruiters have
// labelled, how well the current weights rank candidates against those
// labels, and suggested weights once there's enough evidence. Read-only -
// changing the weights is a code change (lib/cv-analysis/config.js).
// Same method as `npm run calibrate`.

const MIN_LABELS = 100;

export async function GET() {
  try {
    await requireAdminSession();
    const rows = await loadScores(getAdminSupabase());

    const byRole = new Map();
    for (const row of rows) {
      if (!byRole.has(row.roleType)) byRole.set(row.roleType, []);
      byRole.get(row.roleType).push({ shares: componentShares(row.result, row.roleType), label: row.label, source: row.source });
    }
    const roles = [...byRole].map(([roleType, list]) => ({
      ...calibrate(list, { roleType, minLabels: MIN_LABELS }),
      scores: list.length,
      fromRecruiterBands: list.filter((r) => r.source === "recruiter band").length,
      fromPipeline: list.filter((r) => r.source === "pipeline outcome").length,
    }));

    // Run-to-run variance, where scoring sampled the judgement more than once.
    const spreads = rows.map((r) => r.result?.fit_judgment?.spread).filter(Boolean);
    const meanSpread = spreads.length
      ? Math.round((spreads.reduce((s, x) => s + (x.industry_relevance + x.career_trajectory + x.achievement_quality) / 3, 0) / spreads.length) * 10) / 10
      : null;

    return json({
      ok: true,
      rubricVersion: RUBRIC_VERSION,
      minLabels: MIN_LABELS,
      totals: {
        scores: rows.length,
        labelled: rows.filter((r) => r.label !== null).length,
        currentRubric: rows.filter((r) => r.result?.rubric_version === RUBRIC_VERSION).length,
      },
      variance: { samples: spreads.length, meanJudgementSpread: meanSpread },
      roles,
    });
  } catch (error) {
    return adminErrorResponse("scoring", error);
  }
}
