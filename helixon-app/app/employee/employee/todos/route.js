// app/api/employee/todos/route.js
// GET  — list todos for the current employee
// POST — create | update | delete a todo

import { supabase } from "@/lib/supabase";
import { getEmployeeSession } from "@/lib/employee-auth";

async function requireSession() {
  const emp = await getEmployeeSession();
  if (!emp) return null;
  return emp;
}

export async function GET() {
  const emp = await requireSession();
  if (!emp) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("employee_todos")
    .select("*")
    .eq("employee_id", emp.id)
    .order("done", { ascending: true })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, todos: data || [] });
}

export async function POST(request) {
  const emp = await requireSession();
  if (!emp) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { action } = body;

    // ── Create ──────────────────────────────────────────────────────────────
    if (action === "create") {
      const { title, notes, priority, due_date } = body;
      if (!title?.trim()) return Response.json({ ok: false, error: "Title is required." }, { status: 400 });

      const { data, error } = await supabase
        .from("employee_todos")
        .insert({
          employee_id: emp.id,
          title: title.trim(),
          notes: notes || null,
          priority: priority || "medium",
          due_date: due_date || null,
        })
        .select()
        .single();

      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true, todo: data });
    }

    // ── Toggle done ──────────────────────────────────────────────────────────
    if (action === "toggle") {
      const { id, done } = body;
      if (!id) return Response.json({ ok: false, error: "id required." }, { status: 400 });

      const { error } = await supabase
        .from("employee_todos")
        .update({ done: !!done, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("employee_id", emp.id); // scoped to owner

      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true });
    }

    // ── Update ───────────────────────────────────────────────────────────────
    if (action === "update") {
      const { id, title, notes, priority, due_date } = body;
      if (!id) return Response.json({ ok: false, error: "id required." }, { status: 400 });

      const { error } = await supabase
        .from("employee_todos")
        .update({
          title: title?.trim(),
          notes: notes ?? null,
          priority: priority || "medium",
          due_date: due_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("employee_id", emp.id);

      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true });
    }

    // ── Delete ───────────────────────────────────────────────────────────────
    if (action === "delete") {
      const { id } = body;
      if (!id) return Response.json({ ok: false, error: "id required." }, { status: 400 });

      const { error } = await supabase
        .from("employee_todos")
        .delete()
        .eq("id", id)
        .eq("employee_id", emp.id);

      if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
      return Response.json({ ok: true });
    }

    return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}