import { NextResponse } from "next/server";
import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { logActivity } from "@/lib/candidate-activity";
import { tokenFromAddress } from "@/lib/tracked-email";
import { bccTokenFromAddress, memberForToken } from "@/lib/member-tokens";
import { fileEmail } from "@/lib/email-filing";
import { notify } from "@/lib/notifications";

// Replies to emails sent through Helixon (lib/tracked-email.js). Resend
// receives mail for RESEND_INBOUND_DOMAIN and posts an "email.received"
// event here, signed with RESEND_WEBHOOK_SECRET (Svix headers). The
// reply+<token>@ address it was sent to says which message it answers, so
// the reply is:
//   - kept on the candidate's email thread and timeline,
//   - stops any sequence they're on ("Replied"),
//   - forwarded, untouched, to the recruiter who sent the original, so it
//     still reaches their own inbox.
// Unknown or unsigned requests are refused; events for other addresses are
// acknowledged and ignored.
//
// Mail to someone's log+<token>@ address (lib/member-tokens.js) is an email
// they sent from their own inbox with that address in BCC: it's filed on
// the timeline of every candidate and client contact it went to.

const MAX_BODY = 50000;

export async function POST(request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !process.env.RESEND_API_KEY) return NextResponse.json({ error: "Not configured" }, { status: 503 });

  const payload = await request.text();
  const resend = new Resend(process.env.RESEND_API_KEY);
  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: {
        id: request.headers.get("svix-id") || "",
        timestamp: request.headers.get("svix-timestamp") || "",
        signature: request.headers.get("svix-signature") || "",
      },
      webhookSecret: secret,
    });
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  if (event?.type !== "email.received") return NextResponse.json({ ok: true, ignored: true });

  const data = event.data || {};
  const addresses = [...(data.received_for || []), ...(data.to || [])];
  const bccToken = [...addresses, ...(data.cc || []), ...(data.bcc || [])].map((a) => bccTokenFromAddress(a)).find(Boolean);
  if (bccToken) return logBccEmail({ data, token: bccToken, resend });
  const token = addresses.map((a) => tokenFromAddress(a)).find(Boolean);
  if (!token) return NextResponse.json({ ok: true, ignored: true });

  const { data: original } = await supabase
    .from("email_messages")
    .select("id, agency_id, candidate_id, client_id, sent_by, subject")
    .eq("reply_token", token)
    .maybeSingle();
  if (!original) return NextResponse.json({ ok: true, ignored: true });

  // Resend retries deliveries - only record each inbound email once.
  const { data: seen } = await supabase.from("email_messages").select("id").eq("provider_id", data.email_id).eq("direction", "in").limit(1);
  if (seen?.length) return NextResponse.json({ ok: true, duplicate: true });

  const { data: full } = await resend.emails.receiving.get(data.email_id).catch(() => ({ data: null }));
  const text = (full?.text || (full?.html ? full.html.replace(/<[^>]+>/g, " ") : "") || "").slice(0, MAX_BODY);

  await supabase.from("email_messages").insert({
    agency_id: original.agency_id,
    candidate_id: original.candidate_id,
    client_id: original.client_id,
    direction: "in",
    from_email: String(data.from || "").slice(0, 320),
    to_email: addresses.join(", ").slice(0, 2000),
    subject: String(data.subject || "").slice(0, 500),
    body_text: text,
    provider_id: data.email_id,
    in_reply_to: original.id,
  });

  if (original.candidate_id) {
    await logActivity(supabase, original.candidate_id, "email_received", String(data.from || "Candidate").slice(0, 200), {
      note: data.subject || original.subject,
    });
    const { data: stoppedRows } = await supabase
      .from("sequence_enrollments")
      .update({ status: "stopped", stopped_reason: "Replied", next_send_at: null, updated_at: new Date().toISOString() })
      .eq("candidate_id", original.candidate_id)
      .eq("status", "active")
      .select("id");
    if (stoppedRows?.length) {
      await logActivity(supabase, original.candidate_id, "sequence_stopped", "Helixon", { note: "They replied" });
    }
  }

  await notify({
    agencyId: original.agency_id,
    userId: original.sent_by || null,
    kind: "email_reply",
    title: `Reply from ${String(data.from || "someone").slice(0, 120)}`,
    body: data.subject || original.subject || null,
    href: original.candidate_id ? `/dashboard/candidates/${original.candidate_id}` : original.client_id ? `/dashboard/clients/${original.client_id}` : null,
  });

  // Forward the reply to the recruiter who sent the original.
  if (original.sent_by && process.env.RESEND_FROM_EMAIL) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(original.sent_by);
      const to = user?.primaryEmailAddress?.emailAddress;
      if (to) await resend.emails.receiving.forward({ emailId: data.email_id, to, from: `Helixon <${process.env.RESEND_FROM_EMAIL}>` });
    } catch (err) {
      console.error("[resend-inbound] Forward failed:", err?.message);
    }
  }

  return NextResponse.json({ ok: true });
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const emailsIn = (list) => [...new Set((list || []).flatMap((a) => String(a || "").toLowerCase().match(EMAIL_RE) || []))];

// An email BCC'd to a member's log+<token>@ address (filed by lib/email-filing.js).
async function logBccEmail({ data, token, resend }) {
  const member = await memberForToken(token, "bcc");
  if (!member) return NextResponse.json({ ok: true, ignored: true });

  const from = emailsIn([data.from])[0] || null;
  const people = emailsIn([...(data.to || []), ...(data.cc || []), data.from]).filter((e) => !/^log\+|^reply\+/.test(e));
  if (!people.length) return NextResponse.json({ ok: true, ignored: true });

  const subject = data.subject || "(no subject)";
  const filed = await fileEmail({
    agencyId: member.agency_id,
    userId: member.user_id,
    providerId: data.email_id,
    fromLabel: String(data.from || ""),
    from,
    to: data.to || [],
    cc: data.cc || [],
    subject: data.subject,
    parties: people,
    // Only fetched once someone matched.
    text: async () => {
      const { data: full } = await resend.emails.receiving.get(data.email_id).catch(() => ({ data: null }));
      return (full?.text || (full?.html ? full.html.replace(/<[^>]+>/g, " ") : "") || "").slice(0, MAX_BODY);
    },
    directionFor: (email) => (email === from ? "in" : "out"),
    activity: () => ({ type: "email_logged", note: `${subject} (logged by BCC)` }),
  });
  if (filed.duplicate) return NextResponse.json({ ok: true, duplicate: true });
  if (!filed.candidates && !filed.clients) {
    await notify({ agencyId: member.agency_id, userId: member.user_id, kind: "bcc_unmatched", title: "A BCC'd email didn't match anyone", body: `"${String(data.subject || "").slice(0, 120)}" - no candidate or client contact has those addresses.` });
    return NextResponse.json({ ok: true, unmatched: true });
  }
  return NextResponse.json({ ok: true, candidates: filed.candidates, clients: filed.clients });
}
