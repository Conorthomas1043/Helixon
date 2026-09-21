// lib/employee-calendar.js
// Shared team calendar - every active employee sees every event. The
// creator can edit/delete their own events (there's no natural
// "assignee" for a calendar event the way there is for a todo, so this
// doesn't reuse the creator-or-assignee model those use). Also builds the
// read-only ICS feed used for "subscribe by URL" in Google/Apple Calendar
// (app/api/employee/calendar/feed/[token]/route.js) and looks up which
// employee a feed token belongs to.

import crypto from "crypto";
import { supabase } from "@/lib/supabase";

const EVENT_SELECT = "*, creator:created_by(id,display_name,full_name,username)";

export async function getEvents({ from, to } = {}) {
  let query = supabase.from("employee_calendar_events").select(EVENT_SELECT).order("start_at", { ascending: true });
  if (from) query = query.gte("end_at", from);
  if (to) query = query.lte("start_at", to);

  const { data, error } = await query;
  if (error) {
    console.error("[employee-calendar] getEvents failed:", error.message);
    return [];
  }
  return data || [];
}

export async function addEvent(employeeId, { title, notes, location, start_at, end_at, all_day }) {
  const { data, error } = await supabase
    .from("employee_calendar_events")
    .insert({
      created_by: employeeId,
      title: String(title).trim(),
      notes: notes || "",
      location: location || "",
      start_at,
      end_at: end_at || start_at,
      all_day: !!all_day,
    })
    .select(EVENT_SELECT)
    .single();

  if (error) {
    console.error("[employee-calendar] addEvent failed:", error.message);
    return null;
  }
  return data;
}

export async function updateEvent(employeeId, id, updates) {
  const patch = { updated_at: new Date().toISOString() };
  for (const key of ["title", "notes", "location", "start_at", "end_at", "all_day"]) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }

  const { data, error } = await supabase
    .from("employee_calendar_events")
    .update(patch)
    .eq("id", id)
    .eq("created_by", employeeId)
    .select(EVENT_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[employee-calendar] updateEvent failed:", error.message);
    return null;
  }
  return data;
}

export async function deleteEvent(employeeId, id) {
  const { data, error } = await supabase
    .from("employee_calendar_events")
    .delete()
    .eq("id", id)
    .eq("created_by", employeeId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[employee-calendar] deleteEvent failed:", error.message);
    return false;
  }
  return !!data;
}

// ── Feed token (Google/Apple "subscribe by URL") ────────────────────────

export async function ensureFeedToken(employeeId) {
  const { data: existing } = await supabase
    .from("employees")
    .select("calendar_feed_token")
    .eq("id", employeeId)
    .maybeSingle();

  if (existing?.calendar_feed_token) return existing.calendar_feed_token;

  const token = crypto.randomBytes(24).toString("hex");
  const { error } = await supabase.from("employees").update({ calendar_feed_token: token }).eq("id", employeeId);
  if (error) {
    console.error("[employee-calendar] ensureFeedToken failed:", error.message);
    return null;
  }
  return token;
}

export async function regenerateFeedToken(employeeId) {
  const token = crypto.randomBytes(24).toString("hex");
  const { error } = await supabase.from("employees").update({ calendar_feed_token: token }).eq("id", employeeId);
  if (error) {
    console.error("[employee-calendar] regenerateFeedToken failed:", error.message);
    return null;
  }
  return token;
}

export async function findEmployeeByFeedToken(token) {
  if (!token) return null;
  const { data, error } = await supabase
    .from("employees")
    .select("id, is_active")
    .eq("calendar_feed_token", token)
    .maybeSingle();

  if (error || !data || data.is_active === false) return null;
  return data;
}

// ── ICS generation ───────────────────────────────────────────────────────
// A minimal but correct RFC 5545 writer - enough for Google Calendar and
// Apple Calendar's "subscribe by URL" import, which is all this feeds.
// Skips line-folding at 75 octets (technically required by the RFC for
// very long SUMMARY/DESCRIPTION values) since both Google and Apple parse
// unfolded lines fine in practice, and folding correctly needs to be
// UTF-8-octet-aware, not just character-aware - not worth the complexity
// for team-calendar-length text.

function icsEscape(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function icsDateTimeUTC(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function icsDate(iso) {
  return new Date(iso).toISOString().slice(0, 10).replace(/-/g, "");
}

export function buildIcsFeed(events) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Helixon//Shared Team Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Helixon Team Calendar",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.id}@helixon.co.uk`);
    lines.push(`DTSTAMP:${icsDateTimeUTC(ev.updated_at || ev.created_at)}`);
    if (ev.all_day) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(ev.start_at)}`);
      lines.push(`DTEND;VALUE=DATE:${icsDate(ev.end_at)}`);
    } else {
      lines.push(`DTSTART:${icsDateTimeUTC(ev.start_at)}`);
      lines.push(`DTEND:${icsDateTimeUTC(ev.end_at)}`);
    }
    lines.push(`SUMMARY:${icsEscape(ev.title)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${icsEscape(ev.notes)}`);
    if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
    lines.push(`CREATED:${icsDateTimeUTC(ev.created_at)}`);
    lines.push(`LAST-MODIFIED:${icsDateTimeUTC(ev.updated_at || ev.created_at)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
