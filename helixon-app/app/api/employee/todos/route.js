import { NextResponse } from "next/server";
import { employeeAccess } from "@/lib/employee/session";
import { getTodos, addTodo, updateTodo, deleteTodo } from "@/lib/employee/todos";
import { date, fields, flag, id, str } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

const TodoInput = fields({
  action: str(20),
  id,
  title: str(400),
  notes: str(8000),
  priority: str(20),
  due_date: date,
  done: flag,
});

export async function GET() {
  const { employeeId, forbidden } = await employeeAccess("tasks", "view");
  if (forbidden) return forbidden;
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, todos: await getTodos(employeeId) });
}

export async function POST(request) {
  const { employeeId, forbidden } = await employeeAccess("tasks", "edit");
  if (forbidden) return forbidden;
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const parsedBody = await parseBody(request, TodoInput, { allowEmpty: true });
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.body;
  const { action } = body;

  if (action === "create") {
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
    }
    const todo = await addTodo(employeeId, body);
    if (!todo) return NextResponse.json({ ok: false, error: "Could not create task." }, { status: 500 });
    return NextResponse.json({ ok: true, todo });
  }

  if (action === "update") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    if (body.title !== undefined && !body.title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
    }
    const todo = await updateTodo(employeeId, body.id, {
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
    const todo = await updateTodo(employeeId, body.id, { done: !!body.done });
    if (!todo) return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
    return NextResponse.json({ ok: true, todo });
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const removed = await deleteTodo(employeeId, body.id);
    if (!removed) return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
