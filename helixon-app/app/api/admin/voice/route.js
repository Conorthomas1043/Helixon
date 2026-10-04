import { requireAdminSession } from "@/lib/admin/auth";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin/http";
import { FEEDBACK_DOWN_REASONS } from "@/app/analyse/_lib/analyse";

// /admin/voice - everything customers tell Helixon, in one place
// (docs/ux-research-audit.md, R8): score disagreements, the pulse survey,
// cancellation reasons, chat-assistant questions, what demo leads want to
// solve, and who's opted in to research. Read-only. Free text arrives
// already scrubbed of contact details (lib/research-signals.js).
const DAY = 86400000;
const RANGE_DAYS = { "30d": 30, "90d": 90, "365d": 365 };

function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = typeof key === "function" ? key(r) : r[key];
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].map(([label, count]) => ({ name: label, label, count })).sort((a, b) => b.count - a.count);
}

export async function GET(request) {
  try {
    await requireAdminSession();
    const supabase = getAdminSupabase();
    const range = new URL(request.url).searchParams.get("range") || "90d";
    const since = new Date(Date.now() - (RANGE_DAYS[range] || 90) * DAY).toISOString();

    const [feedback, signals, demos, agencies] = await Promise.all([
      supabase.from("feedback").select("rating, comment, agency_id, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
      supabase.from("research_signals").select("kind, label, body, score, meta, agency_id, profile_id, created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
      supabase.from("demo_requests").select("company, message, created_at").gte("created_at", since).not("message", "is", null).order("created_at", { ascending: false }).limit(200),
      supabase.from("agencies").select("id, name"),
    ]);
    if (feedback.error) return adminDbError("voice feedback", feedback.error);
    if (demos.error) return adminDbError("voice demos", demos.error);
    const signalsMissing = signals.error && (signals.error.code === "42P01" || signals.error.code === "PGRST205");
    if (signals.error && !signalsMissing) return adminDbError("voice signals", signals.error);

    const agencyName = new Map((agencies.data || []).map((a) => [a.id, a.name]));
    const named = (r) => ({ ...r, agency: r.agency_id ? agencyName.get(r.agency_id) || "Unknown agency" : null });
    const fb = feedback.data || [];
    const down = fb.filter((f) => f.rating === "down");
    const sig = signalsMissing ? [] : signals.data || [];
    const ofKind = (k) => sig.filter((s) => s.kind === k).map(named);

    const pulses = ofKind("pulse_survey");
    const umux = pulses.map((p) => p.meta?.umuxLite).filter((n) => typeof n === "number");
    const known = new Set(FEEDBACK_DOWN_REASONS);

    return json({
      range,
      signalsAvailable: !signalsMissing,
      scores: {
        total: fb.length,
        up: fb.length - down.length,
        down: down.length,
        reasons: countBy(down, (f) => (known.has(f.comment) ? f.comment : f.comment ? "Other (written)" : "No reason given")),
        recent: down.filter((f) => f.comment && !known.has(f.comment)).slice(0, 30).map(named),
      },
      pulse: {
        responses: pulses.length,
        umuxLite: umux.length ? Math.round((umux.reduce((a, b) => a + b, 0) / umux.length) * 10) / 10 : null,
        comments: pulses.filter((p) => p.body).slice(0, 30),
      },
      cancellations: { reasons: countBy(ofKind("cancellation_reason"), "label"), recent: ofKind("cancellation_reason").filter((c) => c.body).slice(0, 30) },
      questions: { topics: countBy(ofKind("assistant_question"), "label"), recent: ofKind("assistant_question").slice(0, 40) },
      demoProblems: (demos.data || []).slice(0, 40),
      optIns: await currentOptIns(supabase, ofKind("research_optin")),
    });
  } catch (err) {
    return adminErrorResponse("voice", err);
  }
}

// Latest answer per person wins, so turning it off in Settings removes them.
// Demo-form opt-ins have no account; they point at the lead instead.
async function currentOptIns(supabase, rows) {
  const latest = new Map();
  for (const r of rows) {
    const key = r.profile_id || `demo:${r.meta?.demoRequestId || r.created_at}`;
    if (!latest.has(key)) latest.set(key, r);
  }
  const active = [...latest.values()].filter((r) => r.label !== "withdrawn").slice(0, 100);
  const ids = active.map((r) => r.profile_id).filter(Boolean);
  const { data: people } = ids.length
    ? await supabase.from("profiles").select("id, first_name, last_name").in("id", ids)
    : { data: [] };
  const nameOf = new Map((people || []).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(" ") || "Team member"]));
  return active.map((r) => ({
    source: r.label,
    agency: r.agency,
    person: r.profile_id ? nameOf.get(r.profile_id) || "Team member" : "Demo lead (see Leads)",
    createdAt: r.created_at,
  }));
}
