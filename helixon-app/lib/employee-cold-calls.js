// lib/employee-cold-calls.js
// Cold call log for the sales team - who was called, the outcome, and an
// optional follow-up date. Visibility model differs from shared
// todos/goals: everyone can see every call (it's team activity, useful as
// a leaderboard), but a call can only be edited or deleted by the
// employee who logged it - nobody else was on that call.
// Service-role client, so every write below filters explicitly rather
// than relying on RLS to enforce it (same caveat as the other employee-*
// lib files).

import { supabase } from "@/lib/supabase";

export const OUTCOMES = [
  "no_answer",
  "voicemail",
  "gatekeeper",
  "not_interested",
  "callback_requested",
  "interested",
  "meeting_booked",
  "wrong_number",
];

const CALL_SELECT = "*, caller:employee_id(id,display_name,full_name,username)";

export async function getColdCalls({ from, employeeId } = {}) {
  let query = supabase
    .from("employee_cold_calls")
    .select(CALL_SELECT)
    .order("called_at", { ascending: false });

  if (from) query = query.gte("called_at", from);
  if (employeeId) query = query.eq("employee_id", employeeId);

  const { data, error } = await query;
  if (error) {
    console.error("[employee-cold-calls] getColdCalls failed:", error.message);
    return [];
  }
  return data || [];
}

export async function addColdCall(employeeId, { contact_name, company, phone, outcome, notes, follow_up_at, called_at }) {
  const { data, error } = await supabase
    .from("employee_cold_calls")
    .insert({
      employee_id: employeeId,
      contact_name: contact_name || null,
      company: company || null,
      phone: phone || null,
      outcome: outcome || "no_answer",
      notes: notes || "",
      follow_up_at: follow_up_at || null,
      called_at: called_at || new Date().toISOString(),
    })
    .select(CALL_SELECT)
    .single();

  if (error) {
    console.error("[employee-cold-calls] addColdCall failed:", error.message);
    return null;
  }
  return data;
}

export async function updateColdCall(employeeId, id, updates) {
  const patch = { updated_at: new Date().toISOString() };
  for (const key of ["contact_name", "company", "phone", "outcome", "notes", "follow_up_at", "called_at"]) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }

  const { data, error } = await supabase
    .from("employee_cold_calls")
    .update(patch)
    .eq("id", id)
    .eq("employee_id", employeeId)
    .select(CALL_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[employee-cold-calls] updateColdCall failed:", error.message);
    return null;
  }
  return data;
}

export async function deleteColdCall(employeeId, id) {
  const { data, error } = await supabase
    .from("employee_cold_calls")
    .delete()
    .eq("id", id)
    .eq("employee_id", employeeId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[employee-cold-calls] deleteColdCall failed:", error.message);
    return false;
  }
  return !!data;
}

// Per-employee call counts for today and this week (Mon-Sun), plus an
// outcome breakdown for the same week - the "sales team to track" ask is
// as much about a shared leaderboard as it is about logging individual
// calls, so this pairs with the raw list rather than replacing it.
export async function getColdCallStats() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfWeek = new Date(now);
  const day = (startOfWeek.getDay() + 6) % 7; // Monday = 0
  startOfWeek.setDate(startOfWeek.getDate() - day);
  startOfWeek.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("employee_cold_calls")
    .select("employee_id, outcome, called_at, caller:employee_id(id,display_name,full_name)")
    .gte("called_at", startOfWeek.toISOString());

  if (error) {
    console.error("[employee-cold-calls] getColdCallStats failed:", error.message);
    return { byEmployee: [], byOutcomeThisWeek: {} };
  }

  const byEmployee = new Map();
  const byOutcomeThisWeek = {};

  for (const row of data || []) {
    const id = row.employee_id;
    if (!byEmployee.has(id)) {
      byEmployee.set(id, {
        employeeId: id,
        name: row.caller?.full_name || row.caller?.display_name || "Unknown",
        today: 0,
        thisWeek: 0,
      });
    }
    const entry = byEmployee.get(id);
    entry.thisWeek += 1;
    if (new Date(row.called_at) >= startOfToday) entry.today += 1;

    byOutcomeThisWeek[row.outcome] = (byOutcomeThisWeek[row.outcome] || 0) + 1;
  }

  return {
    byEmployee: [...byEmployee.values()].sort((a, b) => b.thisWeek - a.thisWeek),
    byOutcomeThisWeek,
  };
}
