// Type-checks lib/ (JS, via checkJs) and the TypeScript files, then compares
// the errors per file with scripts/typecheck-baseline.json. The baseline is
// the backlog from when checking was switched on: a file may lose errors but
// never gain them, and a file not in the baseline must have none. That lets
// CI enforce types on new code today without a big-bang cleanup.
//
//   npm run typecheck              # check
//   npm run typecheck -- --update  # rewrite the baseline (after fixing errors)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselineFile = path.join(root, "scripts/typecheck-baseline.json");

const run = spawnSync("npx", ["tsc", "-p", "tsconfig.check.json", "--pretty", "false"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
const output = `${run.stdout}${run.stderr}`;
const errors = output.split("\n").filter((l) => /\): error TS\d+/.test(l));
if (run.status !== 0 && errors.length === 0) {
  console.error(output);
  process.exit(run.status || 1);
}

const counts = {};
for (const line of errors) {
  const file = line.slice(0, line.indexOf("("));
  counts[file] = (counts[file] || 0) + 1;
}

if (process.argv.includes("--update")) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(baselineFile, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`Baseline written: ${errors.length} errors in ${Object.keys(counts).length} files.`);
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselineFile, "utf8"));
const grew = Object.entries(counts).filter(([file, n]) => n > (baseline[file] || 0));
const total = errors.length;
const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);

if (grew.length) {
  console.error("New type errors (fix them, don't add to the baseline):\n");
  for (const [file] of grew) {
    for (const line of errors.filter((l) => l.startsWith(`${file}(`))) console.error(`  ${line}`);
  }
  process.exit(1);
}
console.log(`Type check OK: ${total} known errors (baseline ${baselineTotal}).`);
if (total < baselineTotal) console.log("Errors went down - run `npm run typecheck -- --update` to lock that in.");
