import { isIP } from "node:net";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin/http";
import { enumerateIp, neighbourhood } from "@/lib/security/ip-intel";
import { getFirewallRules, matchRange, blockIsActive } from "@/lib/security/rules";
import { scoreRequest } from "@/lib/security/threat-score";
import { decodePlace } from "@/lib/admin/traffic";

// The IP dossier (Admin > Investigate): everything we know about one IP.
//   - activity: totals across all logged requests
//   - requests: its "conversation" with the site, newest first, paged with
//     ?before=<timestamp>
//   - intel: the cached passive enumeration (lib/security/ip-intel.js), if
//     any, with intelStale when it's over a day old
//   - neighbours: other IPs seen from the same /24 (or IPv6 /64)
//   - status: blocked, allow-listed, in a blocked range, findings dismissed
// ?part=intel runs the enumeration itself (when the cache is stale, or
// always with &refresh=1) and returns just that. It's separate because the
// registries can take a few seconds to answer, and the rest of the dossier
// shouldn't wait for them.
// Read-only; blocking and allow-listing go through the firewall APIs.

const PAGE = 300;
const INTEL_TTL_MS = 24 * 60 * 60 * 1000;
const TIMELINE_COLUMNS =
  "id,ts,method,path,query,host,user_agent,referer,country,city,region,blocked,outcome,status_code,location,rule,threat_score,signals";

const isStale = (fetchedAt) => !fetchedAt || Date.now() - Date.parse(fetchedAt) > INTEL_TTL_MS;

async function lookUp(supabase, ip, refresh) {
  const cached = await supabase.from("ip_intel").select("data,fetched_at").eq("ip", ip).maybeSingle();
  if (!refresh && cached.data && !isStale(cached.data.fetched_at)) return { intel: cached.data.data, intelFetchedAt: cached.data.fetched_at };
  // The user agents it has sent let enumerateIp check any crawler it claims to be.
  const { data: recent } = await supabase.from("request_logs").select("user_agent").eq("ip", ip).order("ts", { ascending: false }).limit(300);
  const userAgents = [...new Set((recent || []).map((r) => r.user_agent).filter(Boolean))].slice(0, 20);
  const intel = await enumerateIp(ip, { userAgents });
  await supabase.from("ip_intel").upsert({ ip, data: intel, fetched_at: intel.fetchedAt }, { onConflict: "ip" });
  return { intel, intelFetchedAt: intel.fetchedAt };
}

function isoOrNull(value) {
  const t = Date.parse(value || "");
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export async function GET(request, { params }) {
  try {
    await requireAdminSession();
    const { ip: raw } = await params;
    const ip = decodeURIComponent(raw || "").trim();
    if (!isIP(ip)) return json({ error: "That isn't a valid IP address." }, 400);

    const { searchParams } = new URL(request.url);
    const before = isoOrNull(searchParams.get("before"));
    const supabase = getAdminSupabase();

    if (searchParams.get("part") === "intel") {
      return json({ ok: true, ip, ...(await lookUp(supabase, ip, searchParams.get("refresh") === "1")) });
    }

    let timelineQuery = supabase.from("request_logs").select(TIMELINE_COLUMNS).eq("ip", ip).order("ts", { ascending: false }).limit(PAGE);
    if (before) timelineQuery = timelineQuery.lt("ts", before);

    // Other IPs from the same network block over the last 30 days (first page only).
    const cidr = before ? null : neighbourhood(ip);
    const [activity, timeline, blockRow, allowRule, dismissal, cached, rules, nearby] = await Promise.all([
      supabase.rpc("admin_ip_activity", { p_ip: ip }),
      timelineQuery,
      supabase.from("blocked_ips").select("ip,reason,created_by,created_at,expires_at").eq("ip", ip).maybeSingle(),
      supabase.from("firewall_rules").select("id,note,created_by,created_at,expires_at").eq("kind", "allow_ip").eq("value", ip).maybeSingle(),
      supabase.from("threat_dismissals").select("reason,dismissed_by,dismissed_at").eq("ip", ip).maybeSingle(),
      supabase.from("ip_intel").select("data,fetched_at").eq("ip", ip).maybeSingle(),
      getFirewallRules({ fresh: true }),
      cidr ? supabase.rpc("admin_ip_neighbours", { p_cidr: cidr, p_since: new Date(Date.now() - 30 * 86400e3).toISOString() }) : null,
    ]);
    if (timeline.error) return adminDbError("ip", timeline.error);

    // Older rows predate stored scores; score them the same way on the fly.
    const requests = (timeline.data || []).map((row) => {
      const place = { ...row, city: decodePlace(row.city) };
      if (row.threat_score !== null && row.threat_score !== undefined) return place;
      const threat = scoreRequest(row);
      return { ...place, threat_score: threat.score, signals: threat.signals };
    });

    const neighbours = nearby && !nearby.error ? { cidr, ips: (nearby.data || []).filter((n) => n.ip !== ip) } : null;

    const summary = (activity.data || [])[0] || null;
    return json({
      ok: true,
      ip,
      activity: summary && Number(summary.requests) > 0 ? summary : null,
      requests,
      cursor: requests.length === PAGE ? requests[requests.length - 1].ts : null,
      intel: cached.data?.data || null,
      intelFetchedAt: cached.data?.fetched_at || null,
      intelStale: isStale(cached.data?.fetched_at),
      neighbours,
      status: {
        blocked: blockIsActive(blockRow.data) ? blockRow.data : null,
        // Same expiry rule as blocks: a lapsed allow-list entry no longer applies.
        allowListed: blockIsActive(allowRule.data) ? allowRule.data : null,
        dismissed: dismissal.data || null,
        blockedRange: matchRange(rules, ip),
      },
    });
  } catch (error) {
    return adminErrorResponse("ip", error);
  }
}
