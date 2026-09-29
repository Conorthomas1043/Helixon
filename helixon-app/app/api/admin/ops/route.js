import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminOpsData, OPS_RANGE_HOURS } from "../../../../lib/ops/admin-data";

// Was previously gated by isAllowedAdmin(), a second, separately-implemented
// auth check expecting a Supabase Bearer token - but the real admin login
// (lib/admin-auth.js) is a hardcoded-credential system that only ever
// produces the httpOnly helixon_admin_session cookie, never a Supabase
// token. That meant every admin, on every load, got 403'd on the four pages
// that call this route (sales, ops, seo, security/investigate) - a wiring
// bug, not a missing feature. Swapped to the same requireAdminSession() used
// by every other /api/admin/* route, which reads that cookie correctly.
// ?range=24h|7d|30d|90d limits the request/lead data to that window (see
// getAdminOpsData); without it the newest rows are used, as before.
export async function GET(request) {
  try {
    await requireAdminSession();
    const range = new URL(request.url).searchParams.get("range");
    return NextResponse.json(await getAdminOpsData({ range: OPS_RANGE_HOURS[range] ? range : null }));
  } catch (error) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Admin ops data error", error);
    return NextResponse.json({ error: "Unable to load operational data" }, { status: 500 });
  }
}
