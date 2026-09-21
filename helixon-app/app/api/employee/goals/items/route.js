// app/api/employee/goals/items/route.js
// The micro-goal checklist under one goal. Same edit permission as the
// parent goal (creator or assignee only) - enforced in
// lib/employee-goals.js's canWrite(), not here.

import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { addGoalItem, toggleGoalItem, deleteGoalItem } from "@/lib/employee-goals";

export async function POST(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { action, goalId } = body;

  if (!goalId) return NextResponse.json({ ok: false, error: "Missing goalId." }, { status: 400 });

  if (action === "create") {
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
    }
    const item = await addGoalItem(employeeId, goalId, body.title);
    if (!item) return NextResponse.json({ ok: false, error: "Could not add micro-goal." }, { status: 403 });
    return NextResponse.json({ ok: true, item });
  }

  if (action === "toggle") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const item = await toggleGoalItem(employeeId, goalId, body.id, !!body.done);
    if (!item) return NextResponse.json({ ok: false, error: "Micro-goal not found or not permitted." }, { status: 403 });
    return NextResponse.json({ ok: true, item });
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const removed = await deleteGoalItem(employeeId, goalId, body.id);
    if (!removed) return NextResponse.json({ ok: false, error: "Micro-goal not found or not permitted." }, { status: 403 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
