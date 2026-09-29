import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin-http";
import { scoreRequest } from "@/lib/security/threat-score";
import { decodePlace } from "@/lib/admin-traffic";

// One request in full for the request inspector (Admin > Traffic): what
// was sent (redacted headers, query, a blocked request's body), where from,
// and what the edge did with it. Read-only.

export async function GET(request, { params }) {
  try {
    await requireAdminSession();
    const { id } = await params;
    if (!/^\d{1,19}$/.test(String(id || ""))) return json({ error: "A valid request id is required." }, 400);

    const { data, error } = await getAdminSupabase().from("request_logs").select("*").eq("id", id).maybeSingle();
    if (error) return adminDbError("traffic", error);
    if (!data) return json({ error: "That request is no longer in the log." }, 404);

    // Rows from before scores were stored get scored the same way now.
    const threat = data.threat_score !== null && data.threat_score !== undefined ? { score: data.threat_score, signals: data.signals || [] } : scoreRequest(data);
    return json({ ok: true, request: { ...data, city: decodePlace(data.city), threat_score: threat.score, signals: threat.signals } });
  } catch (error) {
    return adminErrorResponse("traffic", error);
  }
}
