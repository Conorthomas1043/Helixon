"use client";

import { useEffect, useState } from "react";

/**
 * Drives a one-off "animate in when scrolled to" entrance without ever
 * hiding content that hasn't been proven safe to hide.
 *
 * Returns one of three phases:
 *   "static"  - show the finished state. This is what the server renders,
 *               what a visitor gets if JavaScript never runs or hydration
 *               fails, what reduced-motion visitors keep, and what anything
 *               already on screen at load keeps (so it never blanks and
 *               replays in front of the visitor).
 *   "armed"   - the element started off screen, so it has been switched to
 *               its starting frame while nobody can see it.
 *   "entered" - it has since scrolled into view: play the entrance. Latched,
 *               it never rewinds.
 *
 * The starting frame is only ever applied from inside an IntersectionObserver
 * callback, i.e. after hydration, and only for an element that is off
 * screen - unlike the old `.js` class set before first paint, which left
 * everything below the hero invisible whenever the page's JS failed to boot.
 *
 * `offset` shrinks the bottom of the viewport, so the entrance starts once
 * the element is that far up the screen rather than at the very edge.
 */
export default function useScrollEntrance(ref, { offset = "10%" } = {}) {
  const [phase, setPhase] = useState("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    let first = true;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (first) {
          first = false;
          const { top, bottom } = entry.boundingClientRect;
          if (top < window.innerHeight && bottom > 0) {
            obs.disconnect();
            return;
          }
          setPhase("armed");
          return;
        }
        if (entry.isIntersecting) {
          setPhase("entered");
          obs.disconnect();
        }
      },
      { rootMargin: `0px 0px -${offset} 0px` }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, offset]);

  return phase;
}
