// Re-scores candidates recruiters have already labelled (a band on the
// analysis, or a pipeline outcome - see scripts/lib/labelled-scores.mjs)
// with the scoring code as it is now, and reports how well it agrees with
// them. Use it before and after a scoring change, instead of keeping CVs in
// files: the CV and job text are read from the database and nothing is
// written back or saved anywhere.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ANTHROPIC_API_KEY=... \
//     npm run eval:labelled -- [--limit 50] [--repeat 3] [--agency <uuid>] --yes
//
// Without --yes it only says how many labelled candidates there are and
// what the run would cost. Each case makes 2-3 Claude calls (about $0.09);
// --repeat N runs each case N times to measure run-to-run variance.
//
// This re-processes candidates' CVs, so run it only for agencies whose data
// you're permitted to use for improving the service (see the DPA).

import { dirname, resolve } from "node:path";
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { auc } from "../lib/cv-analysis/calibration/index.js";
import { loadScores, supabaseFromEnv } from "./lib/labelled-scores.mjs";
import { spread, varianceSummary } from "./lib/variance.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Resolve the app's "@/..." imports the way Next does (as in eval-cv-scoring.mjs).
register(
  "data:text/javascript," +
    encodeURIComponent(`
      const root = ${JSON.stringify(pathToFileURL(appRoot + "/").href)};
      export async function resolve(specifier, context, next) {
        if (specifier.startsWith("@/")) {
          const url = new URL(specifier.slice(2), root).href;
          try { return await next(url, context); } catch { return next(url + ".js", context); }
        }
        return next(specifier, context);
      }
    `)
);

const COST_PER_CV_USD = 0.09;
const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const limit = Math.max(1, Number(option("--limit")) || 50);
const repeat = Math.max(1, Math.min(10, Number(option("--repeat")) || 1));
const agency = option("--agency");

const all = await loadScores(supabaseFromEnv(), { withText: true });
const cases = all
  .filter((r) => r.label !== null && r.cvText && r.jobText && (!agency || r.agencyId === agency))
  .slice(-limit);

const suitableCount = cases.filter((c) => c.label === 1).length;
console.log(`Labelled candidates with CV and job text: ${cases.length} (${suitableCount} suitable, ${cases.length - suitableCount} not)`);
console.log(`Estimated cost: ${cases.length} × ${repeat} run(s) × ~$${COST_PER_CV_USD} ≈ $${(cases.length * repeat * COST_PER_CV_USD).toFixed(2)}`);
if (!cases.length) process.exit(0);
if (!args.includes("--yes")) {
  console.log("Nothing run. Add --yes to run it.");
  process.exit(0);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(1);
}

const { default: analyseCV } = await import("../lib/cv-analysis/pipeline/analyseCV.js");
const suitable = (rec) => rec === "Strong match" || rec === "Worth reviewing";
const results = [];
for (const c of cases) {
  try {
    const runs = [];
    for (let r = 0; r < repeat; r++) {
      const { result } = await analyseCV(null, c.jobText, { cvText: c.cvText, jobParsed: c.jobParsed });
      runs.push(result);
    }
    const scores = runs.map((r) => r.match_score);
    const score = spread(scores).mean;
    results.push({ ...c, score, scores, recommendations: runs.map((r) => r.recommendation) });
    console.log(`${c.scoreId.slice(0, 8)}: ${Math.round(score)}${repeat > 1 ? ` [${scores.join(", ")}]` : ""} was ${c.matchScore} · label ${c.label ? "suitable" : "not suitable"} (${c.source})`);
  } catch (err) {
    console.log(`${c.scoreId.slice(0, 8)}: FAILED - ${err.message}`);
  }
}

console.log("\n--- summary ---");
if (results.length) {
  const labels = results.map((r) => r.label);
  const agree = results.filter((r) => suitable(r.recommendations[0]) === (r.label === 1)).length;
  console.log(`agreement with recruiters (suitable vs not): ${agree}/${results.length} (${Math.round((agree / results.length) * 100)}%)`);
  const now = auc(results.map((r) => r.score), labels);
  const before = auc(results.map((r) => r.matchScore), labels);
  if (now !== null) console.log(`ranking quality (AUC): now ${now.toFixed(2)}, when first scored ${before?.toFixed(2) ?? "n/a"}`);
  for (const line of varianceSummary(results)) console.log(line);
}
