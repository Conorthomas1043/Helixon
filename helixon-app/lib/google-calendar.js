// lib/google-calendar.js
// Two-way Google Calendar sync, scoped per employee: each employee
// authorizes their own Google account (OAuth2 authorization-code flow),
// and sync() then:
//   - pulls their Google events into the shared Helixon calendar, tagged
//     with google_event_id/google_owner_id so they're recognisable as
//     "theirs" and never duplicated on re-sync;
//   - pushes Helixon-native events THEY created (google_event_id still
//     null) out to their own Google Calendar, so something they organise
//     in Helixon shows up in their own calendar app too.
// Deliberately not "replicate every shared event into everyone's Google
// Calendar" - that would duplicate every team event across every
// connected employee's personal calendar, which is not what "connect my
// calendar" usually means.
//
// Needs GOOGLE_CALENDAR_CLIENT_ID/SECRET (a Google Cloud OAuth app you
// create - not something this code can provision). Every function here
// checks isConfigured() first and fails soft (returns a clear error, not
// a crash) when they're unset, so the rest of the app works today and
// this switches on the moment those env vars exist.

import { supabase } from "@/lib/supabase";

const SCOPE = "https://www.googleapis.com/auth/calendar";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const PAST_DAYS = 90;
const FUTURE_DAYS = 365;

export function isConfigured() {
  return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

function redirectUri() {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.helixon.co.uk").replace(/\/+$/, "");
  return `${origin}/api/employee/calendar/google/callback`;
}

export function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    // Forces Google to re-issue a refresh_token even for an account that
    // already granted access before - without this, reconnecting after a
    // disconnect can silently come back with no refresh_token at all.
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token exchange failed: HTTP ${response.status}`);
  }
  return response.json(); // { access_token, refresh_token, expires_in, ... }
}

async function refreshAccessToken(refreshToken) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error(`Google token refresh failed: HTTP ${response.status}`);
  }
  return response.json(); // { access_token, expires_in, ... } - no new refresh_token
}

export async function fetchGoogleEmail(accessToken) {
  try {
    const response = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return null;
    const data = await response.json();
    return data.email || null;
  } catch {
    return null;
  }
}

export async function saveConnection(employeeId, tokens) {
  const email = await fetchGoogleEmail(tokens.access_token);
  const { error } = await supabase.from("employee_google_calendar_tokens").upsert({
    employee_id: employeeId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    google_email: email,
    connected_at: new Date().toISOString(),
  });
  if (error) {
    console.error("[google-calendar] saveConnection failed:", error.message);
    return false;
  }
  return true;
}

export async function getConnection(employeeId) {
  const { data, error } = await supabase
    .from("employee_google_calendar_tokens")
    .select("employee_id, google_email, connected_at, last_synced_at, last_sync_error")
    .eq("employee_id", employeeId)
    .maybeSingle();
  if (error) {
    console.error("[google-calendar] getConnection failed:", error.message);
    return null;
  }
  return data;
}

export async function disconnect(employeeId) {
  const { error } = await supabase.from("employee_google_calendar_tokens").delete().eq("employee_id", employeeId);
  if (error) {
    console.error("[google-calendar] disconnect failed:", error.message);
    return false;
  }
  return true;
}

// Returns a live access token for this employee, refreshing (and
// persisting the refresh) if it's expired or about to be. Null if not
// connected.
async function getValidAccessToken(employeeId) {
  const { data: row, error } = await supabase
    .from("employee_google_calendar_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("employee_id", employeeId)
    .maybeSingle();

  if (error || !row) return null;

  const expiresSoon = new Date(row.expires_at).getTime() - Date.now() < 5 * 60 * 1000;
  if (!expiresSoon) return row.access_token;

  const refreshed = await refreshAccessToken(row.refresh_token);
  await supabase
    .from("employee_google_calendar_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    })
    .eq("employee_id", employeeId);

  return refreshed.access_token;
}

// ── Pull: Google events -> shared Helixon calendar ──────────────────────

async function pullFromGoogle(employeeId, accessToken) {
  const timeMin = new Date(Date.now() - PAST_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + FUTURE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    maxResults: "250",
    orderBy: "startTime",
  });

  const response = await fetch(`${CALENDAR_API}/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Google events.list failed: HTTP ${response.status}`);
  }

  const { items = [] } = await response.json();
  let pulled = 0;

  for (const item of items) {
    if (item.status === "cancelled") {
      await supabase
        .from("employee_calendar_events")
        .delete()
        .eq("google_owner_id", employeeId)
        .eq("google_event_id", item.id);
      continue;
    }

    const allDay = Boolean(item.start?.date && !item.start?.dateTime);
    const startAt = item.start?.dateTime || item.start?.date;
    const endAt = item.end?.dateTime || item.end?.date || startAt;
    if (!startAt) continue;

    const { error } = await supabase.from("employee_calendar_events").upsert(
      {
        created_by: employeeId,
        google_owner_id: employeeId,
        google_event_id: item.id,
        title: item.summary || "(No title)",
        notes: item.description || "",
        location: item.location || "",
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        all_day: allDay,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "google_owner_id,google_event_id" },
    );
    if (!error) pulled += 1;
  }

  return pulled;
}

// ── Push: Helixon-native events this employee created -> their Google ──

async function pushToGoogle(employeeId, accessToken) {
  const { data: unsynced, error } = await supabase
    .from("employee_calendar_events")
    .select("id, title, notes, location, start_at, end_at, all_day")
    .eq("created_by", employeeId)
    .is("google_event_id", null);

  if (error || !unsynced?.length) return 0;

  let pushed = 0;
  for (const ev of unsynced) {
    const body = ev.all_day
      ? {
          summary: ev.title,
          description: ev.notes || undefined,
          location: ev.location || undefined,
          start: { date: ev.start_at.slice(0, 10) },
          end: { date: ev.end_at.slice(0, 10) },
        }
      : {
          summary: ev.title,
          description: ev.notes || undefined,
          location: ev.location || undefined,
          start: { dateTime: ev.start_at },
          end: { dateTime: ev.end_at },
        };

    const response = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) continue;

    const created = await response.json();
    const { error: updateError } = await supabase
      .from("employee_calendar_events")
      .update({ google_event_id: created.id, google_owner_id: employeeId })
      .eq("id", ev.id);
    if (!updateError) pushed += 1;
  }

  return pushed;
}

export async function sync(employeeId) {
  if (!isConfigured()) {
    return { ok: false, error: "Google Calendar isn't configured on this deployment." };
  }

  const accessToken = await getValidAccessToken(employeeId);
  if (!accessToken) {
    return { ok: false, error: "Not connected." };
  }

  try {
    const [pulled, pushed] = [await pullFromGoogle(employeeId, accessToken), await pushToGoogle(employeeId, accessToken)];
    await supabase
      .from("employee_google_calendar_tokens")
      .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
      .eq("employee_id", employeeId);
    return { ok: true, pulled, pushed };
  } catch (error) {
    await supabase
      .from("employee_google_calendar_tokens")
      .update({ last_sync_error: error.message })
      .eq("employee_id", employeeId);
    return { ok: false, error: error.message || "Sync failed." };
  }
}
