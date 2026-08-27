import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { getTodos, addTodo, updateTodo, deleteTodo } from "@/lib/employee-store";

export async function GET() {
  const employeeId = getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, todos: getTodos(employeeId) });
}

export async function POST(request) {
  const employeeId = getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action === "create") {
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
    }
    const todo = addTodo(employeeId, body);
    return NextResponse.json({ ok: true, todo });
  }

  if (action === "update") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    if (body.title !== undefined && !body.title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
    }
    const todo = updateTodo(employeeId, body.id, {
      title: body.title,
      notes: body.notes,
      priority: body.priority,
      due_date: body.due_date,
    });
    if (!todo) return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
    return NextResponse.json({ ok: true, todo });
  }

  if (action === "toggle") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const todo = updateTodo(employeeId, body.id, { done: !!body.done });
    if (!todo) return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
    return NextResponse.json({ ok: true, todo });
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const removed = deleteTodo(employeeId, body.id);
    if (!removed) return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
