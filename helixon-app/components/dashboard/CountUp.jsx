"use client";

import { useEffect, useRef, useState } from "react";
import useReducedMotion from "@/lib/hooks/useReducedMotion";

// Animates a number counting up to `value` whenever it changes - used for
// KPI figures so a refreshed dashboard feels alive instead of just
// snapping to a new number. Non-numeric values (e.g. "-" for "no data
// yet") pass straight through unanimated, never touching `display` state.
// Duration is deliberately short (600ms) and eases out, so it reads as a
// quick "live" tick rather than a slot-machine effect.
export default function CountUp({ value, duration = 600, format }) {
  const reducedMotion = useReducedMotion();
  const isNumeric = typeof value === "number" && Number.isFinite(value);
  const [display, setDisplay] = useState(isNumeric ? value : 0);
  const fromRef = useRef(isNumeric ? value : 0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isNumeric) return undefined;

    if (reducedMotion) {
      setDisplay(value);
      fromRef.current = value;
      return undefined;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) return undefined;

    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-runs when the target value itself changes, not on every render
  }, [value, isNumeric, reducedMotion, duration]);

  if (!isNumeric) return value;
  return format ? format(display) : display.toLocaleString("en-GB");
}
