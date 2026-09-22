// app/api/employee/files/route.js
// Shared filing system - see lib/employee-files.js for the visibility/edit
// model (everyone browses and downloads everything; only the creator of a
// folder or uploader of a file can delete it). Uploads are handled by the
// separate multipart route at app/api/employee/files/upload/route.js.

import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { listFolder, createFolder, deleteFolder, deleteFile } from "@/lib/employee-files";
import { cleanUuid } from "@/lib/sanitize";

export async function GET(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawFolderId = searchParams.get("folderId");
  const folderId = rawFolderId ? cleanUuid(rawFolderId) : null;
  if (rawFolderId && !folderId) {
    return NextResponse.json({ ok: false, error: "Invalid folder id." }, { status: 400 });
  }

  const result = await listFolder(folderId);
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { action } = body;

  if (action === "create_folder") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ ok: false, error: "Folder name is required." }, { status: 400 });
    const parentId = body.parent_id ? cleanUuid(body.parent_id) : null;
    if (body.parent_id && !parentId) return NextResponse.json({ ok: false, error: "Invalid parent folder." }, { status: 400 });

    const folder = await createFolder(employeeId, { name, parent_id: parentId });
    if (!folder) return NextResponse.json({ ok: false, error: "Could not create folder." }, { status: 500 });
    return NextResponse.json({ ok: true, folder });
  }

  if (action === "delete_folder") {
    const id = cleanUuid(body.id);
    if (!id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const result = await deleteFolder(employeeId, id);
    if (!result.ok) {
      const messages = {
        not_empty: "This folder isn't empty - delete its files and subfolders first.",
        not_found: "Folder not found or you're not the one who created it.",
        error: "Could not delete folder.",
      };
      return NextResponse.json({ ok: false, error: messages[result.reason] || messages.error }, { status: result.reason === "not_empty" ? 409 : 404 });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "delete_file") {
    const id = cleanUuid(body.id);
    if (!id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });
    const removed = await deleteFile(employeeId, id);
    if (!removed) return NextResponse.json({ ok: false, error: "File not found or you're not the one who uploaded it." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
