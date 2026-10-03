import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { cleanLine, cleanText, cleanUuid } from "@/lib/sanitize";
import { logActivity } from "@/lib/candidate-activity";
import { logClientActivity } from "@/lib/clients";
import { agencyDisplayName } from "@/lib/agency-display";
import { CLIENT_DECISIONS, SHARE_TOKEN_RE, shareActive, sharedProfiles } from "@/lib/shortlist-shares";
import { sendAgencyEmail, siteUrl } from "@/lib/mailer";
import { clerkClient } from "@clerk/nextjs/server";
import { notify } from "@/lib/notifications";

// Public: a client's view of a shared shortlist (app/share/[token]). The
// token is the only credential, and the link stops working when revoked or
// expired.
//
// GET                                               the profiles + responses
// POST { candidateId, decision, comment?, name? }   respond on one person

async function load(token) {
  if (!SHARE_TOKEN_RE.test(token || "")) return null;
  const { data } = await supabase
    .from("shortlist_shares")
    .select("*, shortlists(id, name, job_id, jobs(title, client, client_id)), agencies(name)")
    .eq("token", token)
    .maybeSingle();
  return data && shareActive(data) ? data : null;
}

export async function GET(request, { params }) {
  if (!(await rateLimit(`share-get:${getClientIp(request)}`, 300))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const share = await load((await params).token);
  if (!share) return NextResponse.json({ error: "This link has expired or been withdrawn." }, { status: 404 });

  await supabase
    .from("shortlist_shares")
    .update({ view_count: (share.view_count ?? 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq("id", share.id);

  return NextResponse.json({
    agencyName: agencyDisplayName(share.agencies),
    shortlistName: share.shortlists?.name ?? "Shortlist",
    jobTitle: share.shortlists?.jobs?.title ?? null,
    showScore: share.show_score,
    recipientName: share.recipient_name,
    decisions: CLIENT_DECISIONS,
    candidates: await sharedProfiles(share),
  });
}

export async function POST(request, { params }) {
  if (!(await rateLimit(`share-post:${getClientIp(request)}`, 120))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const share = await load((await params).token);
  if (!share) return NextResponse.json({ error: "This link has expired or been withdrawn." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const candidateId = cleanUuid(body.candidateId);
  if (!candidateId || !CLIENT_DECISIONS[body.decision]) return NextResponse.json({ error: "Choose interview, maybe or not for us." }, { status: 400 });
  const comment = cleanText(body.comment, { max: 2000 }) || null;
  const by = cleanLine(body.name, 200) || share.recipient_name || "Client";

  const { data: updated, error } = await supabase
    .from("shortlist_candidates")
    .update({ client_decision: body.decision, client_comment: comment, client_decided_at: new Date().toISOString(), client_decided_by: by })
    .eq("shortlist_id", share.shortlist_id)
    .eq("candidate_id", candidateId)
    .select("candidate_id, candidates(full_name, name)");
  if (error) return NextResponse.json({ error: "Couldn't save that - please try again." }, { status: 500 });
  if (!updated?.length) return NextResponse.json({ error: "That person isn't on this shortlist." }, { status: 404 });

  const decisionLabel = CLIENT_DECISIONS[body.decision];
  await logActivity(supabase, candidateId, "client_decision", by, { note: `${decisionLabel}${comment ? ` - "${comment}"` : ""} (shortlist: ${share.shortlists?.name})` });
  const clientId = share.shortlists?.jobs?.client_id;
  if (clientId) {
    const name = updated[0].candidates?.full_name || updated[0].candidates?.name || "a candidate";
    await logClientActivity(share.agency_id, clientId, "shortlist_feedback", by, { note: `${name}: ${decisionLabel}` });
  }

  await notify({
    agencyId: share.agency_id,
    userId: share.created_by || null,
    kind: "client_feedback",
    title: `${by}: ${decisionLabel} - ${updated[0].candidates?.full_name || updated[0].candidates?.name || "a candidate"}`,
    body: comment,
    href: `/dashboard/candidates/${candidateId}`,
  });

  // Let the recruiter who shared it know.
  if (share.created_by) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(share.created_by);
      const to = user?.primaryEmailAddress?.emailAddress;
      const name = updated[0].candidates?.full_name || updated[0].candidates?.name || "a candidate";
      if (to) {
        await sendAgencyEmail({
          agencyId: share.agency_id,
          to,
          replyTo: null,
          fromName: "Helixon",
          subject: `${by}: ${decisionLabel} - ${name}`,
          text: [`${by} responded on the shortlist "${share.shortlists?.name}":`, "", `${name}: ${decisionLabel}`, comment ? `"${comment}"` : "", "", `${siteUrl()}/dashboard/shortlists/${share.shortlist_id}`].filter(Boolean).join("\n"),
        });
      }
    } catch (err) {
      console.error("[shares] Recruiter alert failed:", err?.message);
    }
  }
  return NextResponse.json({ ok: true });
}
