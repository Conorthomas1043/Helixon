// lib/employee-todos.js
// Supabase-backed CRUD for the `employee_todos` table.
//
// IMPORTANT: this uses the service-role client (@/lib/supabase), which
// bypasses RLS entirely. Every read/update/delete below therefore filters
// on employee_id explicitly and unconditionally — that's the only thing
// standing between one employee and another employee's tasks. Never build
// a query here that trusts a bare todo `id` without also constraining
// employee_id, or it becomes an IDOR (one employee could read/edit/delete
// another's to-dos just by guessing/incrementing an id).

import { supabase } from "@/lib/supabase";

export async function getTodos(employeeId) {
  const { data, error } = await supabase
    .from("employee_todos")
    .select("*")
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[employee-todos] getTodos failed:", error.message);
    return [];
  }
  return data || [];
}

export async function addTodo(employeeId, { title, notes, priority, due_date }) {
  const { data, error } = await supabase
    .from("employee_todos")
    .insert({
      employee_id: employeeId,
      title: String(title).trim(),
      notes: notes || "",
      priority: priority || "medium",
      due_date: due_date || null,
      done: false,
    })
    .select()
    .single();

  if (error) {
    console.error("[employee-todos] addTodo failed:", error.message);
    return null;
  }
  return data;
}

export async function updateTodo(employeeId, id, updates) {
  const patch = { updated_at: new Date().toISOString() };
  for (const key of ["title", "notes", "priority", "due_date", "done"]) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }

  // .eq("employee_id", employeeId) here is load-bearing: without it, any
  // authenticated employee could update any other employee's todo by id.
  const { data, error } = await supabase
    .from("employee_todos")
    .update(patch)
    .eq("id", id)
    .eq("employee_id", employeeId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[employee-todos] updateTodo failed:", error.message);
    return null;
  }
  return data;
}

export async function deleteTodo(employeeId, id) {
  const { data, error } = await supabase
    .from("employee_todos")
    .delete()
    .eq("id", id)
    .eq("employee_id", employeeId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[employee-todos] deleteTodo failed:", error.message);
    return false;
  }
  return !!data;
}
