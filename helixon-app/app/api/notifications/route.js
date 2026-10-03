import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { toNotification } from "@/lib/notifications";

// The bell in the nav (lib/notifications.js).
// GET                      the signed-in member's latest 30, plus unread count
// PATCH { ids? | all }     mark read

const forMe = (q, auth) => q.eq("agency_id", auth.agencyId).or(`user_id.is.null,user_id.eq.${auth.userId}`);

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const [{ data, error }, { count }] = await Promise.all([
    forMe(supabase.from("notifications").select("*"), auth).order("created_at", { ascending: false }).limit(30),
    forMe(supabase.from("notifications").select("id", { count: "exact", head: true }), auth).is("read_at", null),
  ]);
  if (error) return NextResponse.json({ notifications: [], unread: 0, unavailable: true });
  return NextResponse.json({ notifications: (data ?? []).map(toNotification), unread: count ?? 0 });
}

export async function PATCH(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => null)) ?? {};
  let q = forMe(supabase.from("notifications").update({ read_at: new Date().toISOString() }), auth).is("read_at", null);
  if (body.all !== true) {
    const ids = (Array.isArray(body.ids) ? body.ids : []).filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
    if (!ids.length) return NextResponse.json({ error: "Which notifications?" }, { status: 400 });
    q = q.in("id", ids);
  }
  const { error } = await q;
  if (error) return NextResponse.json({ error: "Couldn't update." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
