import { supabase } from "@/lib/supabase";

// GET — returns the current settings for an agency
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const agencyId = searchParams.get("agencyId");

  const { data, error } = await supabase
    .from("agencies")
    .select("settings, name")
    .eq("id", agencyId)
    .single();

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, settings: data.settings || {}, name: data.name });
}

// POST — saves updated settings for an agency
export async function POST(request) {
  try {
    const { agencyId, settings } = await request.json();

    const { error } = await supabase
      .from("agencies")
      .update({ settings })
      .eq("id", agencyId);

    if (error) throw new Error(error.message);

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}