// app/api/employee/goals/route.js
// Shared team goals - see lib/employee-goals.js for the visibility/edit
// model (everyone sees every goal; creator or assignee can edit; only
// the creator can delete). Micro-goal (checklist item) actions live at
// app/api/employee/goals/items/route.js.

import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { getGoals, addGoal, updateGoal, deleteGoal } from "@/lib/employee-goals";

const VALID_STATUSES = new Set(["not_started", "in_progress", "blocked", "done"]);

export async function GET() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, goals: await getGoals() });
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
    const goal = await addGoal(employeeId, body);
    if (!goal) return NextResponse.json({ ok: false, error: "Could not create goal." }, { status: 500 });
    return NextResponse.json({ ok: true, goal });
  }

  if (action === "update") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    if (body.title !== undefined && !body.title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
    }
    if (body.status !== undefined && !VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
    }
    const goal = await updateGoal(employeeId, body.id, {
      title: body.title,
      notes: body.notes,
      status: body.status,
      deadline: body.deadline,
      assigned_to: body.assigned_to,
    });
    if (!goal) return NextResponse.json({ ok: false, error: "Goal not found or not permitted." }, { status: 404 });
    return NextResponse.json({ ok: true, goal });
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const removed = await deleteGoal(employeeId, body.id);
    if (!removed) return NextResponse.json({ ok: false, error: "Goal not found or you're not the creator." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
