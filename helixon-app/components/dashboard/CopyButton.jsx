"use client";

// A "Copy" button that says whether it worked. A bare
// navigator.clipboard.writeText() gave no sign either way, so people
// pasted an empty clipboard into an email, or copied twice to be sure.
// When the browser blocks the clipboard (an insecure origin, a denied
// permission), it says so, so the person knows to select the text instead.
//
//   <CopyButton text={url}>Copy link</CopyButton>
//   <CopyButton text={url} plain>Copy link</CopyButton>  - a text-link style button

import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

export async function copyText(text) {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text ?? "");
    return true;
  } catch {
    return false;
  }
}

export default function CopyButton({ text, children = "Copy", plain = false, style, className = "", ...props }) {
  const [state, setState] = useState("idle");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function onClick() {
    const ok = await copyText(text);
    setState(ok ? "copied" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), ok ? 1800 : 4000);
  }

  const label = state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy - select it instead" : children;
  const live = (
    <span className="sr-only" aria-live="polite">
      {state === "copied" ? "Copied to the clipboard" : state === "failed" ? "Couldn't copy. Select the text and copy it instead." : ""}
    </span>
  );

  if (plain) {
    return (
      <button type="button" onClick={onClick} className={className} style={style} {...props}>
        {label}
        {live}
      </button>
    );
  }
  return (
    <Button onClick={onClick} className={className} style={style} {...props}>
      {label}
      {live}
    </Button>
  );
}
