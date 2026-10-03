import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/candidate-activity";
import { notify } from "@/lib/notifications";
import { isStopMessage, normalisePhone, smsWebhookUrl, verifyTwilioSignature } from "@/lib/sms";

// Twilio posts here (form-encoded, signed with X-Twilio-Signature):
//   - delivery updates for texts sent from Helixon (MessageStatus), which
//     update sms_messages.status;
//   - texts people send to the Twilio number, which are filed on the
//     candidate last texted at that number and notify whoever texted them.
// Set the number's "A message comes in" webhook to
// <NEXT_PUBLIC_SITE_URL>/api/webhooks/twilio (HTTP POST).

const EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twiml() {
  return new NextResponse(EMPTY_TWIML, { headers: { "Content-Type": "text/xml" } });
}

export async function POST(request) {
  if (!process.env.TWILIO_AUTH_TOKEN) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const form = await request.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const params = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  if (!verifyTwilioSignature(smsWebhookUrl(), params, request.headers.get("x-twilio-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const sid = String(params.MessageSid || params.SmsSid || "").slice(0, 100);

  // A delivery update for a text we sent.
  if (params.MessageStatus && params.MessageStatus !== "received") {
    if (sid) {
      await supabase
        .from("sms_messages")
        .update({ status: String(params.MessageStatus).slice(0, 40) })
        .eq("provider_id", sid)
        .eq("direction", "out");
    }
    return twiml();
  }

  // An incoming text.
  const from = normalisePhone(params.From);
  const body = String(params.Body || "").slice(0, 1600);
  if (!from || !sid) return twiml();

  const { data: seen } = await supabase.from("sms_messages").select("id").eq("provider_id", sid).limit(1);
  if (seen?.length) return twiml(); // Twilio retries

  const { data: last } = await supabase
    .from("sms_messages")
    .select("agency_id, candidate_id, sent_by")
    .eq("to_number", from)
    .eq("direction", "out")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last) return twiml(); // nobody here has texted this number

  await supabase.from("sms_messages").insert({
    agency_id: last.agency_id,
    candidate_id: last.candidate_id,
    direction: "in",
    to_number: String(normalisePhone(params.To) || params.To || "").slice(0, 32) || "twilio",
    from_number: from,
    body,
    provider_id: sid,
    status: "received",
  });

  if (last.candidate_id) {
    const { data: candidate } = await supabase.from("candidates").select("full_name, name").eq("id", last.candidate_id).maybeSingle();
    const name = candidate?.full_name || candidate?.name || from;
    await logActivity(supabase, last.candidate_id, "sms_received", name, { note: body.slice(0, 300) });
    await notify({
      agencyId: last.agency_id,
      userId: last.sent_by || null,
      kind: "sms_reply",
      title: isStopMessage(body) ? `${name} opted out of texts` : `Text from ${name}`,
      body: body.slice(0, 200),
      href: `/dashboard/candidates/${last.candidate_id}`,
    });
  }
  return twiml();
}
