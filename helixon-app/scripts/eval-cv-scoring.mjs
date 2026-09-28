// Measures CV scoring against recruiter judgement.
//
//   ANTHROPIC_API_KEY=... npm run eval:cv -- path/to/cases.json
//
// cases.json is a list of CV/job pairs a recruiter has already scored:
//
//   [
//     {
//       "id": "backend-jane",
//       "cv": "cvs/jane.pdf",                  // PDF or DOCX, relative to cases.json
//       "job": "jobs/backend.txt",             // job description text file
//       "expected_score": 78,                  // recruiter's 0-100 score (optional)
//       "expected_recommendation": "Strong match"  // "Strong match" | "Worth reviewing" | "Not suitable" (optional)
//     }
//   ]
//
// Runs every case through the same analyseCV() pipeline /api/run uses
// (nothing is saved) and reports mean absolute error against the
// recruiter's scores, rank correlation, recommendation agreement and time
// per CV. Run it before and after any scoring change - including the
// CV_EXTRACTION_EFFORT / CV_JUDGMENT_EFFORT / CV_FIT_JUDGE_SAMPLES
// settings - to see whether the change actually helped. Keep the CVs out
// of git: they're personal data.
//
// Makes real Claude calls (2-3 per case), so it costs money.

import { readFile } from "node:fs/promises";
import { dirname, resolve, extname, basename } from "node:path";
import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// The app imports "@/..." (Next's path alias) and extensionless paths;
// resolve those the way Next does so the pipeline runs under plain Node.
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

const MIME = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function spearman(xs, ys) {
  const rank = (v) => {
    const sorted = [...v].map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(v.length);
    for (let i = 0; i < sorted.length; ) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1][0] === sorted[i][0]) j++;
      for (let k = i; k <= j; k++) r[sorted[k][1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < rx.length; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : NaN;
}

async function main() {
  const casesPath = process.argv[2];
  if (!casesPath) {
    console.error("Usage: npm run eval:cv -- path/to/cases.json");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set.");
    process.exit(1);
  }

  const { default: analyseCV } = await import("../lib/cv-analysis/pipeline/analyseCV.js");

  const baseDir = dirname(resolve(casesPath));
  const cases = JSON.parse(await readFile(casesPath, "utf8"));
  const rows = [];

  for (const c of cases) {
    const cvPath = resolve(baseDir, c.cv);
    const jobText = (await readFile(resolve(baseDir, c.job), "utf8")).trim();
    const file = new File([await readFile(cvPath)], basename(cvPath), {
      type: MIME[extname(cvPath).toLowerCase()] || "",
    });

    const started = Date.now();
    try {
      const { result } = await analyseCV(file, jobText);
      const seconds = (Date.now() - started) / 1000;
      rows.push({ ...c, score: result.match_score, recommendation: result.recommendation, seconds });
      console.log(
        `${c.id}: ${result.match_score} (${result.recommendation})` +
          (c.expected_score != null ? ` vs ${c.expected_score}` : "") +
          (c.expected_recommendation ? ` / ${c.expected_recommendation}` : "") +
          `  ${seconds.toFixed(1)}s`
      );
    } catch (err) {
      console.log(`${c.id}: FAILED - ${err.message}`);
      rows.push({ ...c, error: err.message });
    }
  }

  const ok = rows.filter((r) => !r.error);
  const scored = ok.filter((r) => typeof r.expected_score === "number");
  const labelled = ok.filter((r) => r.expected_recommendation);

  console.log("\n--- summary ---");
  console.log(`cases: ${rows.length}, failed: ${rows.length - ok.length}`);
  if (ok.length) {
    const times = ok.map((r) => r.seconds).sort((a, b) => a - b);
    console.log(`time per CV: mean ${(times.reduce((s, t) => s + t, 0) / times.length).toFixed(1)}s, p90 ${times[Math.floor(times.length * 0.9)].toFixed(1)}s`);
  }
  if (scored.length) {
    const mae = scored.reduce((s, r) => s + Math.abs(r.score - r.expected_score), 0) / scored.length;
    console.log(`mean absolute error vs recruiter score: ${mae.toFixed(1)} points`);
    if (scored.length >= 3) {
      console.log(`rank correlation (Spearman): ${spearman(scored.map((r) => r.score), scored.map((r) => r.expected_score)).toFixed(2)}`);
    }
  }
  if (labelled.length) {
    const agree = labelled.filter((r) => r.recommendation === r.expected_recommendation).length;
    console.log(`recommendation agreement: ${agree}/${labelled.length} (${Math.round((agree / labelled.length) * 100)}%)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
