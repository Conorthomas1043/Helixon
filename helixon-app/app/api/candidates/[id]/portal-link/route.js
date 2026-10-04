import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { recruiterDisplayName } from "@/lib/recruiter-directory";
import { cleanUuid } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidates/activity";
import { agencyFromName, sendAgencyEmail, siteUrl } from "@/lib/mailer";
import { newToken } from "@/lib/signatures";
import { PORTAL_LINK_DAYS } from "@/lib/candidates/portal";
import { candidateHidden } from "@/lib/permissions";
import { agencyDb } from "@/lib/agency-db";

// A candidate's private self-service link (lib/candidates/portal.js).
// GET               the current link, if there is one
// POST { send? }    a new link (any older one stops working); with send,
//                   emailed to the candidate
// DELETE            turn the link off

async function loadCandidate(agencyId, rawId) {
  const id = cleanUuid(rawId);
  if (!id) return null;
  const { data } = await (await agencyDb()).from("candidates").select("id, full_name, name, email").eq("id", id).eq("agency_id", agencyId).maybeSingle();
  return data;
}

const toLink = (row) =>
  row ? { url: `${siteUrl()}/portal/${row.token}`, expiresAt: row.expires_at, lastUsedAt: row.last_used_at, createdAt: row.created_at } : null;

async function activeLink(candidateId) {
  const { data, error } = await (await agencyDb())
    .from("candidate_portal_links")
    .select("*")
    .eq("candidate_id", candidateId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data, error };
}

export const GET = customerRoute(async (request, { params }, auth) => {
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const c = await loadCandidate(auth.agencyId, (await params).id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await activeLink(c.id);
  if (error) return NextResponse.json({ link: null, unavailable: true });
  return NextResponse.json({ link: toLink(data) });
});

export const POST = customerRoute(async (request, { params }, auth, input) => {
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const c = await loadCandidate(auth.agencyId, (await params).id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = input;

  const now = new Date();
  await (await agencyDb()).from("candidate_portal_links").update({ revoked_at: now.toISOString() }).eq("candidate_id", c.id).is("revoked_at", null);
  const { data, error } = await (await agencyDb())
    .from("candidate_portal_links")
    .insert({ agency_id: auth.agencyId, candidate_id: c.id, token: newToken(), expires_at: new Date(now.getTime() + PORTAL_LINK_DAYS * 86400000).toISOString(), created_by: auth.userId })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Self-service links need a database update first (migration 20261003010000)." }, { status: 503 });

  const link = toLink(data);
  let emailError = null;
  if (body.send === true) {
    if (!c.email) emailError = "There's no email address for this candidate.";
    else {
      const agencyName = await agencyFromName(auth.agencyId, auth.profile);
      const first = (c.full_name || c.name || "").split(" ")[0];
      const res = await sendAgencyEmail({
        agencyId: auth.agencyId,
        profile: auth.profile,
        to: c.email,
        subject: `Keep your details up to date with ${agencyName}`,
        text: [
          `Hi ${first || "there"},`,
          "",
          `Here's a private link to check the details ${agencyName} holds for you, tell us when you're available, and upload documents such as your right to work:`,
          "",
          link.url,
          "",
          `It works for ${PORTAL_LINK_DAYS} days. Please don't share it.`,
          "",
          recruiterDisplayName(auth.profile) || agencyName,
        ].join("\n"),
      });
      emailError = res.error || null;
    }
  }
  await logActivity(supabase, c.id, "portal_link_created", recruiterDisplayName(auth.profile) || auth.userId, {
    note: body.send === true && !emailError ? "Self-service link emailed" : "Self-service link created",
  });
  return NextResponse.json({ link, emailError }, { status: 201 });
}, { body: JsonObject, optionalBody: true });

export const DELETE = customerRoute(async (request, { params }, auth) => {
  const hidden = await candidateHidden(auth, (await params).id);
  if (hidden) return hidden;
  const c = await loadCandidate(auth.agencyId, (await params).id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await (await agencyDb()).from("candidate_portal_links").update({ revoked_at: new Date().toISOString() }).eq("candidate_id", c.id).is("revoked_at", null);
  return NextResponse.json({ ok: true });
});
