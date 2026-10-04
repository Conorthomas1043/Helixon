import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { toNotification } from "@/lib/notifications";
import { agencyDb } from "@/lib/agency-db";

// The bell in the nav (lib/notifications.js).
// GET                      the signed-in member's latest 30, plus unread count
// PATCH { ids? | all }     mark read

const forMe = (q, auth) => q.eq("agency_id", auth.agencyId).or(`user_id.is.null,user_id.eq.${auth.userId}`);

export const GET = customerRoute(async (_request, _context, auth) => {
  const [{ data, error }, { count }] = await Promise.all([
    forMe((await agencyDb()).from("notifications").select("*"), auth).order("created_at", { ascending: false }).limit(30),
    forMe((await agencyDb()).from("notifications").select("id", { count: "exact", head: true }), auth).is("read_at", null),
  ]);
  if (error) return NextResponse.json({ notifications: [], unread: 0, unavailable: true });
  return NextResponse.json({ notifications: (data ?? []).map(toNotification), unread: count ?? 0 });
});

export const PATCH = customerRoute(async (request, _context, auth, input) => {
  const body = input;
  let q = forMe((await agencyDb()).from("notifications").update({ read_at: new Date().toISOString() }), auth).is("read_at", null);
  if (body.all !== true) {
    const ids = (Array.isArray(body.ids) ? body.ids : []).filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
    if (!ids.length) return NextResponse.json({ error: "Which notifications?" }, { status: 400 });
    q = q.in("id", ids);
  }
  const { error } = await q;
  if (error) return NextResponse.json({ error: "Couldn't update." }, { status: 500 });
  return NextResponse.json({ ok: true });
}, { body: JsonObject, optionalBody: true });
