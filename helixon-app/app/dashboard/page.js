import { getCustomerContext } from "@/lib/auth/customer-auth";
import { loadDashboardStats } from "@/lib/dashboard/stats";
import DashboardHome from "./DashboardHome";

// The dashboard home, loaded on the server so it arrives with its numbers
// instead of a skeleton followed by a second request. Same loader as GET
// /api/dashboard-stats. If it fails, DashboardHome loads the data itself and
// shows its own error state.
export default async function DashboardPage() {
  let initialStats = null;
  try {
    const context = await getCustomerContext();
    // A suspended workspace gets nothing here; the browser's own request is
    // refused with the suspension message.
    if (context.user && !context.agencySuspended) initialStats = await loadDashboardStats(context);
  } catch {
    // Fall back to loading in the browser.
  }
  return <DashboardHome initialStats={initialStats} />;
}
