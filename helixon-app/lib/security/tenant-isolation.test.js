// Guards the one rule that keeps agencies' data apart.
//
// API routes talk to Supabase with the service-role key, which bypasses
// row-level security, so tenant isolation lives in the code: every query on
// an agency-owned table has to carry `.eq("agency_id", …)` (or reach the
// row through a parent that was already checked). One forgotten filter
// would show one agency another agency's records, and nothing else would
// notice.
//
// This test finds every query in app/api on a table that has an agency_id
// column and counts, per file, the ones with no `agency_id` in the same
// statement. Today's counts are recorded in tenant-isolation.baseline.json
// (crons, webhooks, admin tools and token links legitimately work across
// agencies or look rows up by an unguessable token). The test fails when a
// file gains an unfiltered query, so a new one has to be looked at and the
// baseline updated on purpose, in review:
//
//   UPDATE_TENANT_BASELINE=1 npx vitest run lib/security/tenant-isolation.test.js
//
// Counts that go down are fine; lower the baseline to lock in the gain.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "../..");
const BASELINE_FILE = path.join(__dirname, "tenant-isolation.baseline.json");

// Tables created before the migration history began (see
// 20260916161700_lock_down_agency_scoped_tables_post_clerk_migration.sql),
// so their agency_id column isn't visible in a CREATE TABLE below.
const LEGACY_AGENCY_TABLES = ["candidates", "jobs", "scores", "candidate_notes", "shortlists", "feedback_requests", "artifacts", "job_channels"];

function walk(dir, match, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, match, out);
    else if (match(entry.name)) out.push(full);
  }
  return out;
}

export function agencyScopedTables() {
  const tables = new Set(LEGACY_AGENCY_TABLES);
  const sqlFiles = walk(path.join(ROOT, "supabase"), (n) => n.endsWith(".sql"));
  for (const file of sqlFiles) {
    const sql = fs.readFileSync(file, "utf8");
    for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?"?(\w+)"?\s*\(([\s\S]*?)\n\);/gi)) {
      if (/\bagency_id\b/.test(m[2])) tables.add(m[1]);
    }
    for (const m of sql.matchAll(/alter table (?:if exists )?(?:public\.)?"?(\w+)"?\s+add column (?:if not exists )?agency_id\b/gi)) {
      tables.add(m[1]);
    }
  }
  return tables;
}

export function unfilteredQueries(source, tables) {
  const hits = [];
  for (const m of source.matchAll(/\.from\(\s*["'](\w+)["']\s*\)/g)) {
    if (!tables.has(m[1])) continue;
    const end = source.indexOf(";", m.index);
    const statement = source.slice(m.index, end === -1 ? m.index + 800 : end);
    if (!statement.includes("agency_id")) hits.push(m[1]);
  }
  return hits;
}

function currentCounts() {
  const tables = agencyScopedTables();
  const counts = {};
  const files = walk(path.join(ROOT, "app/api"), (n) => /\.(js|jsx|ts|mjs)$/.test(n) && !n.includes(".test."));
  for (const file of files.sort()) {
    const hits = unfilteredQueries(fs.readFileSync(file, "utf8"), tables);
    if (hits.length) counts[path.relative(ROOT, file).split(path.sep).join("/")] = hits.length;
  }
  return counts;
}

describe("tenant isolation", () => {
  it("knows the agency-owned tables", () => {
    const tables = agencyScopedTables();
    for (const t of ["candidates", "jobs", "clients", "invoices", "placements"]) expect(tables.has(t)).toBe(true);
  });

  it("spots a query with no agency filter", () => {
    const tables = new Set(["candidates"]);
    expect(unfilteredQueries('await supabase.from("candidates").select("*").eq("id", id);', tables)).toEqual(["candidates"]);
    expect(unfilteredQueries('await supabase.from("candidates").select("*").eq("id", id).eq("agency_id", agencyId);', tables)).toEqual([]);
    expect(unfilteredQueries('await supabase.from("profiles").select("*");', tables)).toEqual([]);
  });

  it("no API route gains a query on an agency table without an agency_id filter", () => {
    const counts = currentCounts();
    if (process.env.UPDATE_TENANT_BASELINE) {
      fs.writeFileSync(BASELINE_FILE, JSON.stringify(counts, null, 2) + "\n");
      return;
    }
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
    const grew = Object.entries(counts)
      .filter(([file, n]) => n > (baseline[file] || 0))
      .map(([file, n]) => `${file}: ${baseline[file] || 0} -> ${n} unfiltered queries`);
    expect(grew, "Add .eq(\"agency_id\", agencyId) to the new query, or, if it is safe without one (cron, webhook, token link, parent already checked), update the baseline - see the top of this file.").toEqual([]);
  });
});
