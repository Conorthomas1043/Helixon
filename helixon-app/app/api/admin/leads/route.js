import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin-http";
import { cleanLine } from "@/lib/sanitize";

// Demo-request inbox: everyone who filled in the "Get a demo" form, newest
// first, with where they came from. Read-only. The list is built from the
// demo_requests table (the contact form only sends an email and stores
// nothing, so it isn't here).

const DAY = 24 * 60 * 60 * 1000;
const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 };

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
    await requireAdminSession();
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);

    const range = searchParams.get("range") || "all";
    const search = cleanLine(searchParams.get("search"), 80).toLowerCase();

    let query = supabase
      .from("demo_requests")
      .select("id,created_at,name,email,company,message,utm_source,utm_medium,utm_campaign,referrer,email_sent")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (RANGE_DAYS[range]) {
      query = query.gte("created_at", new Date(Date.now() - RANGE_DAYS[range] * DAY).toISOString());
    }

    const { data, error } = await query;
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
    }));

    if (search) {
      rows = rows.filter((r) =>
        [r.name, r.email, r.company, r.message, r.source].some((v) => (v || "").toLowerCase().includes(search)),
      );
    }

    const now = Date.now();
    const bySource = new Map();
    for (const r of rows) bySource.set(r.source, (bySource.get(r.source) || 0) + 1);

    return json({
      summary: {
        total: rows.length,
        last7d: rows.filter((r) => now - Date.parse(r.createdAt) < 7 * DAY).length,
        last30d: rows.filter((r) => now - Date.parse(r.createdAt) < 30 * DAY).length,
        // A lead whose notification email never went out is one nobody was told about.
        notEmailed: rows.filter((r) => r.emailSent === false).length,
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
