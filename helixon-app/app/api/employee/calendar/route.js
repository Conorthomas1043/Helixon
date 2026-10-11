// app/api/employee/calendar/route.js
// Shared team calendar CRUD - see lib/employee/calendar.js. Every active
// employee sees every event; only the creator can edit or delete one.

import { NextResponse } from "next/server";
import { employeeAccess } from "@/lib/employee/session";
import { getEvents, addEvent, updateEvent, deleteEvent } from "@/lib/employee/calendar";
import { date, fields, flag, id, str } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";

// Saved as given by addEvent / updateEvent (lib/employee/calendar.js).
const EventInput = fields({
  action: str(20),
  id,
  title: str(400),
  notes: str(8000),
  location: str(400),
  start_at: date,
  end_at: date,
  all_day: flag,
});

export async function GET(request) {
  const { employeeId, forbidden } = await employeeAccess("calendar", "view");
  if (forbidden) return forbidden;
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  return NextResponse.json({ ok: true, events: await getEvents({ from, to }) });
}

export async function POST(request) {
  const { employeeId, forbidden } = await employeeAccess("calendar", "edit");
  if (forbidden) return forbidden;
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const parsedBody = await parseBody(request, EventInput, { allowEmpty: true });
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.body;
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
