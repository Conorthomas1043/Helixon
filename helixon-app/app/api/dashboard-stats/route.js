import { NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/auth/customer-auth";
import { loadDashboardStats } from "@/lib/dashboard/stats";
import { reportError } from "@/lib/report-error";
import { SUSPENDED_MESSAGE } from "@/lib/agency/controls";

// GET /api/dashboard-stats - the dashboard home's data (lib/dashboard/stats.js).
// The page loads it on the server first; it calls this to refresh.
export async function GET() {
  const context = await getCustomerContext();
  if (!context.user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }
  // A suspended workspace is locked here as everywhere else.
  if (context.agencySuspended) {
    return NextResponse.json({ error: SUSPENDED_MESSAGE, suspended: true }, { status: 403 });
  }
  try {
    return NextResponse.json(await loadDashboardStats(context));
  } catch (err) {
    reportError("[dashboard-stats] Query failed:", err);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}
