"use client";

// Fallback for an unexpected error inside one area of the app (re-exported
// by each area's error.js). The area's layout and navigation stay on screen,
// so people can retry or go elsewhere instead of losing the whole page.

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function RouteError({ error, retry, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const tryAgain = retry || reset;

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16" style={{ background: "var(--mist)" }}>
      <div
        role="alert"
        className="w-full max-w-md text-center p-8"
        style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)" }}
      >
        <h1 className="text-lg font-semibold mb-2" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          This page didn&apos;t load
        </h1>
        <p className="text-[15px] leading-relaxed mb-6" style={{ color: "var(--ink-soft)" }}>
          Something went wrong on our side. Nothing you saved has been lost. Try again, and if it keeps happening,
          contact support{error?.digest ? <> and quote <code className="font-mono">{error.digest}</code></> : null}.
        </p>
        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-center">
          <Link
            href="/"
            className="px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-btn)", color: "var(--ink)" }}
          >
            Go to the homepage
          </Link>
          {tryAgain && (
            <button
              type="button"
              onClick={() => tryAgain()}
              className="px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "var(--forest)", borderRadius: "var(--radius-btn)" }}
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
