"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TooManyRequestsPage from "@/components/landing/TooManyRequestsPage";

function RateLimitedContent() {
  const searchParams = useSearchParams();
  const retryParam = searchParams.get("retry");
  const retryAfterSeconds = retryParam ? parseInt(retryParam, 10) : null;

  return (
    <TooManyRequestsPage
      retryAfterSeconds={
        Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds
          : null
      }
    />
  );
}

export default function RateLimitedRoute() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <RateLimitedContent />
    </Suspense>
  );
}