import { useState } from "react";

// "Now", read once when the component mounts. Calling Date.now() while
// rendering gives a different answer every render (and on the server vs the
// browser), which React flags as impure; components that only need "now"
// to compare dates against - overdue, in the last day - use this instead.
export function useNow() {
  const [now] = useState(() => Date.now());
  return now;
}
