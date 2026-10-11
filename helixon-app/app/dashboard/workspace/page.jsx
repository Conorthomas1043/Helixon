import { Suspense } from "react";
import DashboardNav from "@/components/DashboardNav";
import SplitWorkspace from "./SplitWorkspace";

export const metadata = { title: "Split view" };

// The split view: up to four candidates side by side (SplitWorkspace.jsx).
// Which ones, and what each pane shows, is in the address (?open=...), read
// with useSearchParams, which needs this Suspense boundary.
export default function WorkspacePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[var(--mist)]">
          <DashboardNav />
        </main>
      }
    >
      <SplitWorkspace />
    </Suspense>
  );
}
