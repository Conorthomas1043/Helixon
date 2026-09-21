"use client";

import { useEffect, useState } from "react";

// Shared with app/page.js's own local copy of this exact hook - that one
// is left as-is (lower risk than touching the landing page for this pass),
// but every dashboard/analyse animation added from here on imports this
// one instead of re-implementing it a third time.
export default function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
