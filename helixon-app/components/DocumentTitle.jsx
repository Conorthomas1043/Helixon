"use client";

import { useEffect } from "react";

// Sets the tab title from the browser, for pages Next can't give metadata to:
// not-found.js reads no `metadata` export, and Next writes the layout's
// default title into <head> after hydration. This re-applies the title
// whenever <head> changes while the page is open.
export default function DocumentTitle({ title }) {
  useEffect(() => {
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);
  return null;
}
