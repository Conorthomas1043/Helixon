// Type-checks lib/ (JS, via checkJs) and the TypeScript files, then compares
// the errors per file with scripts/typecheck-baseline.json. The baseline is
// the backlog from when checking was switched on: a file may lose errors but
// never gain them, and a file not in the baseline must have none. That lets
// CI enforce types on new code today without a big-bang cleanup.
//
// Then checks the API boundary (tsconfig.strict.json: the response
// contracts in lib/contracts, lib/api and lib/api-client) in strict mode,
// with no baseline: those files must have no errors at all. Files they
// import are checked as part of the program, but only errors in the strict
// files themselves count.
//
//   npm run typecheck              # check
//   npm run typecheck -- --update  # rewrite the baseline (after fixing errors)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselineFile = path.join(root, "scripts/typecheck-baseline.json");

function tsc(project) {
  const run = spawnSync("npx", ["tsc", "-p", project, "--pretty", "false"], {
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
  return errors;
}

// "lib/api/**/*.js" -> a RegExp for the file paths tsc prints.
function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/\*\*\//g, "\0").replace(/\*/g, "[^/]*").replace(/\0/g, "(?:.*/)?");
  return new RegExp(`^${pattern}$`);
}

function checkStrict() {
  const config = JSON.parse(fs.readFileSync(path.join(root, "tsconfig.strict.json"), "utf8"));
  const scope = config.include.filter((g) => g !== "next-env.d.ts").map(globToRegExp);
  const errors = tsc("tsconfig.strict.json").filter((line) => scope.some((re) => re.test(line.slice(0, line.indexOf("(")))));
  if (errors.length) {
    console.error("Strict type errors at the API boundary (tsconfig.strict.json allows none):\n");
    for (const line of errors) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log("Strict check OK: the API boundary has no type errors.");
}

const errors = tsc("tsconfig.check.json");

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

checkStrict();
