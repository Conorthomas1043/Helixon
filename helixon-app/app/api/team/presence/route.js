import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/ratelimit";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanLine } from "@/lib/sanitize";
import { HEARTBEAT_MS, computePresence } from "@/lib/presence";

// Your own presence (lib/presence.js). Only ever touches the caller's own
// profile row.
//
// POST { active }                         heartbeat from an open tab, every
//                                         minute; active = they've used it
//                                         since the last beat
// PATCH { status, message?, until? }      set yourself busy / away with an
//                                         optional message and end time;
//                                         status null goes back to automatic

async function own() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  return { auth };
}

const SELECT = "last_seen_at, last_active_at, presence_status, presence_message, presence_until";

function shape(row) {
  const raw = {
    lastSeenAt: row.last_seen_at,
    lastActiveAt: row.last_active_at,
    status: row.presence_status,
    message: row.presence_message,
    until: row.presence_until,
  };
  return { ...raw, presence: computePresence(raw) };
}

export async function POST(request) {
  const { auth, response } = await own();
  if (response) return response;
  // A tab beats once a minute; a few tabs open plus visibility/interaction
  // beats stay well under this.
  if (!(await rateLimit(`presence:${auth.userId}`, 600))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("profiles")
    .update({ last_seen_at: now, ...(body?.active ? { last_active_at: now } : {}) })
    .eq("clerk_user_id", auth.userId);
  if (error) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true, nextBeatMs: HEARTBEAT_MS });
}

export async function PATCH(request) {
  const { auth, response } = await own();
  if (response) return response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const status = body.status === "busy" || body.status === "away" ? body.status : null;
  if (body.status && !status) {
    return NextResponse.json({ error: "Status must be busy, away or automatic." }, { status: 400 });
  }
  let until = null;
  if (status && body.until) {
    const t = new Date(body.until).getTime();
    if (!Number.isFinite(t) || t <= Date.now() || t > Date.now() + 14 * 86400000) {
      return NextResponse.json({ error: "Pick an end time within the next two weeks." }, { status: 400 });
    }
    until = new Date(t).toISOString();
  }
  const message = status ? cleanLine(body.message || "", 80) || null : null;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      presence_status: status,
      presence_message: message,
      presence_until: until,
      last_seen_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .eq("clerk_user_id", auth.userId)
    .select(SELECT)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "Couldn't update your status." }, { status: 500 });
  }
  return NextResponse.json(shape(data));
}
