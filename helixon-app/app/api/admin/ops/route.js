import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAdminOpsData, OPS_RANGE_HOURS } from "../../../../lib/ops/admin-data";
import { reportError } from "@/lib/report-error";

// Uses requireAdminSession(), like every other /api/admin/* route: the admin
// login (lib/admin/auth.js) only issues the httpOnly helixon_admin_session
// cookie, never a Supabase token. Called by the sales, ops, seo and
// security/investigate pages.
// ?range=24h|7d|30d|90d limits the request/lead data to that window (see
// getAdminOpsData); without it the newest rows are used.
export async function GET(request) {
  try {
    await requireAdminSession();
    const range = new URL(request.url).searchParams.get("range");
    return NextResponse.json(await getAdminOpsData({ range: OPS_RANGE_HOURS[range] ? range : null }));
  } catch (error) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    reportError("Admin ops data error", error);
    return NextResponse.json({ error: "Unable to load operational data" }, { status: 500 });
  }
}
