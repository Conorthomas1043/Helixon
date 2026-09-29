// app/api/employee/call-list/route.js
// Shared cold-call list imported from CSV - see lib/employee-call-list.js.

import { NextResponse } from "next/server";
import { employeeAccess } from "@/lib/session";
import {
  getCallList,
  importContacts,
  claimRow,
  releaseRow,
  finishRow,
  reopenRow,
  deleteRow,
  MAX_IMPORT_ROWS,
} from "@/lib/employee-call-list";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET() {
  const { employeeId, forbidden } = await employeeAccess("cold_calls", "view");
  if (forbidden) return forbidden;
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }
  const list = await getCallList();
  if (!list) return NextResponse.json({ ok: false, error: "Could not load the call list." }, { status: 500 });
  return NextResponse.json({ ok: true, ...list, maxImportRows: MAX_IMPORT_ROWS });
}

export async function POST(request) {
  const { employeeId, forbidden } = await employeeAccess("cold_calls", "edit");
  if (forbidden) return forbidden;
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  try {
    if (action === "import") {
      if (!Array.isArray(body.contacts) || body.contacts.length === 0) {
        return NextResponse.json({ ok: false, error: "No contacts to import." }, { status: 400 });
      }
      if (body.contacts.length > MAX_IMPORT_ROWS) {
        return NextResponse.json({ ok: false, error: `Import at most ${MAX_IMPORT_ROWS} contacts at a time.` }, { status: 400 });
      }
      const result = await importContacts(employeeId, body.contacts, body.batchLabel);
      return NextResponse.json({ ok: true, ...result });
    }

    if (!UUID_RE.test(body.id || "")) {
      return NextResponse.json({ ok: false, error: "Missing or invalid id." }, { status: 400 });
    }

    if (action === "claim") {
      const row = await claimRow(employeeId, body.id);
      if (!row) return NextResponse.json({ ok: false, error: "Someone else is already calling this contact." }, { status: 409 });
      return NextResponse.json({ ok: true, row });
    }
    if (action === "release") {
      const row = await releaseRow(employeeId, body.id);
      if (!row) return NextResponse.json({ ok: false, error: "You don't have this contact claimed." }, { status: 404 });
      return NextResponse.json({ ok: true, row });
    }
    if (action === "skip") {
      const row = await finishRow(employeeId, body.id, { status: "skipped" });
      if (!row) return NextResponse.json({ ok: false, error: "Contact not found or already handled." }, { status: 404 });
      return NextResponse.json({ ok: true, row });
    }
    if (action === "reopen") {
      const row = await reopenRow(body.id);
      if (!row) return NextResponse.json({ ok: false, error: "Contact not found or still on the list." }, { status: 404 });
      return NextResponse.json({ ok: true, row });
    }
    if (action === "delete") {
      const removed = await deleteRow(employeeId, body.id);
      if (!removed) return NextResponse.json({ ok: false, error: "Only the person who imported a contact can delete it." }, { status: 404 });
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("[call-list]", action, err?.message || err);
    return NextResponse.json({ ok: false, error: "Something went wrong. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
