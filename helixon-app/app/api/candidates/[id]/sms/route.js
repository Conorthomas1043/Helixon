import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanText } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidates/activity";
import { rateLimit } from "@/lib/ratelimit";
import { candidateHidden } from "@/lib/permissions";
import { SMS_MAX, normalisePhone, optedOut, sendSms, smsConfigured } from "@/lib/sms";
import { reportError } from "@/lib/report-error";
import { agencyDb } from "@/lib/agency-db";

// Texts with a candidate (lib/sms.js, Twilio).
// GET            the conversation, oldest first, and whether texting is set up
// POST { body }  send a text to the candidate's phone number

async function context(params) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return { response: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  const { id } = await params;
  const hidden = await candidateHidden(auth, id);
  if (hidden) return { response: hidden };
  const { data: candidate } = await (await agencyDb()).from("candidates").select("id, phone, full_name, name").eq("id", id).eq("agency_id", auth.agencyId).maybeSingle();
  if (!candidate) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { auth, candidate };
}

function toMessage(row) {
  return { id: row.id, direction: row.direction, body: row.body, status: row.status, createdAt: row.created_at };
}

export async function GET(request, { params }) {
  const ctx = await context(params);
  if (ctx.response) return ctx.response;
  const { data, error } = await (await agencyDb())
    .from("sms_messages")
    .select("id, direction, body, status, created_at")
    .eq("candidate_id", ctx.candidate.id)
    .eq("agency_id", ctx.auth.agencyId)
    .order("created_at", { ascending: true })
    .limit(200);
  const missing = error && (error.code === "42P01" || error.code === "PGRST205");
  return NextResponse.json({
    configured: smsConfigured() && !missing,
    phone: normalisePhone(ctx.candidate.phone),
    messages: (data ?? []).map(toMessage),
  });
}

export async function POST(request, { params }) {
  const ctx = await context(params);
  if (ctx.response) return ctx.response;
  const { auth, candidate } = ctx;
  if (!smsConfigured()) return NextResponse.json({ error: "Texting isn't set up yet - see Settings → Integrations." }, { status: 503 });

  const payload = (await request.json().catch(() => null)) ?? {};
  const body = cleanText(payload.body, { max: SMS_MAX });
  if (!body) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  const to = normalisePhone(candidate.phone);
  if (!to) return NextResponse.json({ error: "Add a mobile number to their details first." }, { status: 400 });
  if (!(await rateLimit(`sms:${auth.userId}`, 200))) return NextResponse.json({ error: "That's a lot of texts this hour - try again shortly." }, { status: 429 });

  // Respect STOP: the newest STOP/START from this number decides.
  const { data: inbound } = await (await agencyDb())
    .from("sms_messages")
    .select("body")
    .eq("agency_id", auth.agencyId)
    .eq("from_number", to)
    .eq("direction", "in")
    .order("created_at", { ascending: false })
    .limit(20);
  if (optedOut(inbound)) return NextResponse.json({ error: "They've replied STOP, so they can't be texted until they reply START." }, { status: 409 });

  let sent;
  try {
    sent = await sendSms({ to, body });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 502 });
  }

  const { data: row, error } = await (await agencyDb())
    .from("sms_messages")
    .insert({
      agency_id: auth.agencyId,
      candidate_id: candidate.id,
      direction: "out",
      to_number: to,
      from_number: String(sent.from || "").slice(0, 32) || "twilio",
      body,
      provider_id: sent.sid,
      status: sent.status,
      sent_by: auth.userId,
    })
    .select("id, direction, body, status, created_at")
    .single();
  if (error) reportError("[sms] Sent but not stored:", error.message);
  await logActivity(supabase, candidate.id, "sms_logged", recruiterDisplayName(auth.profile) || auth.userId, { note: body.slice(0, 300) });
  return NextResponse.json({ message: row ? toMessage(row) : { id: sent.sid, direction: "out", body, status: sent.status, createdAt: new Date().toISOString() } });
}
