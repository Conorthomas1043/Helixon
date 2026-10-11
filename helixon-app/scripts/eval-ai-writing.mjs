// How well the AI-writing check (lib/cv-analysis/extraction/aiWritingCheck.js)
// separates AI-written CVs from human ones, on labelled examples. Reports
// precision, recall and - the number that matters most - how often it
// wrongly flags a human-written CV, overall and per group (non-native English
// writers especially, whom AI-text detectors are known to flag more).
//
//   ANTHROPIC_API_KEY=... npm run eval:ai-writing -- [file] [--repeat 3] --yes
//
// file defaults to scripts/eval-samples/ai-writing.json (a synthetic starter
// set - add real, permitted CVs to make the numbers meaningful). Without
// --yes it only says what the run would cost: one small Claude call per CV
// per repeat (about $0.01 each).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { aiWritingMetrics, pct } from "./lib/ai-writing-eval.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a)) || resolve(appRoot, "scripts/eval-samples/ai-writing.json");
const repeatAt = args.indexOf("--repeat");
const repeat = repeatAt >= 0 ? Math.max(1, Number(args[repeatAt + 1]) || 1) : 1;
const { cases } = JSON.parse(readFileSync(file, "utf8"));

console.log(`${cases.length} labelled CVs (${cases.filter((c) => c.label === "ai").length} AI-written), ${repeat} run(s) each: ${cases.length * repeat} calls, about $${(cases.length * repeat * 0.01).toFixed(2)}.`);
if (!args.includes("--yes")) {
  console.log("Add --yes to run it.");
  process.exit(0);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Set ANTHROPIC_API_KEY.");
  process.exit(1);
}

const { default: checkAiWriting } = await import("../lib/cv-analysis/extraction/aiWritingCheck.js");
const { aiWritingNotice } = await import("../lib/screening/ai-writing.js");

const results = [];
for (const c of cases) {
  for (let i = 0; i < repeat; i++) {
    const aiWriting = await checkAiWriting(c.cv);
    const flagged = Boolean(aiWritingNotice({ ai_writing: aiWriting }));
    results.push({ id: c.id, label: c.label, group: c.group, flagged, likelihood: aiWriting.likelihood });
    console.log(`${c.id.padEnd(12)} ${c.label.padEnd(6)} ${aiWriting.likelihood.padEnd(7)} ${flagged ? "FLAGGED" : ""}`);
  }
}

const m = aiWritingMetrics(results);
console.log("");
console.log(`Precision (flagged that really were AI):  ${pct(m.precision)}`);
console.log(`Recall (AI-written CVs caught):           ${pct(m.recall)}`);
console.log(`False alarms (human CVs flagged):         ${pct(m.falseAlarmRate)}  (${m.counts.fp} of ${m.counts.fp + m.counts.tn})`);
for (const [group, g] of Object.entries(m.byGroup)) {
  console.log(`  ${group.padEnd(12)} ${pct(g.rate)} (${g.falseAlarms} of ${g.humans})`);
}
