import { NextResponse } from "next/server";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanText } from "@/lib/sanitize";
import { CLIENT_ACTIVITY_TYPES, loadClient, logClientActivity } from "@/lib/clients";

// POST { type, note } - log a call, email, meeting or note on a client's
// timeline (lib/clients.js CLIENT_ACTIVITY_TYPES).
export async function POST(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const client = await loadClient(auth.agencyId, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  if (!CLIENT_ACTIVITY_TYPES[body.type]) return NextResponse.json({ error: "Unknown activity type." }, { status: 400 });
  const note = cleanText(body.note, { max: 2000 }) || null;
  if (body.type === "note_added" && !note) return NextResponse.json({ error: "Write something first." }, { status: 400 });

  await logClientActivity(auth.agencyId, client.id, body.type, recruiterDisplayName(auth.profile) || auth.userId, note ? { note } : null);
  return NextResponse.json({ ok: true });
}
