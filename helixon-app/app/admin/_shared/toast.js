"use client";

import { useEffect, useState } from "react";
import { Icon } from "./icons";

// Tiny toast system: call toast("Saved") from anywhere in the console (no
// provider needed) and <ToastHost /> - mounted once in the layout - shows it.

const listeners = new Set();
let nextId = 1;

export function toast(message, { tone = "info", duration = 4200 } = {}) {
  const item = { id: nextId++, message, tone, duration };
  listeners.forEach((fn) => fn(item));
  return item.id;
}

toast.success = (message, options) => toast(message, { ...options, tone: "ok" });
toast.error = (message, options) => toast(message, { duration: 7000, ...options, tone: "error" });
toast.warn = (message, options) => toast(message, { ...options, tone: "warn" });

const TONE_ICON = { ok: "check", error: "alert", warn: "alert", info: "info" };

export function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    function add(item) {
      setItems((current) => [...current.slice(-3), item]);
      setTimeout(() => setItems((current) => current.filter((i) => i.id !== item.id)), item.duration);
    }
    listeners.add(add);
    return () => listeners.delete(add);
  }, []);

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast ${item.tone}`}>
          <Icon name={TONE_ICON[item.tone] || "info"} />
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}
