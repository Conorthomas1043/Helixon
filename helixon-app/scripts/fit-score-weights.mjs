// Checks the scoring weights against what recruiters decided, and suggests
// new ones once there's enough evidence. Read-only: it never changes the
// weights - copy a "ready" suggestion into SCORE_WEIGHT_PROFILES in
// lib/cv-analysis/config.js yourself, bump RUBRIC_VERSION, and re-run the
// evaluations.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run calibrate
//   ... npm run calibrate -- --min 60     (lower the label threshold, e.g. to preview)
//   ... npm run calibrate -- --json       (machine-readable)
//
// No Claude calls, no cost. See lib/cv-analysis/calibration for the method.

import { calibrate, componentShares } from "../lib/cv-analysis/calibration/index.js";
import { loadScores, supabaseFromEnv } from "./lib/labelled-scores.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};

const rows = await loadScores(supabaseFromEnv());
const minLabels = option("--min", 100);
const byRole = new Map();
for (const row of rows) {
  if (!byRole.has(row.roleType)) byRole.set(row.roleType, []);
  byRole.get(row.roleType).push({ shares: componentShares(row.result, row.roleType), label: row.label, source: row.source });
}

const reports = [...byRole].map(([roleType, list]) => ({
  ...calibrate(list, { roleType, minLabels }),
  scores: list.length,
  fromRecruiterBands: list.filter((r) => r.source === "recruiter band").length,
  fromPipeline: list.filter((r) => r.source === "pipeline outcome").length,
}));

if (flag("--json")) {
  console.log(JSON.stringify({ totalScores: rows.length, reports }, null, 2));
} else {
  const labelled = rows.filter((r) => r.label !== null).length;
  console.log(`Scores: ${rows.length}, labelled: ${labelled}\n`);
  for (const r of reports) {
    console.log(`== ${r.roleType} ==`);
    console.log(`scores ${r.scores} · labels ${r.labels} (${r.positives} suitable, ${r.negatives} not) · from recruiter bands ${r.fromRecruiterBands}, from pipeline ${r.fromPipeline}`);
    if (r.currentAuc !== null) console.log(`ranking quality (AUC): current weights ${r.currentAuc?.toFixed(2)}, fitted ${r.fittedAuc?.toFixed(2) ?? "n/a"}`);
    console.log(`current:   ${JSON.stringify(r.current)}`);
    if (r.suggested) console.log(`suggested: ${JSON.stringify(r.suggested)}`);
    console.log(`${r.ready ? "READY" : "not ready"} - ${r.reason}\n`);
  }
}
