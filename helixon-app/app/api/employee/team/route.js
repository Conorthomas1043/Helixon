// app/api/employee/team/route.js
// Minimal active-employee roster, for populating the "assign to" dropdown
// on shared tasks. Deliberately narrow: id + display name only, active
// staff only — no username, role, email, or last-login. Any authenticated
// employee can see this; there's nothing sensitive in it.

import { NextResponse } from "next/server";
import { getCurrentEmployeeId } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) {
    return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("employees")
    .select("id,display_name,full_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: "Could not load team." }, { status: 500 });
  }

  const team = (data || []).map((e) => ({ id: e.id, name: e.full_name || e.display_name || "Unnamed" }));
  return NextResponse.json({ ok: true, team });
}
