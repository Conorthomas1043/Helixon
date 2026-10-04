import { requireAdminSession } from "@/lib/admin/auth";
import { getAdminSupabase } from "@/lib/admin/supabase";
import { adminJson as json, adminErrorResponse, adminDbError } from "@/lib/admin/http";
import { cleanLine, cleanUuid } from "@/lib/sanitize";

// The admin audit trail: every privileged action (and every admin sign-in
// attempt) with who did it, to what, from where and when. Read-only - audit
// rows are never editable from the console.
//
// Filters: action, admin, targetType, target (a record's id - matches
// target_id or metadata.targetRef), from/to (dates), search (the target's
// email, and the names/IPs/values recorded in the details). export=1
// returns up to EXPORT_LIMIT matching rows in one go for CSV download.

const PAGE_SIZE = 50;
const EXPORT_LIMIT = 5000;

// Quoted PostgREST filter value: inside double quotes, commas, dots and
// parentheses are literal; only backslash and double quote need escaping.
// Keeps a search term from ever being read as filter syntax.
function quoted(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isoDate(value, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Fields searched by free text: the target's email, and the recorded names,
// IPs and values that identify a target when there's no email.
const SEARCH_COLUMNS = ["target_email", "metadata->>targetRef", "metadata->>username", "metadata->>ip", "metadata->>value", "metadata->>agencyName", "metadata->>reason"];

export async function GET(request) {
  try {
    await requireAdminSession();
    const supabase = getAdminSupabase();
    const { searchParams } = new URL(request.url);

    const exporting = searchParams.get("export") === "1";
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const action = cleanLine(searchParams.get("action"), 80);
    const admin = cleanLine(searchParams.get("admin"), 64);
    const targetType = cleanLine(searchParams.get("targetType"), 80);
    const target = cleanLine(searchParams.get("target"), 200);
    const search = cleanLine(searchParams.get("search"), 100);
    const from = isoDate(searchParams.get("from"));
    const to = isoDate(searchParams.get("to"), true);

    const build = (broadSearch) => {
      let query = supabase
        .from("admin_audit_logs")
        .select("id,admin_username,action,target_type,target_id,target_email,metadata,ip,user_agent,created_at", { count: "exact" })
        .order("created_at", { ascending: false });
      query = exporting ? query.limit(EXPORT_LIMIT) : query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      // eq()/gte() take the value as data. The two .or() filters below quote
      // every value (see quoted()), so nothing typed can become filter syntax.
      if (action) query = query.eq("action", action);
      if (admin) query = query.eq("admin_username", admin);
      if (targetType) query = query.eq("target_type", targetType);
      if (from) query = query.gte("created_at", from);
      if (to) query = query.lte("created_at", to);
      if (target) {
        query = cleanUuid(target) ? query.or(`target_id.eq.${cleanUuid(target)},metadata->>targetRef.eq.${quoted(target)}`) : query.eq("metadata->>targetRef", target);
      }
      if (search) {
        const escaped = search.replace(/[\\%_]/g, "\\$&");
        query = broadSearch
          ? query.or(SEARCH_COLUMNS.map((c) => `${c}.ilike.${quoted(`%${escaped}%`)}`).join(","))
          : query.ilike("target_email", `%${escaped}%`);
      }
      return query;
    };

    let [{ data, error, count }, facets] = await Promise.all([build(true), supabase.rpc("admin_audit_facets")]);
    // If the combined search is ever rejected, still answer with the
    // email-only search rather than an error.
    if (error && search) ({ data, error, count } = await build(false));
    if (error) return adminDbError("audit", error);

    // Facets come from the whole table via admin_audit_facets(); before
    // that migration, fall back to the actions on this page.
    const facetRows = facets.error ? [] : facets.data || [];
    const pick = (kind) => facetRows.filter((r) => r.kind === kind && r.value).map((r) => r.value).sort();
    const rows = data || [];

    return json({
      page,
      pageSize: exporting ? EXPORT_LIMIT : PAGE_SIZE,
      total: count ?? 0,
      actions: facetRows.length ? pick("action") : [...new Set(rows.map((r) => r.action))].sort(),
      admins: facetRows.length ? pick("admin") : [...new Set(rows.map((r) => r.admin_username))].sort(),
      targetTypes: pick("target_type"),
      entries: rows.map((row) => ({
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
