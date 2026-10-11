import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { REMINDER_PREF_KEY, remindersEnabled } from "@/lib/messaging/reminder-email";
import { DIGEST_PREF_KEY, digestEnabled } from "@/lib/analytics/digest";
import { fields, flag } from "@/lib/api/schemas";
import { parseBody } from "@/lib/api/body";


// The signed-in person's email preferences, kept on their Clerk user's
// private metadata (server-only):
//   followUpReminders   weekday follow-up reminder (app/api/cron/reminders)
//   applicationAlerts   an email per application from the jobs page
//                       (lib/jobs/applications.js)
//   weeklyDigest        Monday analytics summary
//                       (app/api/cron/analytics-digest)
// The first two are on unless set to false; the digest is off until
// switched on.
//
// GET                                                            current settings
// PATCH { followUpReminders?, applicationAlerts?, weeklyDigest? }  change them

const KEYS = [REMINDER_PREF_KEY, "applicationAlerts", DIGEST_PREF_KEY];
const NotificationPrefsInput = fields(Object.fromEntries(KEYS.map((key) => [key, flag])));

function prefs(meta) {
  return { followUpReminders: remindersEnabled(meta), applicationAlerts: meta?.applicationAlerts !== false, weeklyDigest: digestEnabled(meta) };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return NextResponse.json(prefs(user.privateMetadata));
}

export async function PATCH(request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const parsedBody = await parseBody(request, NotificationPrefsInput, { allowEmpty: true });
  if (parsedBody.response) return parsedBody.response;
  const body = parsedBody.body;
  const update = {};
  for (const key of KEYS) {
    if (body?.[key] === undefined) continue;
    if (typeof body[key] !== "boolean") return NextResponse.json({ error: `${key} must be true or false.` }, { status: 400 });
    update[key] = body[key];
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  const client = await clerkClient();
  // updateUserMetadata merges, so other private metadata is kept.
  const user = await client.users.updateUserMetadata(userId, { privateMetadata: update });
  return NextResponse.json(prefs(user.privateMetadata));
}
