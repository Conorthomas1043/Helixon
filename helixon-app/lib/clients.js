// Clients (the companies an agency recruits for) and their contacts - see
// supabase/migrations/20261001000000_clients_and_contacts.sql.
//
// jobs.client (name) and jobs.client_email are kept in step with
// jobs.client_id / jobs.contact_id here, so everything that already reads
// those text columns (lists, emails, exports, analytics) keeps working.

import { supabase } from "@/lib/supabase";
import { cleanEmail, cleanLine, cleanText, cleanUuid } from "@/lib/sanitize";

export const CLIENT_STATUSES = ["prospect", "active", "inactive"];
export const CLIENT_ACTIVITY_TYPES = {
  call_logged: "Call",
  email_logged: "Email",
  meeting_logged: "Meeting",
  note_added: "Note",
};

function numberOrNull(value, { min, max, integer = false }) {
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) return { error: true };
  return integer ? Math.round(n) : Math.round(n * 100) / 100;
}

// The editable client fields from a request body, as DB columns. Only keys
// present in the body are returned. { error } on invalid input.
export function cleanClientFields(body = {}, { requireName = false } = {}) {
  const out = {};
  if (body.name !== undefined || requireName) {
    const name = cleanLine(body.name, 200);
    if (!name) return { error: "The client needs a name." };
    out.name = name;
  }
  for (const [key, col, max] of [
    ["website", "website", 300],
    ["industry", "industry", 120],
    ["address", "address", 500],
  ]) {
    if (body[key] !== undefined) out[col] = cleanLine(body[key], max) || null;
  }
  if (body.termsNotes !== undefined) out.terms_notes = cleanText(body.termsNotes, { max: 2000 }) || null;
  if (body.status !== undefined) {
    if (!CLIENT_STATUSES.includes(body.status)) return { error: "Unknown status." };
    out.status = body.status;
  }
  if (body.ownerId !== undefined) out.owner_id = typeof body.ownerId === "string" && body.ownerId ? body.ownerId.slice(0, 64) : null;
  if (body.feePercent !== undefined) {
    const v = numberOrNull(body.feePercent, { min: 0, max: 100 });
    if (v?.error) return { error: "Fee must be a percentage between 0 and 100." };
    out.fee_percent = v;
  }
  if (body.paymentTermsDays !== undefined) {
    const v = numberOrNull(body.paymentTermsDays, { min: 0, max: 365, integer: true });
    if (v?.error) return { error: "Payment terms must be 0–365 days." };
    out.payment_terms_days = v;
  }
  if (body.rebateDays !== undefined) {
    const v = numberOrNull(body.rebateDays, { min: 0, max: 365, integer: true });
    if (v?.error) return { error: "Rebate period must be 0–365 days." };
    out.rebate_days = v;
  }
  return out;
}

export function cleanContactFields(body = {}, { requireName = false } = {}) {
  const out = {};
  if (body.name !== undefined || requireName) {
    const name = cleanLine(body.name, 200);
    if (!name) return { error: "The contact needs a name." };
    out.name = name;
  }
  if (body.jobTitle !== undefined) out.job_title = cleanLine(body.jobTitle, 200) || null;
  if (body.email !== undefined) {
    if (body.email === null || body.email === "") out.email = null;
    else {
      const email = cleanEmail(body.email);
      if (!email) return { error: "That email address doesn't look right." };
      out.email = email;
    }
  }
  if (body.phone !== undefined) out.phone = cleanLine(body.phone, 40) || null;
  if (body.notes !== undefined) out.notes = cleanText(body.notes, { max: 2000 }) || null;
  if (body.isPrimary !== undefined) out.is_primary = body.isPrimary === true;
  return out;
}

export function toClient(row) {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    industry: row.industry,
    address: row.address,
    status: row.status,
    feePercent: row.fee_percent == null ? null : Number(row.fee_percent),
    paymentTermsDays: row.payment_terms_days,
    rebateDays: row.rebate_days,
    termsNotes: row.terms_notes,
    ownerId: row.owner_id,
    customFields: row.custom_fields ?? {},
    nextAction: row.next_action?.label ? row.next_action : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toContact(row) {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    jobTitle: row.job_title,
    email: row.email,
    phone: row.phone,
    isPrimary: row.is_primary,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function loadClient(agencyId, rawId) {
  const id = cleanUuid(rawId);
  if (!id) return null;
  const { data } = await supabase.from("clients").select("*").eq("id", id).eq("agency_id", agencyId).maybeSingle();
  return data;
}

export async function logClientActivity(agencyId, clientId, type, actor, meta = null) {
  await supabase.from("client_activity").insert({ agency_id: agencyId, client_id: clientId, type, actor, meta });
}

// The agency's client called `name` (case-insensitive), created if there's
// none yet. Used wherever a job is given a client as free text - the Jobs
// form, and jobs created by screening a CV against a pasted description.
// Returns { id, name } or null.
export async function ensureClient(agencyId, rawName) {
  const name = cleanLine(rawName, 200);
  if (!agencyId || !name) return null;
  const { data: existing } = await supabase
    .from("clients")
    .select("id, name")
    .eq("agency_id", agencyId)
    .ilike("name", name.replace(/[\\%_]/g, "\\$&"))
    .limit(1)
    .maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await supabase.from("clients").insert({ agency_id: agencyId, name }).select("id, name").single();
  if (!error) return created;
  // Lost a race with another request creating the same client.
  const { data: again } = await supabase
    .from("clients")
    .select("id, name")
    .eq("agency_id", agencyId)
    .ilike("name", name.replace(/[\\%_]/g, "\\$&"))
    .limit(1)
    .maybeSingle();
  return again ?? null;
}

// Job columns for a client/contact choice, keeping the denormalised text
// columns in step. `clientId` wins over `clientName` (free text: found or
// created); an empty choice clears the client. Changing the client without
// naming a contact clears the contact, since it belonged to the old one. A
// contact must belong to the chosen client, and on its own sets the client.
// Returns { update } or { error }.
export async function jobClientColumns(agencyId, { clientId, clientName, contactId }) {
  const update = {};

  if (clientId !== undefined || clientName !== undefined) {
    let client = null;
    if (clientId) {
      const row = await loadClient(agencyId, clientId);
      if (!row) return { error: "That client wasn't found." };
      client = row;
    } else if (clientName) {
      client = await ensureClient(agencyId, clientName);
    }
    update.client_id = client?.id ?? null;
    // If the client record couldn't be made, still keep the name typed.
    update.client = client?.name ?? (clientName ? String(clientName).trim().slice(0, 200) || null : null);
    if (contactId === undefined) update.contact_id = null;
  }

  if (contactId !== undefined) {
    if (!contactId) {
      update.contact_id = null;
      return { update };
    }
    const id = cleanUuid(contactId);
    const { data: contact } = id
      ? await supabase.from("client_contacts").select("id, client_id, email").eq("id", id).eq("agency_id", agencyId).maybeSingle()
      : { data: null };
    if (!contact) return { error: "That contact wasn't found." };
    if ("client_id" in update && update.client_id !== contact.client_id) return { error: "That contact works for a different client." };
    if (!("client_id" in update)) {
      const row = await loadClient(agencyId, contact.client_id);
      update.client_id = row?.id ?? null;
      update.client = row?.name ?? null;
    }
    update.contact_id = contact.id;
    if (contact.email) update.client_email = contact.email;
  }

  return { update };
}
