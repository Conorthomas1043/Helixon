import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { canManageWorkspace, NOT_ADMIN } from "@/lib/workspace-admin";
import { AUDIT_ACTIONS } from "@/lib/agency-audit";

// GET ?before=<ISO>&action= - the workspace's audit log (lib/agency-audit.js),
// newest first, 100 at a time. Owner and admins only.

export const GET = customerRoute(async (request, _context, auth) => {
  if (!(await canManageWorkspace(auth))) return NextResponse.json({ error: NOT_ADMIN }, { status: 403 });
  const params = new URL(request.url).searchParams;
  let q = supabase.from("agency_audit_log").select("*").eq("agency_id", auth.agencyId).order("created_at", { ascending: false }).limit(101);
  const before = params.get("before");
  if (before && !Number.isNaN(Date.parse(before))) q = q.lt("created_at", new Date(before).toISOString());
  const action = params.get("action");
  if (action && AUDIT_ACTIONS[action]) q = q.eq("action", action);
  const { data, error } = await q;
  if (error) {
    if (["42P01", "PGRST205"].includes(error.code)) return NextResponse.json({ entries: [], unavailable: true, actions: AUDIT_ACTIONS });
    return NextResponse.json({ error: "Failed to load the audit log." }, { status: 500 });
  }
  const rows = data ?? [];
  return NextResponse.json({
    entries: rows.slice(0, 100).map((r) => ({
      id: r.id,
      at: r.created_at,
      actor: r.actor_name || r.actor_id || "Someone",
      action: r.action,
      label: AUDIT_ACTIONS[r.action] || r.action,
      summary: r.summary,
      targetType: r.target_type,
      targetId: r.target_id,
      ip: r.ip,
    })),
    more: rows.length > 100,
    actions: AUDIT_ACTIONS,
  });
});
