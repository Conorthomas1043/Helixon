import { supabase } from "@/lib/supabase";
import { rateLimit, getClientIp } from "@/lib/ratelimit";
import { memberForToken } from "@/lib/member-tokens";
import { buildFeed } from "@/lib/ics";
import { INTERVIEW_KINDS } from "@/lib/interviews";
import { siteUrl } from "@/lib/mailer";

// GET /api/calendar/<token>.ics - a person's interviews as a calendar feed
// (lib/member-tokens.js). Calendar apps poll it without signing in, so the
// token is the only credential; ?scope=team adds the whole team's. Past 60
// days to a year ahead.

export async function GET(request, { params }) {
  const raw = String((await params).token || "").replace(/\.ics$/i, "");
  if (!(await rateLimit(`calendar-feed:${getClientIp(request)}`, 240))) return new Response("Too many requests", { status: 429 });
  const member = await memberForToken(raw, "calendar");
  if (!member) return new Response("Not found", { status: 404 });
  const team = new URL(request.url).searchParams.get("scope") === "team";

  const now = Date.now();
  const { data } = await supabase
    .from("interviews")
    .select("id, starts_at, duration_minutes, kind, location, interviewers, status, round, ics_sequence, created_by, candidate_id, candidates(full_name, name, recruiter_id), jobs(title, client)")
    .eq("agency_id", member.agency_id)
    .gte("starts_at", new Date(now - 60 * 86400000).toISOString())
    .lte("starts_at", new Date(now + 365 * 86400000).toISOString())
    .order("starts_at")
    .limit(2000);

  const site = siteUrl();
  const rows = (data ?? []).filter((i) => team || i.created_by === member.user_id || i.candidates?.recruiter_id === member.user_id);
  const body = buildFeed({
    name: team ? "Helixon - team interviews" : "Helixon - my interviews",
    events: rows.map((i) => {
      const who = i.candidates?.full_name || i.candidates?.name || "Candidate";
      return {
        uid: `${i.id}@helixon.co.uk`,
        sequence: i.ics_sequence,
        start: i.starts_at,
        durationMinutes: i.duration_minutes,
        summary: `Interview: ${who}${i.jobs?.title ? ` - ${i.jobs.title}` : ""}`,
        description: [
          `${INTERVIEW_KINDS[i.kind] || "Interview"}, round ${i.round}`,
          i.jobs?.client ? `Client: ${i.jobs.client}` : null,
          i.interviewers ? `Interviewers: ${i.interviewers}` : null,
          i.status === "completed" ? "Completed" : null,
        ]
          .filter(Boolean)
          .join("\n"),
        location: i.location,
        url: `${site}/dashboard/candidates/${i.candidate_id}`,
        cancelled: i.status === "cancelled",
      };
    }),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="helixon-interviews.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
