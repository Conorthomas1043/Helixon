import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";
import { cronAuthorized } from "@/lib/cron-auth";
import { applyFilters, readFilters, resolveFilters } from "@/lib/candidate-query";
import { searchHref } from "@/lib/saved-searches";
import { sendAgencyEmail, mailConfigured, siteUrl } from "@/lib/mailer";

// Weekday-morning "new matches" emails for saved searches with alerts on:
// for each, the candidates added since the last alert that match it. One
// email per person, listing each of their searches with new people.
// Suspended workspaces and people no longer in the agency are skipped.

export const maxDuration = 300;

export async function GET(request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mailConfigured()) return NextResponse.json({ ok: false, error: "Email isn't configured." }, { status: 503 });

  const { data: searches, error } = await supabase
    .from("saved_searches")
    .select("id, agency_id, user_id, name, params, last_alerted_at, created_at, agencies(suspended_at)")
    .eq("alert", true)
    .limit(2000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const now = new Date().toISOString();
  const byUser = new Map();
  for (const s of searches ?? []) {
    if (s.agencies?.suspended_at) continue;
    const since = s.last_alerted_at || s.created_at;
    const { resolved, error: e } = await resolveFilters(s.agency_id, readFilters(s.params || {}));
    if (e) continue;
    const { data: rows, count } = await applyFilters(
      supabase.from("candidates").select("id, full_name, name, current_title, location", { count: "exact" }).eq("agency_id", s.agency_id).gt("created_at", since),
      resolved
    )
      .order("created_at", { ascending: false })
      .limit(5);
    await supabase.from("saved_searches").update({ last_alerted_at: now }).eq("id", s.id);
    if (!count) continue;
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, { agencyId: s.agency_id, items: [] });
    byUser.get(s.user_id).items.push({ search: s, count, rows: rows ?? [] });
  }

  const userIds = [...byUser.keys()];
  const { data: profiles } = userIds.length ? await supabase.from("profiles").select("clerk_user_id, agency_id").in("clerk_user_id", userIds) : { data: [] };
  const agencyOf = new Map((profiles ?? []).map((p) => [p.clerk_user_id, p.agency_id]));
  const client = userIds.length ? await clerkClient() : null;
  let sent = 0;
  for (const [userId, { agencyId, items }] of byUser) {
    if (agencyOf.get(userId) !== agencyId) continue;
    const user = await client.users.getUser(userId).catch(() => null);
    const to = user?.primaryEmailAddress?.emailAddress;
    if (!to) continue;
    const total = items.reduce((n, i) => n + i.count, 0);
    const lines = [`Hi${user.firstName ? ` ${user.firstName}` : ""},`, "", `${total} new candidate${total === 1 ? "" : "s"} match your saved searches:`, ""];
    for (const i of items) {
      lines.push(`${i.search.name} - ${i.count} new`);
      for (const r of i.rows) lines.push(`  • ${r.full_name || r.name || "Candidate"}${r.current_title ? `, ${r.current_title}` : ""}${r.location ? ` (${r.location})` : ""}`);
      lines.push(`  ${siteUrl()}${searchHref({ ...(i.search.params || {}), sortBy: "newest" })}`, "");
    }
    lines.push("Turn these off from the saved search on the Candidates page.");
    const res = await sendAgencyEmail({ agencyId, to, replyTo: null, fromName: "Helixon", subject: `${total} new match${total === 1 ? "" : "es"} for your saved searches`, text: lines.join("\n") });
    if (!res.error) sent += 1;
  }
  return NextResponse.json({ ok: true, searches: (searches ?? []).length, emailed: sent });
}
