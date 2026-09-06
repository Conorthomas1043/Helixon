import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

// Wires up the password-change form on app/account/security/page.jsx.
// (Note: this endpoint didn't exist before this migration either - the
// security page called it but nothing served it, a pre-existing 404. This
// makes it a real, working route using Clerk's backend API instead of
// Supabase Auth's password update call.)
export async function POST(request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "Please sign in to continue." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPassword = body?.currentPassword;
  const newPassword = body?.newPassword;

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ ok: false, error: "Current and new password are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ ok: false, error: "Use at least 8 characters." }, { status: 400 });
  }

  const client = await clerkClient();

  try {
    const verification = await client.users.verifyPassword({
      userId,
      password: currentPassword,
    });
    if (!verification?.verified) {
      return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 401 });
    }
  } catch (err) {
    console.error("[account/password] Current password verification failed:", err.message);
    return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 401 });
  }

  try {
    await client.users.updateUser(userId, { password: newPassword });
  } catch (err) {
    console.error("[account/password] Password update failed:", err.message);
    const message = err?.errors?.[0]?.longMessage || "Couldn't update your password. Please try again.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
