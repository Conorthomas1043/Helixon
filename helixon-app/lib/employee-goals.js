// lib/employee-goals.js
// Shared team goals with a "micro-goal" checklist under each one - visible
// to every active employee, same model as lib/employee-shared-todos.js:
// only the creator or assignee can edit a goal (or its checklist), only
// the creator can delete it. Service-role client, so every query below
// filters explicitly rather than relying on RLS to enforce it.

import { supabase } from "@/lib/supabase";

const GOAL_SELECT =
  "*, creator:created_by(id,display_name,full_name,username), assignee:assigned_to(id,display_name,full_name,username), items:employee_goal_items(id,title,done,position,created_at)";

function sortItems(goal) {
  if (!goal?.items) return goal;
  return { ...goal, items: [...goal.items].sort((a, b) => a.position - b.position || new Date(a.created_at) - new Date(b.created_at)) };
}

// Not done first (blocked/in-progress ahead of not-started - both need
// more attention than something not yet picked up), then soonest
// deadline, then newest. Postgrest's .order() only takes a column, not a
// CASE expression, so the status rank is applied client-side after the
// fetch rather than in SQL - fine at the size a staff goals list stays at.
const STATUS_RANK = { blocked: 0, in_progress: 1, not_started: 2, done: 3 };

export async function getGoals() {
  const { data, error } = await supabase
    .from("employee_goals")
    .select(GOAL_SELECT)
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[employee-goals] getGoals failed:", error.message);
    return [];
  }

  return (data || [])
    .map(sortItems)
    .sort((a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));
}

async function canWrite(employeeId, goalId) {
  const { data, error } = await supabase
    .from("employee_goals")
    .select("created_by, assigned_to")
    .eq("id", goalId)
    .maybeSingle();
  if (error || !data) return false;
  return data.created_by === employeeId || data.assigned_to === employeeId;
}

export async function addGoal(employeeId, { title, notes, deadline, assigned_to }) {
  const { data, error } = await supabase
    .from("employee_goals")
    .insert({
      created_by: employeeId,
      assigned_to: assigned_to || null,
      title: String(title).trim(),
      notes: notes || "",
      deadline: deadline || null,
      status: "not_started",
    })
    .select(GOAL_SELECT)
    .single();

  if (error) {
    console.error("[employee-goals] addGoal failed:", error.message);
    return null;
  }
  return sortItems(data);
}

export async function updateGoal(employeeId, id, updates) {
  if (!(await canWrite(employeeId, id))) return null;

  const patch = { updated_at: new Date().toISOString() };
  for (const key of ["title", "notes", "status", "deadline", "assigned_to"]) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }

  const { data, error } = await supabase
    .from("employee_goals")
    .update(patch)
    .eq("id", id)
    .select(GOAL_SELECT)
    .maybeSingle();

  if (error) {
    console.error("[employee-goals] updateGoal failed:", error.message);
    return null;
  }
  return data ? sortItems(data) : null;
}

// Only the creator may delete - same reasoning as employee_shared_todos:
// an assignee can drive the goal to done, but shouldn't be able to make
// the whole team's goal disappear.
export async function deleteGoal(employeeId, id) {
  const { data, error } = await supabase
    .from("employee_goals")
    .delete()
    .eq("id", id)
    .eq("created_by", employeeId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[employee-goals] deleteGoal failed:", error.message);
    return false;
  }
  return !!data;
}

// ── Micro-goals (the checklist under one goal) ──────────────────────────

export async function addGoalItem(employeeId, goalId, title) {
  if (!(await canWrite(employeeId, goalId))) return null;

  const { count } = await supabase
    .from("employee_goal_items")
    .select("id", { count: "exact", head: true })
    .eq("goal_id", goalId);

  const { data, error } = await supabase
    .from("employee_goal_items")
    .insert({ goal_id: goalId, title: String(title).trim(), position: count || 0 })
    .select("id,title,done,position,created_at")
    .single();

  if (error) {
    console.error("[employee-goals] addGoalItem failed:", error.message);
    return null;
  }
  return data;
}

export async function toggleGoalItem(employeeId, goalId, itemId, done) {
  if (!(await canWrite(employeeId, goalId))) return null;

  const { data, error } = await supabase
    .from("employee_goal_items")
    .update({ done })
    .eq("id", itemId)
    .eq("goal_id", goalId)
    .select("id,title,done,position,created_at")
    .maybeSingle();

  if (error) {
    console.error("[employee-goals] toggleGoalItem failed:", error.message);
    return null;
  }
  return data;
}

export async function deleteGoalItem(employeeId, goalId, itemId) {
  if (!(await canWrite(employeeId, goalId))) return false;

  const { data, error } = await supabase
    .from("employee_goal_items")
    .delete()
    .eq("id", itemId)
    .eq("goal_id", goalId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[employee-goals] deleteGoalItem failed:", error.message);
    return false;
  }
  return !!data;
}
