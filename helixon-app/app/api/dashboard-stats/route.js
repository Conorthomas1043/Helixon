import { NextResponse } from "next/server";
import { getCustomerContext } from "@/lib/customer-auth";
import { loadDashboardStats } from "@/lib/dashboard-stats";
import { reportError } from "@/lib/report-error";

// GET /api/dashboard-stats - the dashboard home's data (lib/dashboard-stats.js).
// The page loads it on the server first; it calls this to refresh.
export async function GET() {
  const context = await getCustomerContext();
  if (!context.user) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }
  try {
    return NextResponse.json(await loadDashboardStats(context));
  } catch (err) {
    reportError("[dashboard-stats] Query failed:", err);
    return NextResponse.json({ error: "Failed to load dashboard data" }, { status: 500 });
  }
}
