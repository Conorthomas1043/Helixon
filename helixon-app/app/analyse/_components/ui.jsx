"use client";

// Small, consistent building blocks for the /analyse workspace. One visual
// language: white surfaces on mist, 1px borders, 8-12px radii, sentence-case
// labels, a single forest accent, and colour reserved for meaning (score,
// warnings, errors).

import { useCallback, useState } from "react";

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const ICONS = {
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></>,
  text: <><path d="M4 6h16M4 12h16M4 18h10" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
  check: <path d="m5 12 5 5 9-10" />,
  x: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m11 6-6 6 6 6" /></>,
  arrowRight: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>,
  compare: <><path d="M8 3v18" /><path d="M16 3v18" /><path d="M3 8h5M16 16h5" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7a13 13 0 0 1-3.2 4.3M6.6 6.6A13 13 0 0 0 2 12c1 2.5 5 7 10 7a10 10 0 0 0 4-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  alert: <><path d="M12 8v5" /><path d="M12 16.5v.5" /><path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8v.5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />,
  link: <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>,
  pin: <><path d="M12 21s7-6.3 7-12a7 7 0 1 0-14 0c0 5.7 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  thumbUp: <><path d="M7 11v9H4v-9z" /><path d="M7 11l4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.3 20H7" /></>,
  thumbDown: <><path d="M17 13V4h3v9z" /><path d="M17 13l-4 8a2 2 0 0 1-2-2v-4H5.5a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.7 4H17" /></>,
  send: <><path d="m22 2-11 11" /><path d="M22 2 15 22l-4-9-9-4z" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>,
};

export function Icon({ name, size = 16, className = "", strokeWidth = 1.7 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("shrink-0", className)}
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-1.5 font-medium rounded-[8px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--forest)] whitespace-nowrap";

const BUTTON_SIZES = {
  sm: "h-8 px-3 text-[12.5px]",
  md: "h-9 px-3.5 text-[13px]",
  lg: "h-11 px-5 text-[14px]",
};

const BUTTON_VARIANTS = {
  primary: "bg-[var(--forest)] text-white hover:bg-[var(--forest-deep)]",
  dark: "bg-[var(--ink)] text-white hover:bg-black",
  secondary: "bg-white text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--mist)]",
  ghost: "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-[var(--mist)]",
  danger: "text-[var(--score-low)] hover:bg-[#fbefed]",
};

export function Button({ variant = "secondary", size = "md", icon, iconRight, className = "", children, ...props }) {
  return (
    <button type="button" className={cx(BUTTON_BASE, BUTTON_SIZES[size], BUTTON_VARIANTS[variant], className)} {...props}>
      {icon && <Icon name={icon} size={size === "lg" ? 17 : 15} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "lg" ? 17 : 15} />}
    </button>
  );
}

export function Card({ className = "", children, ...props }) {
  return (
    <section className={cx("bg-white rounded-[14px] border border-[var(--border)]", className)} {...props}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action, className = "" }) {
  return (
    <div className={cx("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h2>
        {description && <p className="text-[13px] mt-0.5 text-[var(--ink-soft)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Label({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 mb-1.5">
      <span className="text-[12.5px] font-medium text-[var(--ink)]">{children}</span>
      {hint && <span className="text-[11.5px] text-[var(--ink-faint)]">{hint}</span>}
    </label>
  );
}

const FIELD =
  "w-full bg-white rounded-[8px] border border-[var(--border)] text-[13.5px] text-[var(--ink)] placeholder:text-[var(--ink-mute)] outline-none transition-shadow focus:border-[var(--forest)] focus:shadow-[0_0_0_3px_rgba(11,110,79,0.14)] disabled:bg-[var(--mist)]";

export function Input({ className = "", ...props }) {
  return <input className={cx(FIELD, "h-9 px-3", className)} {...props} />;
}

export function Textarea({ className = "", ...props }) {
  return <textarea className={cx(FIELD, "px-3 py-2.5 leading-relaxed resize-y", className)} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={cx(FIELD, "h-9 pl-3 pr-8", className)} {...props}>
      {children}
    </select>
  );
}

// Segmented control - for switching between a few peer views.
export function Segmented({ value, onChange, options, ariaLabel, size = "md" }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex p-0.5 rounded-[9px] bg-[var(--mist)] border border-[var(--border)]">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-[7px] font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[12.5px]",
              active ? "bg-white text-[var(--ink)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
            )}
          >
            {o.icon && <Icon name={o.icon} size={14} />}
            {o.label}
            {o.count != null && <span className="text-[11px] tabular-nums text-[var(--ink-faint)]">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

const NOTICE_TONES = {
  info: { bg: "var(--mist)", fg: "var(--ink-soft)", border: "var(--border)", icon: "info" },
  warn: { bg: "#fdf6e9", fg: "#8a5a12", border: "#f1dfbc", icon: "alert" },
  error: { bg: "#fbefed", fg: "#a83226", border: "#f2d2cd", icon: "alert" },
  ok: { bg: "var(--mint)", fg: "var(--forest-deep)", border: "#cfe6da", icon: "check" },
};

export function Notice({ tone = "info", children, action, onDismiss, className = "" }) {
  const t = NOTICE_TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cx("flex items-start gap-2.5 rounded-[10px] px-3.5 py-2.5 text-[12.5px] leading-relaxed", className)}
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.border}` }}
    >
      <Icon name={t.icon} size={15} className="mt-[2px]" />
      <div className="flex-1 min-w-0">{children}</div>
      {action}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100 mt-[1px]">
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, id }) {
  return (
    <label htmlFor={id} className="flex items-start gap-3 cursor-pointer select-none">
      <span className="relative mt-0.5 shrink-0">
        <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="block w-8 h-[18px] rounded-full bg-[var(--border)] transition-colors peer-checked:bg-[var(--forest)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--forest)]" />
        <span className="absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform peer-checked:translate-x-[14px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-[var(--ink)]">{label}</span>
        {description && <span className="block text-[12px] text-[var(--ink-soft)] mt-0.5">{description}</span>}
      </span>
    </label>
  );
}

export function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center h-5 px-1.5 rounded-[5px] border border-[var(--border)] bg-white text-[10.5px] font-medium text-[var(--ink-faint)]" style={{ fontFamily: "var(--font-mono)" }}>
      {children}
    </kbd>
  );
}

export function Spinner({ size = 16 }) {
  return (
    <span
      className="inline-block rounded-full animate-spin motion-reduce:animate-none"
      style={{ width: size, height: size, border: "2px solid var(--border)", borderTopColor: "var(--forest)" }}
      aria-hidden="true"
    />
  );
}

// ── Toasts ──────────────────────────────────────────────────────────────────
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, tone = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3200);
  }, []);
  return { toasts, toast };
}

export function Toasts({ toasts }) {
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="fade-up-in flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[13px] font-medium text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)]"
          style={{ background: t.tone === "error" ? "#a83226" : "var(--ink)" }}
        >
          <Icon name={t.tone === "error" ? "alert" : "check"} size={14} />
          {t.message}
        </div>
      ))}
    </div>
  );
}
