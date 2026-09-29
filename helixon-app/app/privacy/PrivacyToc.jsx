"use client";

// Sticky "On this page" list for the privacy policy, highlighting the
// section being read (same pattern as the DPA's), plus a print button.
// The page itself stays a server component; only this is interactive.

import { useEffect, useMemo, useState } from "react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 font-semibold print:hidden"
      style={{ color: "var(--forest)" }}
    >
      Print or save as PDF
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 3v13m0 0-4-4m4 4 4-4M5 21h14" />
      </svg>
    </button>
  );
}

// The section being read: the last one whose heading has scrolled past
// just below the sticky nav (sections are jumped to with a scroll margin,
// so they land a little lower than the nav itself).
function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 220) current = id;
      }
      // At the very bottom, the last (short) sections can never reach the
      // line - light up the last one.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = ids[ids.length - 1];
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

export default function PrivacyToc({ sections }) {
  const ids = useMemo(() => sections.map((s) => s.id), [sections]);
  const active = useActiveSection(ids);
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Phones and tablets: a collapsible bar under the nav. */}
      <div className="lg:hidden -mx-6 mb-6 bg-white border-y shadow-[0_6px_16px_-12px_rgba(19,32,27,0.35)] print:hidden" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="w-full px-6 py-3 flex items-center justify-between text-xs font-semibold"
          style={{ color: "var(--ink)" }}
        >
          On this page
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {open && (
          <div className="px-6 pb-3 flex flex-col gap-0.5 max-h-72 overflow-y-auto">
            {sections.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} onClick={() => setOpen(false)} className="text-xs py-1.5" style={{ color: active === s.id ? "var(--forest)" : "var(--ink-soft)", fontWeight: active === s.id ? 600 : 400 }}>
                {i + 1}. {s.title}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: sticky side list. */}
      <nav aria-label="On this page" className="hidden lg:block sticky top-[88px] max-h-[calc(100vh-110px)] overflow-y-auto pr-2 print:hidden">
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--ink-faint)" }}>
          On this page
        </p>
        {sections.map((s, i) => {
          const on = active === s.id;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex gap-2 text-[12.5px] py-1.5 pl-3 border-l-2 transition-colors leading-snug hover:text-[var(--ink)]"
              style={{ borderColor: on ? "var(--forest)" : "var(--border)", color: on ? "var(--forest)" : "var(--ink-soft)", fontWeight: on ? 600 : 400 }}
            >
              <span className="tabular-nums w-4 shrink-0" style={{ color: on ? "var(--forest)" : "var(--ink-faint)" }}>
                {i + 1}
              </span>
              {s.title}
            </a>
          );
        })}
      </nav>
    </>
  );
}
