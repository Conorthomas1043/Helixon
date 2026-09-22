// app/api/employee/files/upload/route.js
// Multipart upload for the shared filing system - separate from
// app/api/employee/files/route.js since that one takes JSON bodies.

import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { uploadFile, MAX_FILE_BYTES } from "@/lib/employee-files";
import { cleanUuid } from "@/lib/sanitize";

export async function POST(request) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Invalid upload." }, { status: 400 });

  const file = form.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ ok: false, error: `Files must be ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))}MB or smaller.` }, { status: 400 });
  }

  const rawFolderId = form.get("folderId");
  const folderId = rawFolderId && typeof rawFolderId === "string" ? cleanUuid(rawFolderId) : null;
  if (rawFolderId && typeof rawFolderId === "string" && rawFolderId.length && !folderId) {
    return NextResponse.json({ ok: false, error: "Invalid folder id." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadFile(employeeId, {
    folderId,
    name: file.name || "file",
    buffer,
    mimeType: file.type,
    sizeBytes: file.size,
  });

  if (!uploaded) return NextResponse.json({ ok: false, error: "Could not upload the file." }, { status: 500 });
  return NextResponse.json({ ok: true, file: uploaded });
}
