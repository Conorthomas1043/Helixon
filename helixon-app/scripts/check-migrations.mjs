// CI check for supabase/migrations: every file is named
// <14-digit timestamp>_<name>.sql and no two share a timestamp, so
// `supabase db push` applies them in one well-defined order.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../supabase/migrations");
const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
const problems = [];
const seen = new Map();

for (const file of files) {
  const m = file.match(/^(\d{14})_[a-z0-9_]+\.sql$/);
  if (!m) {
    problems.push(`${file}: expected <YYYYMMDDHHMMSS>_<snake_case_name>.sql`);
    continue;
  }
  if (seen.has(m[1])) problems.push(`${file}: same timestamp as ${seen.get(m[1])}`);
  seen.set(m[1], file);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`${files.length} migrations OK.`);
