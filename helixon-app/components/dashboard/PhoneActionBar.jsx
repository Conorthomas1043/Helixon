"use client";

// A page's main actions, fixed above the phone tab bar so they're one tap
// away however far down a long page you are (Screen a CV, the report, the
// candidate profile). Phones only. With `watchId`, it appears only while the
// page's own copy of those actions (the element with that id) is out of
// view, so they're never on screen twice. Renders a spacer where it's
// placed, at the end of the page, so the bar never covers the last content.

import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

export default function PhoneActionBar({ watchId = null, label, children }) {
  const [hidden, setHidden] = useState(!!watchId);

  useEffect(() => {
    if (!watchId) return undefined;
    let observer;
    // A tick later, so the watched element has rendered.
    const t = setTimeout(() => {
      const el = document.getElementById(watchId);
      if (!el) {
        setHidden(false);
        return;
      }
      observer = new IntersectionObserver(([entry]) => setHidden(entry.isIntersecting), { threshold: 0.5 });
      observer.observe(el);
    }, 0);
    return () => {
      clearTimeout(t);
      observer?.disconnect();
    };
  }, [watchId]);

  return (
    <>
      <div className="md:hidden h-20 print-hide" aria-hidden="true" />
      <div
        role="region"
        aria-label={label}
        inert={hidden}
        className={cx(
          "print-hide md:hidden fixed inset-x-0 bottom-[var(--tabbar-h)] z-30 border-t border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur px-4 py-2.5",
          "flex items-center gap-2 transition-[transform,opacity] duration-200 motion-reduce:transition-none",
          hidden ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100",
        )}
      >
        {children}
      </div>
    </>
  );
}
