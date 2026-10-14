"use client";

import { useEffect } from "react";
import { Toasts, useToasts } from "@/components/ui";

// The console's toasts: call toast("Saved") from anywhere (no provider
// needed) and <ToastHost /> - mounted once in the layout - shows it with the
// UI kit's toasts, in the console's colours.

const listeners = new Set();

export function toast(message, { tone = "info", duration = 4200 } = {}) {
  listeners.forEach((fn) => fn(message, { tone, duration }));
}

toast.success = (message, options) => toast(message, { ...options, tone: "ok" });
toast.error = (message, options) => toast(message, { duration: 7000, ...options, tone: "error" });
toast.warn = (message, options) => toast(message, { ...options, tone: "warn" });

export function ToastHost() {
  const { toasts, notify, dismiss } = useToasts();
  useEffect(() => {
    listeners.add(notify);
    return () => listeners.delete(notify);
  }, [notify]);
  return <Toasts toasts={toasts} onDismiss={dismiss} />;
}
