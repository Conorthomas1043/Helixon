// Counterfactual fairness audit of CV scoring (docs/ux-research-audit.md,
// R7 / study S6). For each case, scores the CV as written and in variants
// that differ in exactly one signal of a protected characteristic - name,
// a caring or parental career break, a disability disclosure, school - and
// reports any difference larger than the pipeline's own run-to-run noise.
// Method and references: scripts/lib/counterfactual.mjs.
//
//   ANTHROPIC_API_KEY=... VOYAGE_API_KEY=... npm run eval:fairness -- scripts/eval-samples/cases.json --repeat 3
//
// Plain-text CVs only (the name has to be on line 1). Uses the fictional
// sample set by default - never run it on real candidates' CVs.
// Cost: cases × 14 variants × repeat screenings (6 × 14 × 3 ≈ 250, ~£20).
// Exits 1 when anything is flagged, so it can gate a scoring change.
import { readFile } from "node:fs/promises";
import { dirname, resolve, basename } from "node:path";
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import { buildVariants, compareToBaseline, nameSpread } from "./lib/counterfactual.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
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

async function main() {
  const args = process.argv.slice(2);
  const repeatAt = args.indexOf("--repeat");
  const repeat = repeatAt >= 0 ? Math.max(2, Math.min(10, Number(args[repeatAt + 1]) || 3)) : 3;
  const casesPath = args.find((a, i) => !a.startsWith("--") && i !== repeatAt + 1) || resolve(appRoot, "scripts/eval-samples/cases.json");
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }
  const { default: analyseCV } = await import("../lib/cv-analysis/pipeline/analyseCV.js");
  const baseDir = dirname(resolve(casesPath));
  const cases = JSON.parse(await readFile(casesPath, "utf8")).filter((c) => c.cv.endsWith(".txt"));

  let flaggedTotal = 0;
  for (const c of cases) {
    const cvText = await readFile(resolve(baseDir, c.cv), "utf8");
    const jobText = await readFile(resolve(baseDir, c.job), "utf8");
    const results = [];
    for (const v of buildVariants(cvText)) {
      const scores = [];
      const recommendations = [];
      for (let i = 0; i < repeat; i++) {
        const file = new File([v.cvText], basename(c.cv), { type: "text/plain" });
        const { result } = await analyseCV(file, jobText, { cvText: v.cvText });
        scores.push(result.match_score);
        recommendations.push(result.recommendation);
      }
      results.push({ attribute: v.attribute, scores, recommendations });
      process.stdout.write(".");
    }
    const rows = compareToBaseline(results);
    const spread = nameSpread(results);
    const flagged = rows.filter((r) => r.flagged);
    flaggedTotal += flagged.length;
    console.log(`\n\n${c.id}: baseline ${results[0].scores.join(", ")}`);
    for (const r of rows) {
      console.log(`  ${r.flagged ? "FLAG" : "ok  "}  ${r.attribute.padEnd(28)} ${r.delta >= 0 ? "+" : ""}${r.delta}${r.flipped ? `  (recommendation -> ${r.recommendation})` : ""}`);
    }
    if (spread) console.log(`  widest gap between names: ${spread.gap} points (${spread.lowest.attribute} lowest, ${spread.highest.attribute} highest)`);
  }
  console.log(`\n${flaggedTotal ? `${flaggedTotal} difference(s) beyond run-to-run noise - investigate before shipping.` : "No difference beyond run-to-run noise."}`);
  process.exit(flaggedTotal ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
