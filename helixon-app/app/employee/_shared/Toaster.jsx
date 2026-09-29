"use client";
// app/employee/_shared/Toaster.jsx
// Small bottom-of-screen notices for the employee portal, in place of
// window.alert()/confirm(): they don't block the page, and a destructive
// action can offer Undo instead of asking "Are you sure?" first.
//
//   const { toasts, notify, dismiss } = useToasts();
//   notify("Task deleted", { action: { label: "Undo", onClick: restore } });
//   notify("Couldn't save", { tone: "error" });
//   <Toaster toasts={toasts} onDismiss={dismiss} />

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_MS = 5000;

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const notify = useCallback((message, { tone = "info", action, duration = DEFAULT_MS } = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((list) => [...list.slice(-2), { id, message, tone, action }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  return { toasts, notify, dismiss };
}

export function Toaster({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-[min(420px,calc(100vw-2rem))] pointer-events-none" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fade-up-in pointer-events-auto w-full flex items-center gap-3 rounded-[12px] pl-4 pr-2 py-2.5 text-sm"
          style={{
            background: t.tone === "error" ? "#fbefed" : "var(--ink)",
            color: t.tone === "error" ? "#a83226" : "white",
            border: t.tone === "error" ? "1px solid #f2d2cd" : "1px solid transparent",
            boxShadow: "0 12px 28px -12px rgba(19,32,27,0.45)",
          }}
        >
          <span className="flex-1 min-w-0">{t.message}</span>
          {t.action && (
            <button
              type="button"
              onClick={() => { t.action.onClick(); onDismiss(t.id); }}
              className="font-semibold px-2.5 py-1 rounded-[8px] shrink-0"
              style={{ color: t.tone === "error" ? "#a83226" : "#9fe0c4" }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            className="w-7 h-7 rounded-[8px] flex items-center justify-center shrink-0 opacity-70 hover:opacity-100"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
