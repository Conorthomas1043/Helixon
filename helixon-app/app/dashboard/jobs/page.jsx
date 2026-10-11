import { requireCustomerContext } from "@/lib/auth/customer-auth";
import { listJobs } from "@/lib/jobs/list";
import JobsList from "./JobsList";

// The jobs list, loaded on the server so it arrives with the jobs instead of
// a skeleton. Same loader and checks as GET /api/jobs. If it fails, the list
// loads itself and shows its own error state.
export default async function JobsPage() {
  let initialJobs = null;
  try {
    const auth = await requireCustomerContext();
    if (auth.ok) initialJobs = await listJobs(auth);
  } catch {
    // Fall back to loading in the browser.
  }
  return <JobsList initialJobs={initialJobs} />;
}
