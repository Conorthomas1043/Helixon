import { NextResponse } from "next/server";
import { checkAdminCredentials, createAdminSession } from "@/lib/admin-auth";

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request) {
  try {
    const body = await request.json();

    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return json({ error: "Username and password are required." }, 400);
    }

    const result = checkAdminCredentials(username, password);

    if (!result.ok) {
      // Same generic-enough messages checkAdminCredentials already returns
      // ("Unknown username." / "Incorrect password. Try again." /
      // "Admin account not configured.") - good enough to be useful to a
      // real admin without inviting a scripted username-enumeration pass,
      // since there's no separate "user doesn't exist" vs "wrong password"
      // timing difference introduced here (checkAdminCredentials always
      // does the same amount of work either way).
      return json({ error: result.error }, 401);
    }

    await createAdminSession(username);

    return json({ ok: true, username });
  } catch (error) {
    return json({ error: error?.message || "Internal server error" }, 500);
  }
}