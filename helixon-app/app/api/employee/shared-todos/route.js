// app/api/employee/shared-todos/route.js
// Team-visible task list - see lib/employee-shared-todos.js.
//
// Previously this route authenticated via a Supabase Auth Bearer token and
// looked the caller up by `employees.email` - but employees don't have
// Supabase Auth accounts or an email column; they log in through
// lib/employee-auth.js's own username/password + cookie-session system
// (see lib/session.js). That mismatch meant this route could never
// actually be called by the employee dashboard: it 403'd unconditionally.
// Rewritten to use the same getCurrentEmployeeId() session check every
// other /api/employee/* route uses.

import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import {
  getSharedTodos,
  addSharedTodo,
  updateSharedTodo,
  deleteSharedTodo,
} from "@/lib/employee-shared-todos";

export async function GET() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, todos: await getSharedTodos() });
}

export async function POST(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action === "create") {
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
    }
    const todo = await addSharedTodo(employeeId, body);
    if (!todo) return NextResponse.json({ ok: false, error: "Could not create task." }, { status: 500 });
    return NextResponse.json({ ok: true, todo });
  }

  if (action === "update") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    if (body.title !== undefined && !body.title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
    }
    const todo = await updateSharedTodo(employeeId, body.id, {
      title: body.title,
      notes: body.notes,
      priority: body.priority,
      due_date: body.due_date,
      assigned_to: body.assigned_to,
    });
    if (!todo) return NextResponse.json({ ok: false, error: "Task not found or not permitted." }, { status: 404 });
    return NextResponse.json({ ok: true, todo });
  }

  if (action === "toggle") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const todo = await updateSharedTodo(employeeId, body.id, { done: !!body.done });
    if (!todo) return NextResponse.json({ ok: false, error: "Task not found or not permitted." }, { status: 404 });
    return NextResponse.json({ ok: true, todo });
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const removed = await deleteSharedTodo(employeeId, body.id);
    if (!removed) return NextResponse.json({ ok: false, error: "Task not found or you're not the creator." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
