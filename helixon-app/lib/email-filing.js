// Files an email on the timelines of the candidates and client contacts it
// was to or from: an email_messages row each, and a timeline entry. Used by
// BCC logging (app/api/webhooks/resend-inbound) and mailbox sync
// (lib/integrations/mailbox.js).
//
//   parties      the addresses to match (lower-case)
//   text         the body, or an async function giving it - only called
//                when someone matched, so unmatched mail is never fetched
//   directionFor (address) => "in" | "out" for a candidate's row
//   activity     (direction) => { type, note } for the timeline
//
// Resolves { duplicate } | { candidates, clients } (counts filed).

import "server-only";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/candidate-activity";
import { logClientActivity } from "@/lib/clients";

const MAX_BODY = 50000;
const CHUNK = 100;

async function matchPeople(agencyId, parties) {
  const candidates = [];
  const contacts = [];
  for (let i = 0; i < parties.length; i += CHUNK) {
    const chunk = parties.slice(i, i + CHUNK);
    const [c, k] = await Promise.all([
      supabase.from("candidates").select("id, email, created_at").eq("agency_id", agencyId).in("email", chunk).order("created_at", { ascending: false }).limit(200),
      supabase.from("client_contacts").select("id, client_id, email").eq("agency_id", agencyId).in("email", chunk).limit(100),
    ]);
    candidates.push(...(c.data ?? []));
    contacts.push(...(k.data ?? []));
  }
  // One pipeline row per person: their most recent.
  const latestByEmail = new Map();
  for (const c of candidates) {
    const key = String(c.email || "").toLowerCase();
    if (!latestByEmail.has(key)) latestByEmail.set(key, c);
  }
  return {
    latestByEmail,
    clientIds: [...new Set(contacts.map((c) => c.client_id))],
    contactEmails: contacts.map((c) => String(c.email || "").toLowerCase()),
  };
}

// Which of these addresses belong to a candidate or client contact.
export async function knownAddresses(agencyId, addresses) {
  const unique = [...new Set(addresses.map((a) => String(a).toLowerCase()))];
  const { latestByEmail, contactEmails } = await matchPeople(agencyId, unique);
  return new Set([...latestByEmail.keys(), ...contactEmails]);
}

export async function fileEmail({ agencyId, userId, providerId, fromLabel, from, to = [], cc = [], subject, text, parties, directionFor, activity, at = null }) {
  if (providerId) {
    const { data: seen } = await supabase.from("email_messages").select("id").eq("agency_id", agencyId).eq("provider_id", providerId).limit(1);
    if (seen?.length) return { duplicate: true };
  }
  const { latestByEmail, clientIds } = await matchPeople(agencyId, parties);
  if (!latestByEmail.size && !clientIds.length) return { candidates: 0, clients: 0 };

  const body = String((typeof text === "function" ? await text() : text) || "").slice(0, MAX_BODY);
  const base = {
    agency_id: agencyId,
    from_email: String(fromLabel || from || "").slice(0, 320),
    to_email: [...to, ...cc].join(", ").slice(0, 2000),
    subject: String(subject || "").slice(0, 500),
    body_text: body,
    provider_id: providerId || null,
    sent_by: userId || null,
    ...(at ? { created_at: at } : {}),
  };
  const actor = String(fromLabel || from || "Email").slice(0, 200);
  for (const [email, c] of latestByEmail) {
    const dir = directionFor(email);
    await supabase.from("email_messages").insert({ ...base, candidate_id: c.id, direction: dir });
    const a = activity(dir);
    await logActivity(supabase, c.id, a.type, actor, { note: a.note });
  }
  for (const clientId of clientIds) {
    await supabase.from("email_messages").insert({ ...base, client_id: clientId, direction: "out" });
    await logClientActivity(agencyId, clientId, "email_logged", actor, { note: activity("out").note });
  }
  return { candidates: latestByEmail.size, clients: clientIds.length };
}
