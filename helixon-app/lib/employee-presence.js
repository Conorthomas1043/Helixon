// lib/employee-presence.js
// Online/busy/offline status + "signed in for" duration, shown to the
// whole team (app/employee/_shared/TeamPresencePanel.jsx).
//
// "online" is never written to the database - only "busy" is a real
// manual state, everything else is derived at read time from how recent
// presence_updated_at is. That's deliberate: a browser tab that crashes,
// loses network, or has its laptop lid shut never gets a chance to tell
// the server it's gone, so anything that stored "online" as a persisted
// flag would show people online forever unless something else explicitly
// marked them offline. Deriving it from staleness means a closed tab
// silently becomes "offline" within one missed heartbeat window with no
// disconnect handler required.
import { supabase } from "@/lib/supabase";

// Slightly more than 2x the client heartbeat interval (see
// app/employee/_shared/useHeartbeat.js), so one missed beat (a slow
// network blip) doesn't flicker someone to offline and back.
const ONLINE_WINDOW_MS = 3 * 60 * 1000;

function computeStatus(presenceStatus, presenceUpdatedAt) {
  const isRecent = presenceUpdatedAt
    ? Date.now() - new Date(presenceUpdatedAt).getTime() < ONLINE_WINDOW_MS
    : false;
  if (!isRecent) return "offline";
  return presenceStatus === "busy" ? "busy" : "online";
}

export async function recordHeartbeat(employeeId) {
  const { error } = await supabase
    .from("employees")
    .update({ presence_updated_at: new Date().toISOString() })
    .eq("id", employeeId);
  if (error) console.error("[employee-presence] heartbeat failed:", error.message);
  return !error;
}

export async function setBusy(employeeId, busy) {
  // Toggling busy off doesn't need to know anything about a prior
  // state - "offline" here just means "no manual override", and
  // computeStatus() will still show "online" for it since this call
  // itself counts as activity (presence_updated_at is refreshed too).
  const { error } = await supabase
    .from("employees")
    .update({ presence_status: busy ? "busy" : "offline", presence_updated_at: new Date().toISOString() })
    .eq("id", employeeId);
  if (error) console.error("[employee-presence] setBusy failed:", error.message);
  return !error;
}

// Whole-team snapshot: every active employee's current status, plus how
// long the online/busy ones have been signed in (their most recent
// still-valid session's created_at).
export async function getTeamPresence() {
  const [{ data: employees, error: empError }, { data: sessions, error: sessError }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, username, display_name, full_name, presence_status, presence_updated_at")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("employee_sessions")
      .select("employee_id, created_at, expires_at")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  if (empError) {
    console.error("[employee-presence] getTeamPresence employees failed:", empError.message);
    return [];
  }
  if (sessError) {
    console.error("[employee-presence] getTeamPresence sessions failed:", sessError.message);
  }

  // sessions is ordered newest-first, so the first row seen per employee
  // is their most recent still-valid session - no separate aggregation
  // query needed for something this small (a handful of staff accounts).
  const latestSessionByEmployee = new Map();
  for (const s of sessions || []) {
    if (!latestSessionByEmployee.has(s.employee_id)) {
      latestSessionByEmployee.set(s.employee_id, s);
    }
  }

  return (employees || []).map((e) => {
    const status = computeStatus(e.presence_status, e.presence_updated_at);
    const session = latestSessionByEmployee.get(e.id);
    return {
      id: e.id,
      name: e.full_name || e.display_name || e.username,
      status,
      signedInSince: status !== "offline" ? session?.created_at || null : null,
    };
  });
}
