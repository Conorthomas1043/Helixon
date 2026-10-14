"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClerkFailed, ClerkLoading } from "@clerk/nextjs";
import { Button, Icon } from "@/components/ui";

// What shows in place of a Clerk widget (<SignIn/>, <SignUp/>, <UserProfile/>)
// before it renders. Clerk's script comes from its own domain, so an ad
// blocker, a strict network or a slow connection can leave the card empty.
// While it loads: a skeleton the shape of the form, then after a few seconds
// a note that it is slow. If it fails: what happened and how to get past it.
// Put it next to the widget; each part renders only in its own state.

const SLOW_AFTER_MS = 6000;

function Skeleton({ label }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="w-full" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="space-y-3.5" aria-hidden="true">
        <div className="shimmer-block h-6 w-2/3 mx-auto rounded-md" />
        <div className="shimmer-block h-4 w-1/2 mx-auto rounded-md mb-5" />
        <div className="shimmer-block h-11 w-full rounded-xl" />
        <div className="shimmer-block h-11 w-full rounded-xl" />
        <div className="shimmer-block h-11 w-full rounded-xl" />
      </div>
      {slow && (
        <p className="text-13 text-center mt-5 text-[var(--ink-soft)]">
          This is taking longer than usual.{" "}
          <button type="button" onClick={() => window.location.reload()} className="font-semibold underline text-[var(--forest)]">
            Reload the page
          </button>
        </p>
      )}
    </div>
  );
}

function Failed({ what }) {
  return (
    <div className="w-full text-center" role="alert">
      <div className="w-11 h-11 mx-auto mb-4 rounded-xl flex items-center justify-center bg-[var(--ui-warn-soft)] text-[var(--ui-warn)]">
        <Icon name="alert" size={20} />
      </div>
      <h2 className="text-16 font-semibold mb-1.5 font-display text-[var(--ink)]">
        {what} couldn&rsquo;t load
      </h2>
      <p className="text-14 leading-relaxed mb-5 text-[var(--ink-soft)]">
        A browser extension or a network filter is usually the cause. Try again, or switch off your blocker for this site.
      </p>
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" onClick={() => window.location.reload()}>
          Try again
        </Button>
        <Link href="/contact" className="text-13 font-semibold text-[var(--forest)] hover:underline">
          Still stuck? Contact support
        </Link>
      </div>
    </div>
  );
}

export default function ClerkWidgetStates({ what = "Sign-in" }) {
  return (
    <>
      <ClerkLoading>
        <Skeleton label={`Loading ${what.toLowerCase()}…`} />
      </ClerkLoading>
      <ClerkFailed>
        <Failed what={what} />
      </ClerkFailed>
    </>
  );
}
