// app/api/employee/files/[id]/download/route.js
// Redirects to a freshly-generated, short-lived signed Storage URL - so
// plain links/anchors work without any client-side JS, and nobody holds a
// long-lived URL to a private bucket object.

import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { getSignedDownloadUrl } from "@/lib/employee-files";
import { cleanUuid } from "@/lib/sanitize";

export async function GET(request, { params }) {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = cleanUuid(rawId);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid file id." }, { status: 400 });

  const result = await getSignedDownloadUrl(id);
  if (!result) return NextResponse.json({ ok: false, error: "File not found." }, { status: 404 });

  return NextResponse.redirect(result.url);
}
