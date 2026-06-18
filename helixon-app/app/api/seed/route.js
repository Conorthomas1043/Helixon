import { supabase } from "@/lib/supabase";
export async function GET() {
  const { data, error } = await supabase
    .from("agencies")
    .insert({ name: "Test Agency" })
    .select();
  if (error) return Response.json({ ok: false, error: error.message });
  return Response.json({ ok: true, agency: data[0] });
}