import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { after } from "next/server";
import { LOG_UID_HEADER, markRequestStatus } from "@/lib/request-status";

// Rendering this means the app answered 404 - recorded against the
// request's log line so admin Traffic can list broken links.
export default async function NotFound() {
  const uid = (await headers()).get(LOG_UID_HEADER);
  if (uid) after(() => markRequestStatus(uid, 404));
  // Most 404s come from old marketing links and search results. "Go to the
  // app" was the main button for everyone, which sent visitors with no
  // account to a login screen; they now get the homepage first.
  let signedIn = false;
  try {
    signedIn = Boolean((await auth()).userId);
  } catch {
    // Outside Clerk's middleware matcher - treat as signed out.
  }
  const primary = signedIn ? { href: "/dashboard", label: "Go to your dashboard" } : { href: "/", label: "Back to homepage" };
  const secondary = signedIn ? { href: "/", label: "Back to homepage" } : { href: "/how-it-works", label: "See how Helixon works" };
  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--mist)" }}>
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-[14px] flex items-center justify-center mx-auto mb-6" style={{ background: "var(--mint)" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--forest)" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
          Page not found
        </h1>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          We scored a lot of CVs, but not whatever page you were looking for. It may have moved, or the link&apos;s out of date.
        </p>
        <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
          <Link href={primary.href} className="text-sm font-semibold px-5 py-3 rounded-[10px] text-white transition-colors" style={{ background: "var(--forest)" }}>
            {primary.label}
          </Link>
          <Link href={secondary.href} className="text-sm font-semibold px-5 py-3 rounded-[10px] transition-colors" style={{ border: "1px solid var(--border)", color: "#13201b" }}>
            {secondary.label}
          </Link>
        </div>
      </div>
    </main>
  );
}