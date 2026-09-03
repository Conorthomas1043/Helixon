import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminOpsData } from "../../../../lib/ops/admin-data";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server credentials");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function isAllowedAdmin(request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.email) return false;
  const admins = String(process.env.HELIXON_ADMIN_EMAILS || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  return admins.includes(data.user.email.toLowerCase());
}

export async function GET(request) {
  if (!(await isAllowedAdmin(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await getAdminOpsData());
  } catch (error) {
    console.error("Admin ops data error", error);
    return NextResponse.json({ error: "Unable to load operational data" }, { status: 500 });
  }
}
