import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { REMINDER_PREF_KEY, remindersEnabled } from "@/lib/reminder-email";

// The signed-in person's email preferences - for now just the weekday
// follow-up reminder (app/api/cron/reminders). Kept on their Clerk user's
// private metadata, which only the server can read or write.
//
// GET                          { followUpReminders }
// PATCH { followUpReminders }  turn it on or off

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return NextResponse.json({ followUpReminders: remindersEnabled(user.privateMetadata) });
}

export async function PATCH(request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (typeof body?.followUpReminders !== "boolean") {
    return NextResponse.json({ error: "followUpReminders must be true or false." }, { status: 400 });
  }
  const client = await clerkClient();
  // updateUserMetadata merges, so other private metadata is kept.
  await client.users.updateUserMetadata(userId, { privateMetadata: { [REMINDER_PREF_KEY]: body.followUpReminders } });
  return NextResponse.json({ followUpReminders: body.followUpReminders });
}
