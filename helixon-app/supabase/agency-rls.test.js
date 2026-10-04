// Runs the agency_member RLS migration on a real Postgres engine (PGlite) and
// checks that the database itself keeps agencies apart.

import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { AGENCY_RLS_EXCLUDED } from "../lib/agency-tables";

const MIGRATION = fs.readFileSync(path.join(__dirname, "migrations/20261005000000_agency_member_rls.sql"), "utf8");
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

let db;

// What Supabase provides: the API roles and auth.jwt() reading the claims
// PostgREST sets for the request.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role authenticator noinherit login;
  create schema auth;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  grant usage on schema auth to anon, authenticated, public;
  grant execute on function auth.jwt() to public;

  create table public.agencies (id uuid primary key, name text);
  create table public.candidates (id serial primary key, agency_id uuid, name text);
  create table public.jobs (id serial primary key, agency_id uuid, title text);
  create table public.profiles (id serial primary key, agency_id uuid, clerk_user_id text);
  create table public.api_keys (id serial primary key, agency_id uuid, hash text);
  -- Supabase's default: API roles can reach every table; RLS decides rows.
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  grant usage on schema public to anon, authenticated;

  insert into public.candidates (agency_id, name) values ('${A}', 'Ada (agency A)'), ('${B}', 'Bo (agency B)');
  insert into public.jobs (agency_id, title) values ('${A}', 'A job'), ('${B}', 'B job');
  insert into public.profiles (agency_id, clerk_user_id) values ('${A}', 'user_a'), ('${B}', 'user_b');
  insert into public.api_keys (agency_id, hash) values ('${A}', 'secret-a');
`;

async function as(role, claims, sql, params) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(claims || {})]);
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(MIGRATION);
  // Applying it twice must be harmless (re-run after adding a table).
  await db.exec(MIGRATION);
}, 60_000);

describe("agency_member RLS", () => {
  it("shows a member only their own agency's rows", async () => {
    const { rows } = await as("agency_member", { role: "agency_member", agency_id: A }, "select name from public.candidates order by id");
    expect(rows.map((r) => r.name)).toEqual(["Ada (agency A)"]);
  });

  it("ignores a query that asks for another agency's rows", async () => {
    const { rows } = await as("agency_member", { agency_id: A }, "select * from public.jobs where agency_id = $1", [B]);
    expect(rows).toEqual([]);
  });

  it("refuses to write a row into another agency", async () => {
    await expect(
      as("agency_member", { agency_id: A }, "insert into public.candidates (agency_id, name) values ($1, 'planted')", [B])
    ).rejects.toThrow(/row-level security/);
  });

  it("can't update or delete another agency's rows", async () => {
    const upd = await as("agency_member", { agency_id: A }, "update public.candidates set name = 'x' where agency_id = $1", [B]);
    const del = await as("agency_member", { agency_id: A }, "delete from public.jobs where agency_id = $1", [B]);
    expect(upd.affectedRows).toBe(0);
    expect(del.affectedRows).toBe(0);
  });

  it("can work on its own rows", async () => {
    await as("agency_member", { agency_id: A }, "insert into public.candidates (agency_id, name) values ($1, 'New A')", [A]);
    const upd = await as("agency_member", { agency_id: A }, "update public.candidates set name = 'Ada L.' where name = 'Ada (agency A)'");
    expect(upd.affectedRows).toBe(1);
  });

  it("sees nothing without an agency claim", async () => {
    const { rows } = await as("agency_member", {}, "select * from public.candidates");
    expect(rows).toEqual([]);
  });

  it("gives browser-reachable roles nothing, so the REST API stays closed", async () => {
    for (const role of ["anon", "authenticated"]) {
      const { rows } = await as(role, { role, agency_id: A }, "select * from public.candidates");
      expect(rows).toEqual([]);
    }
  });

  it("leaves identity and secrets tables service-role only", async () => {
    for (const table of ["profiles", "api_keys"]) {
      await expect(as("agency_member", { agency_id: A }, `select * from public.${table}`)).rejects.toThrow(/permission denied/);
    }
    for (const table of ["profiles", "api_keys", "webhook_endpoints", "integration_connections", "member_tokens", "agency_audit_log", "research_signals"]) {
      expect(AGENCY_RLS_EXCLUDED.has(table)).toBe(true);
      expect(MIGRATION).toContain(`'${table}'`);
    }
  });

  it("fills in the agency on inserts that leave it out", async () => {
    const { rows } = await as("agency_member", { agency_id: A }, "insert into public.jobs (title) values ('No agency given') returning agency_id");
    expect(rows[0].agency_id).toBe(A);
    // Server-side (service role) inserts still get null, as before.
    await db.query("select set_config('request.jwt.claims', '', false)");
    const svc = await db.query("insert into public.jobs (title) values ('service insert') returning agency_id");
    expect(svc.rows[0].agency_id).toBeNull();
  });

  it("reports rows that would be hidden before switching on", async () => {
    await db.query("insert into public.candidates (agency_id, name) values (null, 'orphan')").catch(() => {});
    const { rows } = await db.query("select * from public.agency_rls_readiness() order by table_name");
    expect(rows.map((r) => r.table_name)).toEqual(["candidates", "jobs"]);
    expect(Number(rows.find((r) => r.table_name === "jobs").rows_without_agency)).toBeGreaterThan(0);
  });

  it("lets PostgREST's authenticator switch to agency_member", async () => {
    const { rows } = await db.query("select pg_has_role('authenticator', 'agency_member', 'member') as ok");
    expect(rows[0].ok).toBe(true);
  });
});
