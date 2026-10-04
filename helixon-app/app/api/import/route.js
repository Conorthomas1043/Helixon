import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { rateLimit } from "@/lib/ratelimit";
import { IMPORT_BATCH, IMPORT_TYPES, mapRow } from "@/lib/import-mapping";
import { getAgencyPrivacy, addMonths } from "@/lib/privacy-settings";
import { linkedInHandle } from "@/lib/candidate-duplicates";
import { ensureClient } from "@/lib/clients";
import { reportError } from "@/lib/report-error";

// POST { type, mapping, rows: [[cells]], firstRow, options? } - one batch
// (up to IMPORT_BATCH rows) of a CSV import from /dashboard/import. Every
// row is mapped and validated again here (lib/import-mapping.js); people,
// clients and contacts already on file are skipped rather than duplicated.
//
// options.talentPool (candidates): also save them to the talent pool.
// Answers { created, skipped, errors: [{ row, error }] } - row numbers are
// the spreadsheet's (firstRow is the batch's first data row).

export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!(await rateLimit(`import:${auth.userId}`, 120))) {
    return NextResponse.json({ error: "Too many import batches - try again in a while." }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  if (!IMPORT_TYPES[body.type]) return NextResponse.json({ error: "Unknown import type." }, { status: 400 });
  if (!Array.isArray(body.rows) || body.rows.length === 0) return NextResponse.json({ error: "No rows." }, { status: 400 });
  if (body.rows.length > IMPORT_BATCH) return NextResponse.json({ error: `Send at most ${IMPORT_BATCH} rows at a time.` }, { status: 400 });
  const mapping = {};
  for (const f of IMPORT_TYPES[body.type].fields) {
    const idx = body.mapping?.[f.key];
    if (Number.isInteger(idx) && idx >= 0 && idx < 200) mapping[f.key] = idx;
  }
  const firstRow = Number.isInteger(body.firstRow) ? body.firstRow : 2;

  const errors = [];
  const valid = [];
  body.rows.forEach((cells, i) => {
    if (!Array.isArray(cells)) return errors.push({ row: firstRow + i, error: "Malformed row" });
    const { record, errors: rowErrors } = mapRow(cells.map((c) => String(c ?? "")), mapping, body.type);
    if (rowErrors.length) errors.push({ row: firstRow + i, error: rowErrors.join(", ") });
    else valid.push({ row: firstRow + i, record });
  });

  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const ctx = { auth, actor, options: body.options || {} };
  const result =
    body.type === "candidates" ? await importCandidates(valid, ctx) : body.type === "clients" ? await importClients(valid, ctx) : await importJobs(valid, ctx);
  return NextResponse.json({ ...result, errors: [...errors, ...(result.errors || [])] });
}

async function importCandidates(items, { auth, actor, options }) {
  const emails = [...new Set(items.map((i) => i.record.email).filter(Boolean))];
  const handles = new Set(items.map((i) => linkedInHandle(i.record.linkedin)).filter(Boolean));
  const existingEmails = new Set();
  if (emails.length) {
    const { data } = await supabase.from("candidates").select("email").eq("agency_id", auth.agencyId).in("email", emails);
    for (const r of data ?? []) existingEmails.add(String(r.email).toLowerCase());
  }
  const existingHandles = new Set();
  if (handles.size) {
    const { data } = await supabase.from("candidates").select("linkedin").eq("agency_id", auth.agencyId).not("linkedin", "is", null).ilike("linkedin", "%linkedin.com/in/%").limit(20000);
    for (const r of data ?? []) {
      const h = linkedInHandle(r.linkedin);
      if (h && handles.has(h)) existingHandles.add(h);
    }
  }

  let poolExpires = null;
  if (options.talentPool) {
    const privacy = await getAgencyPrivacy(supabase, auth.agencyId);
    poolExpires = addMonths(new Date(), privacy.retentionMonths).toISOString();
  }

  const seen = new Set();
  const rows = [];
  const notes = [];
  let skipped = 0;
  const now = new Date().toISOString();
  for (const { record } of items) {
    const handle = linkedInHandle(record.linkedin);
    const key = record.email || (handle ? `li:${handle}` : null);
    if ((record.email && existingEmails.has(record.email)) || (handle && existingHandles.has(handle)) || (key && seen.has(key))) {
      skipped += 1;
      continue;
    }
    if (key) seen.add(key);
    rows.push({
      agency_id: auth.agencyId,
      user_id: auth.userId,
      recruiter_id: auth.userId,
      name: record.full_name,
      full_name: record.full_name,
      email: record.email,
      phone: record.phone,
      linkedin: record.linkedin,
      location: record.location,
      current_title: record.current_title,
      current_company: record.current_company,
      source: record.source || "agency_database",
      processing_status: "completed",
      extracted: {
        name: record.full_name,
        skills: record.skills,
        current_title: record.current_title,
        current_employer: record.current_company,
        location: record.location,
        imported: true,
      },
      last_activity_at: record.last_activity_at || now,
      ...(options.talentPool ? { talent_pool_at: now, talent_pool_by: actor, talent_pool_note: "Imported", talent_pool_expires_at: poolExpires } : {}),
    });
    notes.push(record.notes);
  }

  if (!rows.length) return { created: 0, skipped };
  const { data: created, error } = await supabase.from("candidates").insert(rows).select("id");
  if (error) {
    reportError("[import] Candidates insert failed:", error.message);
    return { created: 0, skipped, errors: [{ row: null, error: "This batch couldn't be saved." }] };
  }
  const ids = (created ?? []).map((c) => c.id);
  await supabase.from("candidate_activity").insert(ids.map((id) => ({ candidate_id: id, type: "imported", actor, meta: { note: "Imported from CSV" } })));
  const noteRows = ids
    .map((id, i) => (notes[i] ? { agency_id: auth.agencyId, candidate_id: id, note: notes[i], author_id: auth.userId, author_name: `${actor} (imported)` } : null))
    .filter(Boolean);
  if (noteRows.length) await supabase.from("candidate_notes").insert(noteRows);
  return { created: ids.length, skipped };
}

async function importClients(items, { auth }) {
  const { data: existingClients } = await supabase.from("clients").select("id, name").eq("agency_id", auth.agencyId).limit(10000);
  const byName = new Map((existingClients ?? []).map((c) => [c.name.trim().toLowerCase(), c.id]));
  const { data: existingContacts } = await supabase.from("client_contacts").select("client_id, email, name").eq("agency_id", auth.agencyId).limit(20000);
  const contactKeys = new Set((existingContacts ?? []).map((c) => `${c.client_id}:${(c.email || c.name || "").toLowerCase()}`));

  let created = 0;
  let contacts = 0;
  let skipped = 0;
  const errors = [];
  for (const { row, record } of items) {
    const key = record.name.trim().toLowerCase();
    let clientId = byName.get(key);
    if (!clientId) {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          agency_id: auth.agencyId,
          name: record.name,
          industry: record.industry,
          website: record.website,
          address: record.address,
          fee_percent: record.fee_percent,
          payment_terms_days: record.payment_terms_days,
          owner_id: auth.userId,
        })
        .select("id")
        .single();
      if (error) {
        errors.push({ row, error: "Couldn't save this client" });
        continue;
      }
      clientId = data.id;
      byName.set(key, clientId);
      created += 1;
    } else if (!record.contact_name && !record.contact_email) {
      skipped += 1;
    }
    if (record.contact_name || record.contact_email) {
      const ck = `${clientId}:${(record.contact_email || record.contact_name).toLowerCase()}`;
      if (contactKeys.has(ck)) continue;
      const { error } = await supabase.from("client_contacts").insert({
        agency_id: auth.agencyId,
        client_id: clientId,
        name: record.contact_name || record.contact_email,
        job_title: record.contact_title,
        email: record.contact_email,
        phone: record.contact_phone,
        is_primary: ![...contactKeys].some((k) => k.startsWith(`${clientId}:`)),
      });
      if (error) errors.push({ row, error: "Couldn't save the contact" });
      else {
        contactKeys.add(ck);
        contacts += 1;
      }
    }
  }
  return { created, contacts, skipped, errors };
}

async function importJobs(items, { auth }) {
  const { data: existing } = await supabase.from("jobs").select("title, client").eq("agency_id", auth.agencyId).limit(20000);
  const keys = new Set((existing ?? []).map((j) => `${(j.title || "").toLowerCase()}|${(j.client || "").toLowerCase()}`));
  const clients = new Map();
  let created = 0;
  let skipped = 0;
  const errors = [];
  for (const { row, record } of items) {
    const key = `${record.title.toLowerCase()}|${(record.client || "").toLowerCase()}`;
    if (keys.has(key)) {
      skipped += 1;
      continue;
    }
    let client = null;
    if (record.client) {
      const ck = record.client.toLowerCase();
      if (!clients.has(ck)) clients.set(ck, await ensureClient(auth.agencyId, record.client));
      client = clients.get(ck);
    }
    const { error } = await supabase.from("jobs").insert({
      agency_id: auth.agencyId,
      user_id: auth.userId,
      title: record.title,
      client: client?.name ?? record.client,
      client_id: client?.id ?? null,
      location: record.location,
      salary_range: record.salary_range,
      employment_type: record.employment_type,
      seniority: record.seniority,
      required_skills: record.required_skills,
      job_text: record.job_text,
      status: record.status,
      is_saved: true,
    });
    if (error) errors.push({ row, error: "Couldn't save this job" });
    else {
      keys.add(key);
      created += 1;
    }
  }
  return { created, skipped, errors };
}
