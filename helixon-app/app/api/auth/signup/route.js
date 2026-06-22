import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    const supabase = createSupabaseBrowserClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return Response.json(
        { ok: false, error: error.message },
        { status: 400 }
      );
    }

    return Response.json({
      ok: true,
      user: data.user,
      session: data.session,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err.message },
      { status: 500 }
    );
  }
}