import { checkAdminCredentials, createAdminSession } from "@/lib/admin-auth";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return Response.json(
        { ok: false, error: "Username and password required." },
        { status: 400 }
      );
    }

    const result = checkAdminCredentials(username, password);
    if (!result.ok) {
      return Response.json({ ok: false, error: result.error }, { status: 401 });
    }

    await createAdminSession(username);

    return Response.json({ ok: true, username });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}