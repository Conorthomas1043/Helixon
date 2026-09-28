"use client";

import { Suspense } from "react";
import DashboardNav from "@/components/DashboardNav";
import CompareWorkspace from "../_components/CompareView";

// useSearchParams() (?ids= / ?jobId=) needs a Suspense boundary in the app
// router, or static prerendering fails the build - same as app/analyse.
function CompareFallback() {
  return (
    <main className="min-h-screen bg-[var(--mist)]">
      <DashboardNav />
    </main>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<CompareFallback />}>
      <CompareWorkspace />
    </Suspense>
  );
}
