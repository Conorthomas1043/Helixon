import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";
import { cleanEmail, cleanLine, cleanUuid } from "@/lib/sanitize";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { logClientActivity } from "@/lib/clients";
import { loadShortlist, shortlistAuth } from "@/lib/shortlists";
import { toShare } from "@/lib/shortlist-shares";
import { sendAgencyEmail, siteUrl } from "@/lib/mailer";

// Client review links for a shortlist (lib/shortlist-shares.js).
//
// GET                      the links made for it
// POST { blind?, includeConcerns?, showScore?, expiresInDays?,
//        recipientName?, recipientEmail?, send? }
//     make one; with send and an email, it's emailed to them
// DELETE ?shareId=         revoke one

const DAY = 86400000;

function shareUrl(token) {
  return `${siteUrl()}/share/${token}`;
}

export async function GET(request, { params }) {
  const { auth, response } = await shortlistAuth();
  if (response) return response;
  const loaded = await loadShortlist(auth.agencyId, (await params).id);
  if (loaded.response) return loaded.response;
  const { data } = await supabase
    .from("shortlist_shares")
    .select("*")
    .eq("shortlist_id", loaded.shortlist.id)
    .eq("agency_id", auth.agencyId)
    .order("created_at", { ascending: false });
  return NextResponse.json({ shares: (data ?? []).map((s) => toShare(s, shareUrl(s.token))) });
}

export async function POST(request, { params }) {
  const { auth, response } = await shortlistAuth();
  if (response) return response;
  const loaded = await loadShortlist(auth.agencyId, (await params).id);
  if (loaded.response) return loaded.response;
  const body = await request.json().catch(() => ({}));

  const days = body.expiresInDays === null || body.expiresInDays === undefined ? 30 : Number(body.expiresInDays);
  if (!Number.isInteger(days) || days < 0 || days > 365) return NextResponse.json({ error: "Expiry must be 0–365 days (0 = never)." }, { status: 400 });
  const recipientEmail = body.recipientEmail ? cleanEmail(body.recipientEmail) : null;
  if (body.recipientEmail && !recipientEmail) return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
  const recipientName = cleanLine(body.recipientName, 200) || null;
  const token = crypto.randomBytes(24).toString("hex");

  const { data: share, error } = await supabase
    .from("shortlist_shares")
    .insert({
      agency_id: auth.agencyId,
      shortlist_id: loaded.shortlist.id,
      token,
      blind: body.blind === true,
      include_concerns: body.includeConcerns === true,
      show_score: body.showScore !== false,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      expires_at: days ? new Date(Date.now() + days * DAY).toISOString() : null,
      created_by: auth.userId,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to create the link." }, { status: 500 });

  const actor = recruiterDisplayName(auth.profile) || auth.userId;
  const url = shareUrl(token);
  let emailed = false;
  let sendError = null;
  if (body.send && recipientEmail) {
    const { count } = await supabase.from("shortlist_candidates").select("id", { count: "exact", head: true }).eq("shortlist_id", loaded.shortlist.id);
    const role = loaded.shortlist.jobs?.title;
    const res = await sendAgencyEmail({
      agencyId: auth.agencyId,
      profile: auth.profile,
      to: recipientEmail,
      subject: `Shortlist${role ? ` for ${role}` : ""}: ${count} candidate${count === 1 ? "" : "s"} to review`,
      text: [
        `Hi${recipientName ? ` ${recipientName.split(" ")[0]}` : ""},`,
        "",
        `Here ${count === 1 ? "is the candidate" : `are the ${count} candidates`} I'd like to put forward${role ? ` for ${role}` : ""}. You can read each profile and tell me who you'd like to meet - no login needed:`,
        "",
        url,
        "",
        days ? `The link works for ${days} days.` : "",
        "",
        "Thanks,",
        actor,
      ]
        .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
        .join("\n"),
    });
    emailed = !res.error;
    sendError = res.error || null;
  }
  const clientId = loaded.shortlist.jobs?.client_id;
  if (clientId) {
    await logClientActivity(auth.agencyId, clientId, "shortlist_shared", actor, { note: `${loaded.shortlist.name}${recipientEmail ? ` → ${recipientEmail}` : ""}` });
  }
  return NextResponse.json({ share: toShare(share, url), emailed, sendError }, { status: 201 });
}

export async function DELETE(request, { params }) {
  const { auth, response } = await shortlistAuth();
  if (response) return response;
  const loaded = await loadShortlist(auth.agencyId, (await params).id);
  if (loaded.response) return loaded.response;
  const shareId = cleanUuid(new URL(request.url).searchParams.get("shareId"));
  if (!shareId) return NextResponse.json({ error: "Which link?" }, { status: 400 });
  const { error } = await supabase
    .from("shortlist_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", shareId)
    .eq("shortlist_id", loaded.shortlist.id)
    .eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to revoke the link." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
