// lib/employee-shared-todos.js
// Supabase-backed CRUD for the `employee_shared_todos` table - a
// team-visible task list, distinct from each employee's private list in
// lib/employee-todos.js.
//
// Visibility model: every active employee can SEE every shared task (it's
// a team list). Only the creator or the assignee can edit/complete a task.
// Only the creator can delete one. Same caveat as employee-todos.js: this
// uses the service-role client, which bypasses RLS, so every
// update/delete below filters explicitly rather than relying on the
// database to enforce it.

import { supabase } from "@/lib/supabase";

const SELECT_WITH_NAMES =
  "*, creator:created_by(id,display_name,full_name,username), assignee:assigned_to(id,display_name,full_name,username)";

export async function getSharedTodos() {
  const { data, error } = await supabase
    .from("employee_shared_todos")
    .select(SELECT_WITH_NAMES)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[employee-shared-todos] getSharedTodos failed:", error.message);
    return [];
  }
  return data || [];
}

export async function addSharedTodo(employeeId, { title, notes, priority, due_date, assigned_to }) {
  const { data, error } = await supabase
    .from("employee_shared_todos")
    .insert({
      created_by: employeeId,
      assigned_to: assigned_to || null,
      title: String(title).trim(),
      notes: notes || "",
      priority: priority || "medium",
      due_date: due_date || null,
      done: false,
    })
    .select(SELECT_WITH_NAMES)
    .single();

  if (error) {
    console.error("[employee-shared-todos] addSharedTodo failed:", error.message);
    return null;
  }
  return data;
}

// Only the creator or assignee may edit/complete a shared task - enforced
// here with an .or() filter, same load-bearing role the .eq(employee_id)
// filter plays in employee-todos.js.
export async function updateSharedTodo(employeeId, id, updates) {
  const patch = { updated_at: new Date().toISOString() };
  for (const key of ["title", "notes", "priority", "due_date", "done", "assigned_to"]) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }

  const { data, error } = await supabase
    .from("employee_shared_todos")
    .update(patch)
    .eq("id", id)
    .or(`created_by.eq.${employeeId},assigned_to.eq.${employeeId}`)
    .select(SELECT_WITH_NAMES)
    .maybeSingle();

  if (error) {
    console.error("[employee-shared-todos] updateSharedTodo failed:", error.message);
    return null;
  }
  return data;
}

// Only the creator may delete - an assignee can complete a task but
// shouldn't be able to make it disappear from the team list.
export async function deleteSharedTodo(employeeId, id) {
  const { data, error } = await supabase
    .from("employee_shared_todos")
    .delete()
    .eq("id", id)
    .eq("created_by", employeeId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[employee-shared-todos] deleteSharedTodo failed:", error.message);
    return false;
  }
  return !!data;
}
