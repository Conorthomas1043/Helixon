"use client";

import { Suspense } from "react";
import DashboardNav from "@/components/DashboardNav";
import AnalyseWorkspace from "./AnalyseWorkspace";

// useSearchParams() (for ?jobId= and ?mode=bulk links) needs a Suspense
// boundary in the app router, or static prerendering fails the build.
function AnalyseFallback() {
  return (
    <main className="min-h-screen bg-[var(--mist)]">
      <DashboardNav />
    </main>
  );
}

export default function AnalysePage() {
  return (
    <Suspense fallback={<AnalyseFallback />}>
      <AnalyseWorkspace />
    </Suspense>
  );
}
