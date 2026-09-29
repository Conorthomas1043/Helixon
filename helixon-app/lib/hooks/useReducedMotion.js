"use client";

import { useEffect, useState } from "react";

// Every dashboard/analyse animation imports this one instead of
// re-implementing it. (The landing page's scroll entrances check the media
// query once, inside lib/hooks/useScrollEntrance.)
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
