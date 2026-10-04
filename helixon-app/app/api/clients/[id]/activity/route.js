import { NextResponse } from "next/server";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanText } from "@/lib/sanitize";
import { CLIENT_ACTIVITY_TYPES, loadClient, logClientActivity } from "@/lib/clients";

// POST { type, note } - log a call, email, meeting or note on a client's
// timeline (lib/clients.js CLIENT_ACTIVITY_TYPES).
export const POST = customerRoute(async (request, { params }, auth, body) => {
  const { id } = await params;
  const client = await loadClient(auth.agencyId, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!CLIENT_ACTIVITY_TYPES[body.type]) return NextResponse.json({ error: "Unknown activity type." }, { status: 400 });
  const note = cleanText(body.note, { max: 2000 }) || null;
  if (body.type === "note_added" && !note) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  await logClientActivity(auth.agencyId, client.id, body.type, recruiterDisplayName(auth.profile) || auth.userId, note ? { note } : null);
  return NextResponse.json({ ok: true });
}, { body: JsonObject, optionalBody: true });
