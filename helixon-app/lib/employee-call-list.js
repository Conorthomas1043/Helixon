// lib/employee-call-list.js
// Shared "who to call" list for cold calls, filled from a CSV import (see
// lib/csv.js and supabase/migrations/*_employee_call_list.sql).
//
// Model: everyone sees every row with its number. Claiming a row marks it
// as "being called by me" so two people don't ring the same contact; any
// employee can take over a claim that's gone stale (CLAIM_TTL_MS). Logging a
// cold call against a row marks it done. Only the person who imported a row
// can delete it outright; anyone can skip it.
// Service-role client, so every write filters explicitly (same caveat as the
// other employee-* lib files).

import "server-only";
import { supabase } from "@/lib/supabase";
import { phoneKey } from "@/lib/csv";
import { reportError } from "@/lib/report-error";

export const MAX_IMPORT_ROWS = 2000;
const CLAIM_TTL_MS = 30 * 60 * 1000;

const PERSON = "id,display_name,full_name";
const ROW_SELECT = [
  "*",
  `claimer:employees!employee_call_list_claimed_by_fkey(${PERSON})`,
  `completer:employees!employee_call_list_completed_by_fkey(${PERSON})`,
  `uploader:employees!employee_call_list_uploaded_by_fkey(${PERSON})`,
].join(",");

function clean(value, max) {
  const s = typeof value === "string" ? value.trim() : "";
  return s ? s.slice(0, max) : null;
}

// Pending rows first (oldest import first, so the list is worked top to
// bottom), then the most recent completed/skipped ones for context.
export async function getCallList({ doneLimit = 50 } = {}) {
  const [pending, done] = await Promise.all([
    supabase.from("employee_call_list").select(ROW_SELECT).eq("status", "pending").order("created_at", { ascending: true }).limit(MAX_IMPORT_ROWS),
    supabase.from("employee_call_list").select(ROW_SELECT).neq("status", "pending").order("completed_at", { ascending: false }).limit(doneLimit),
  ]);
  if (pending.error || done.error) {
    reportError("[employee-call-list] getCallList failed:", (pending.error || done.error).message);
    return null;
  }
  return { pending: pending.data || [], done: done.data || [] };
}

// Inserts contacts, skipping any whose number is already on the pending list.
export async function importContacts(employeeId, contacts, batchLabel) {
  const rows = (Array.isArray(contacts) ? contacts : [])
    .slice(0, MAX_IMPORT_ROWS)
    .map((c) => ({
      contact_name: clean(c?.contact_name, 120),
      company: clean(c?.company, 120),
      phone: clean(c?.phone, 40),
      email: clean(c?.email, 160),
      notes: clean(c?.notes, 500),
    }))
    .filter((r) => r.phone && phoneKey(r.phone));

  if (!rows.length) return { inserted: 0, alreadyListed: 0 };

  const { data: existing, error: existingError } = await supabase
    .from("employee_call_list")
    .select("phone")
    .eq("status", "pending")
    .limit(10000);
  if (existingError) throw new Error(existingError.message);

  const listed = new Set((existing || []).map((r) => phoneKey(r.phone)));
  const label = clean(batchLabel, 120);
  const fresh = rows.filter((r) => !listed.has(phoneKey(r.phone)));

  if (fresh.length) {
    const { error } = await supabase
      .from("employee_call_list")
      .insert(fresh.map((r) => ({ ...r, batch_label: label, uploaded_by: employeeId })));
    if (error) throw new Error(error.message);
  }
  return { inserted: fresh.length, alreadyListed: rows.length - fresh.length };
}

// Claim a pending row. Fails if someone else holds a claim younger than the TTL.
export async function claimRow(employeeId, id) {
  const staleBefore = new Date(Date.now() - CLAIM_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from("employee_call_list")
    .update({ claimed_by: employeeId, claimed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending")
    .or(`claimed_by.is.null,claimed_by.eq.${employeeId},claimed_at.lt.${staleBefore}`)
    .select(ROW_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function releaseRow(employeeId, id) {
  const { data, error } = await supabase
    .from("employee_call_list")
    .update({ claimed_by: null, claimed_at: null })
    .eq("id", id)
    .eq("claimed_by", employeeId)
    .select(ROW_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Marks a row done (optionally linking the logged call) or skipped.
export async function finishRow(employeeId, id, { status = "done", coldCallId = null } = {}) {
  const { data, error } = await supabase
    .from("employee_call_list")
    .update({
      status,
      cold_call_id: coldCallId,
      completed_by: employeeId,
      completed_at: new Date().toISOString(),
      claimed_by: null,
      claimed_at: null,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select(ROW_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Puts a done/skipped row back on the list.
export async function reopenRow(id) {
  const { data, error } = await supabase
    .from("employee_call_list")
    .update({ status: "pending", completed_by: null, completed_at: null, cold_call_id: null })
    .eq("id", id)
    .neq("status", "pending")
    .select(ROW_SELECT)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteRow(employeeId, id) {
  const { data, error } = await supabase
    .from("employee_call_list")
    .delete()
    .eq("id", id)
    .eq("uploaded_by", employeeId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}
