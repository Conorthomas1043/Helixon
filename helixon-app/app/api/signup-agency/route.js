import { createClient } from "@supabase/supabase-js";

// Uses the SERVICE ROLE key - this must stay server-side only, never exposed
// to the browser. Needed because we're creating an `agencies` row and a
// matching `users` row right after sign-up, before the new user's own RLS
// session is necessarily usable for this insert.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { userId, email, agencyName, fullName } = await request.json();

    if (!userId || !email || !agencyName?.trim()) {
      return Response.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Create the agency - matches the real `agencies` table:
    // id, name, created_at, settings (jsonb), intake_email
    const { data: agency, error: agencyError } = await supabaseAdmin
      .from("agencies")
      .insert({
        name: agencyName.trim(),
        intake_email: email,
      })
      .select()
      .single();

    if (agencyError) throw new Error(agencyError.message);

    // Link the auth user to the agency via the `users` table:
    // id, agency_id, email, full_name, created_at
    // `id` matches the Supabase Auth user's UUID (userId) - this is the
    // standard "shadow profile row" pattern, not a separately generated id.
    const { error: userRowError } = await supabaseAdmin
      .from("users")
      .insert({
        id: userId,
        agency_id: agency.id,
        email,
        full_name: fullName || null,
      });

    if (userRowError) throw new Error(userRowError.message);

    return Response.json({ ok: true, agencyId: agency.id });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}