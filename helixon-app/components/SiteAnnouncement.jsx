"use client";
// components/SiteAnnouncement.jsx
// The announcement bar an admin sets on /admin/site. Shown at the top of
// every public page (not the admin console or staff portal); a visitor can
// dismiss it, and it comes back if the text changes.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSiteSettings } from "./useSiteSettings";

const HIDDEN_ON = ["/admin", "/employee", "/under-development"];
const DISMISS_KEY = "helixon_announcement_dismissed";

const TONE_STYLES = {
  info: { background: "var(--forest)", color: "#ffffff" },
  warn: { background: "#fff4d6", color: "var(--ink)", borderBottom: "1px solid #f0d58c" },
  success: { background: "var(--mint)", color: "var(--forest)", borderBottom: "1px solid var(--border)" },
};

function readDismissed() {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

export default function SiteAnnouncement() {
  const pathname = usePathname() || "";
  const settings = useSiteSettings();
  const [dismissed, setDismissed] = useState(readDismissed);

  const a = settings?.announcement;
  if (!a?.text || HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  if (dismissed === a.text) return null;

  function dismiss() {
    setDismissed(a.text);
    try {
      window.localStorage.setItem(DISMISS_KEY, a.text);
    } catch {
      /* private mode - it just comes back next visit */
    }
  }

  const external = /^https?:/i.test(a.linkUrl || "");
  return (
    <div role="region" aria-label="Announcement" className="w-full text-[13.5px]" style={TONE_STYLES[a.tone] || TONE_STYLES.info}>
      <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-center gap-3 text-center">
        <p className="leading-snug">
          {a.text}
          {a.linkUrl && a.linkLabel && (
            <>
              {" "}
              <a href={a.linkUrl} className="font-semibold underline underline-offset-2" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {a.linkLabel}
              </a>
            </>
          )}
        </p>
        <button type="button" onClick={dismiss} aria-label="Dismiss announcement" className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center opacity-80 hover:opacity-100">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
