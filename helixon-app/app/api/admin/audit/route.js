import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminSupabase } from "@/lib/admin-supabase";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin-http";
import { cleanLine } from "@/lib/sanitize";

// The admin audit trail: every privileged action (and every admin sign-in
// attempt) with who did it, to what, from where and when. Read-only - audit
// rows are never editable from the console.

const PAGE_SIZE = 50;

export async function GET(request) {
  try {
    await requireAdminSession();
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const action = cleanLine(searchParams.get("action"), 80);
    const admin = cleanLine(searchParams.get("admin"), 64);
    const search = cleanLine(searchParams.get("search"), 100);

    let query = supabase
      .from("admin_audit_logs")
      .select("id,admin_username,action,target_type,target_id,target_email,metadata,ip,user_agent,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    // eq() takes the value as data - nothing here is interpolated into a filter
    // string.
    if (action) query = query.eq("action", action);
    if (admin) query = query.eq("admin_username", admin);
    if (search) {
      const escaped = search.replace(/[\\%_]/g, "\\$&");
      query = query.ilike("target_email", `%${escaped}%`);
    }

    const [{ data, error, count }, facets] = await Promise.all([
      query,
      // Small distinct lists for the filter dropdowns.
      supabase.from("admin_audit_logs").select("action,admin_username").order("created_at", { ascending: false }).limit(2000),
    ]);
    if (error) return adminDbError("audit", error);
    if (facets.error) return adminDbError("audit", facets.error);

    const actions = [...new Set((facets.data || []).map((r) => r.action))].sort();
    const admins = [...new Set((facets.data || []).map((r) => r.admin_username))].sort();

    return json({
      page,
      pageSize: PAGE_SIZE,
      total: count ?? 0,
      actions,
      admins,
      entries: (data || []).map((row) => ({
        id: row.id,
        at: row.created_at,
        admin: row.admin_username,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        targetEmail: row.target_email,
        metadata: row.metadata || {},
        ip: row.ip,
        userAgent: row.user_agent,
      })),
    });
  } catch (error) {
    return adminErrorResponse("audit", error);
  }
}
