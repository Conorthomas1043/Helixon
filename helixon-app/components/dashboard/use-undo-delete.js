"use client";

// Delete with an Undo toast instead of a confirm box: the item disappears
// at once, and the delete is only sent once the toast has gone (6 seconds)
// - Undo puts it back and nothing is sent. Pending deletes are sent straight
// away if the page is left or closed, so nothing is silently kept.
//
//   const undoable = useUndoDelete(toast);   // toast from useToasts()
//   undoable({ key, message, hide, restore, commit });
//
// hide()/restore() update local state; commit() makes the request and
// throws on failure (the item is then restored with an error toast).

import { useCallback, useEffect, useRef } from "react";

const DELAY = 6000;

export function useUndoDelete(toast) {
  const pending = useRef(new Map());

  const flush = useCallback(() => {
    const all = [...pending.current.values()];
    pending.current.clear();
    for (const p of all) {
      clearTimeout(p.timer);
      p.run();
    }
  }, []);

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return useCallback(
    ({ key, message, hide, restore, commit }) => {
      hide();
      const run = async () => {
        pending.current.delete(key);
        try {
          await commit();
        } catch (err) {
          restore();
          toast(err?.message || "Couldn't delete that - it's been put back.", "error");
        }
      };
      const timer = setTimeout(run, DELAY);
      pending.current.set(key, { timer, run });
      toast(message, "ok", {
        duration: DELAY,
        action: {
          label: "Undo",
          onClick: () => {
            if (!pending.current.has(key)) return;
            clearTimeout(timer);
            pending.current.delete(key);
            restore();
          },
        },
      });
    },
    [toast]
  );
}
