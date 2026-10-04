import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { verifyCsrf, CSRF_REJECTION } from "@/lib/admin/csrf";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { writeAdminAuditSafe as writeAdminAudit } from "@/lib/admin/audit";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin/http";
import { cleanLine, cleanText, cleanUuid } from "@/lib/sanitize";
import { salesNotificationEmail } from "@/lib/demo-notification";
import { reportError } from "@/lib/report-error";

// Demo-request pipeline: everyone who filled in the "Get a demo" form, with
// where they came from, plus the sales workflow on top (PATCH): a status
// (new -> contacted -> qualified -> won/lost, or spam), an owner, notes,
// and resending a notification email that failed. Every change is audited.
// The contact form only sends an email and stores nothing, so it isn't here.

const DAY = 24 * 60 * 60 * 1000;
const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 };
const LEAD_STATUSES = ["new", "contacted", "qualified", "won", "lost", "spam"];
const PIPELINE_COLUMNS = "status,owner,notes,updated_at,contacted_at";
const BASE_COLUMNS = "id,created_at,name,email,company,message,utm_source,utm_medium,utm_campaign,referrer,email_sent";

function sourceOf(row) {
  if (row.utm_source) return row.utm_source;
  if (row.referrer) {
    try {
      const host = new URL(row.referrer).hostname.replace(/^www\./, "");
      // A referrer from our own site (someone clicking through from another
      // page to the demo form) says nothing about where they found us.
      if (host === "helixon.co.uk" || host.endsWith(".helixon.co.uk") || host === "localhost") return "direct";
      return host;
    } catch {
      return "referral";
    }
  }
  return "direct";
}

export async function GET(request) {
  try {
    const admin = await requireAdminSession();
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);

    const range = searchParams.get("range") || "all";
    const search = cleanLine(searchParams.get("search"), 80).toLowerCase();

    const build = (columns) => {
      let query = supabase.from("demo_requests").select(columns).order("created_at", { ascending: false }).limit(2000);
      if (RANGE_DAYS[range]) query = query.gte("created_at", new Date(Date.now() - RANGE_DAYS[range] * DAY).toISOString());
      return query;
    };
    const { data, error } = await build(`${BASE_COLUMNS},${PIPELINE_COLUMNS}`);
    if (error) return adminDbError("leads", error);

    let rows = (data || []).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      name: row.name,
      email: row.email,
      company: row.company,
      message: row.message,
      source: sourceOf(row),
      medium: row.utm_medium,
      campaign: row.utm_campaign,
      emailSent: row.email_sent,
      status: row.status || "new",
      owner: row.owner || null,
      notes: row.notes || "",
      updatedAt: row.updated_at || null,
      contactedAt: row.contacted_at || null,
    }));

    if (search) {
      rows = rows.filter((r) =>
        [r.name, r.email, r.company, r.message, r.source, r.owner, r.notes].some((v) => (v || "").toLowerCase().includes(search)),
      );
    }

    const now = Date.now();
    const real = rows.filter((r) => r.status !== "spam");
    const bySource = new Map();
    for (const r of real) bySource.set(r.source, (bySource.get(r.source) || 0) + 1);
    const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, rows.filter((r) => r.status === s).length]));
    const decided = byStatus.won + byStatus.lost;

    return json({
      admin: { username: admin.username },
      summary: {
        total: real.length,
        last7d: real.filter((r) => now - Date.parse(r.createdAt) < 7 * DAY).length,
        last30d: real.filter((r) => now - Date.parse(r.createdAt) < 30 * DAY).length,
        // A lead whose notification email never went out is one nobody was told about.
        notEmailed: real.filter((r) => r.emailSent === false).length,
        untouched: byStatus.new,
        winRate: decided ? Math.round((byStatus.won / decided) * 100) : null,
        byStatus,
        topSources: [...bySource.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
      },
      leads: rows,
    });
  } catch (error) {
    return adminErrorResponse("leads", error);
  }
}

//   { id, status?, owner?, notes? }       update the pipeline fields
//   { id, action: "resend_notification" }  email the sales inbox again
//   { id, action: "invite" }               email them a Helixon sign-up invitation (Clerk)
export async function PATCH(request) {
  try {
    const admin = await requireAdminSession();
    if (!verifyCsrf(request)) return json(CSRF_REJECTION, 403);
    const supabase = getAdminSupabase();
    const body = (await request.json().catch(() => null)) || {};
    const leadId = cleanUuid(body.id);
    if (!leadId) return json({ error: "A valid lead id is required." }, 400);

    const { data: lead, error } = await supabase.from("demo_requests").select(BASE_COLUMNS).eq("id", leadId).maybeSingle();
    if (error) return adminDbError("leads", error);
    if (!lead) return json({ error: "Lead not found." }, 404);

    if (body.action === "resend_notification") {
      if (!process.env.RESEND_API_KEY) return json({ error: "Email isn't configured on the server (RESEND_API_KEY)." }, 409);
      try {
        await new Resend(process.env.RESEND_API_KEY).emails.send(salesNotificationEmail(lead, { resent: true }));
      } catch (err) {
        reportError("[admin/leads] Resend failed:", err?.message || err);
        return json({ error: "The email didn't send. Check the Resend dashboard and try again." }, 502);
      }
      await supabase.from("demo_requests").update({ email_sent: true }).eq("id", leadId);
      await writeAdminAudit({ adminUsername: admin.username, action: "lead_resend_notification", targetType: "lead", targetId: leadId, targetEmail: lead.email, metadata: { name: lead.name }, request });
      return json({ ok: true });
    }

    if (body.action === "invite") {
      // A Clerk invitation: they get an email with a sign-up link, then go
      // through the normal signup (agency name, then account). No plan is
      // attached - grant demo access or send them to checkout from Users.
      const origin = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");
      try {
        const client = await clerkClient();
        await client.invitations.createInvitation({
          emailAddress: lead.email,
          redirectUrl: `${origin}/signup`,
          publicMetadata: { invited_from_lead: leadId },
          expiresInDays: 14,
        });
      } catch (err) {
        const detail = err?.errors?.[0];
        const reason = detail?.longMessage || detail?.message || err?.message || "";
        reportError("[admin/leads] Invitation failed:", reason);
        if (/already|exists|duplicate/i.test(`${detail?.code || ""} ${reason}`)) {
          return json({ error: "That email already has a Helixon account or a pending invitation." }, 409);
        }
        return json({ error: "The invitation didn't send. Try again, or check Clerk's dashboard." }, 502);
      }
      // A new lead that's been invited has been contacted.
      const now = new Date().toISOString();
      await supabase.from("demo_requests").update({ status: "contacted", updated_at: now }).eq("id", leadId).eq("status", "new");
      await supabase.from("demo_requests").update({ contacted_at: now }).eq("id", leadId).is("contacted_at", null);
      await writeAdminAudit({ adminUsername: admin.username, action: "lead_invited", targetType: "lead", targetId: leadId, targetEmail: lead.email, metadata: { name: lead.name }, request });
      return json({ ok: true });
    }

    const update = {};
    if (body.status !== undefined) {
      if (!LEAD_STATUSES.includes(body.status)) return json({ error: "Unknown status." }, 400);
      update.status = body.status;
    }
    if (body.owner !== undefined) update.owner = cleanLine(body.owner, 80) || null;
    if (body.notes !== undefined) update.notes = cleanText(body.notes, { max: 4000 }) || null;
    if (!Object.keys(update).length) return json({ error: "Nothing to change." }, 400);
    update.updated_at = new Date().toISOString();

    const { error: updateError } = await supabase.from("demo_requests").update(update).eq("id", leadId);
    if (updateError) return adminDbError("leads", updateError);
    // contacted_at is when they were *first* contacted: set once, kept after.
    if (update.status === "contacted") {
      await supabase.from("demo_requests").update({ contacted_at: update.updated_at }).eq("id", leadId).is("contacted_at", null);
    }

    await writeAdminAudit({
      adminUsername: admin.username,
      action: "lead_update",
      targetType: "lead",
      targetId: leadId,
      targetEmail: lead.email,
      // Notes can be long and personal; record that they changed, not the text.
      metadata: { name: lead.name, ...(update.status ? { status: update.status } : {}), ...("owner" in update ? { owner: update.owner } : {}), ...("notes" in update ? { notesChanged: true } : {}) },
      request,
    });
    return json({ ok: true });
  } catch (error) {
    return adminErrorResponse("leads", error);
  }
}
