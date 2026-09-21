// app/api/employee/calendar/route.js
// Shared team calendar CRUD - see lib/employee-calendar.js. Every active
// employee sees every event; only the creator can edit or delete one.

import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { getEvents, addEvent, updateEvent, deleteEvent } from "@/lib/employee-calendar";

export async function GET(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  return NextResponse.json({ ok: true, events: await getEvents({ from, to }) });
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
    if (!body.start_at) {
      return NextResponse.json({ ok: false, error: "Start date/time is required." }, { status: 400 });
    }
    const event = await addEvent(employeeId, body);
    if (!event) return NextResponse.json({ ok: false, error: "Could not create event." }, { status: 500 });
    return NextResponse.json({ ok: true, event });
  }

  if (action === "update") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    if (body.title !== undefined && !body.title.trim()) {
      return NextResponse.json({ ok: false, error: "Title is required." }, { status: 400 });
    }
    const event = await updateEvent(employeeId, body.id, body);
    if (!event) return NextResponse.json({ ok: false, error: "Event not found or you're not the organiser." }, { status: 404 });
    return NextResponse.json({ ok: true, event });
  }

  if (action === "delete") {
    if (!body.id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const removed = await deleteEvent(employeeId, body.id);
    if (!removed) return NextResponse.json({ ok: false, error: "Event not found or you're not the organiser." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
