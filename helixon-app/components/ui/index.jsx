"use client";

// Helixon's UI kit: the one set of building blocks for every screen.
//
// Colours come from the --ui-* theme tokens (app/globals.css), not from fixed
// values, so the same components render in the light customer app and the
// dark admin console (which sets its own --ui-* in app/admin/_shared/styles.js).
// The area modules (components/dashboard/ui, app/analyse/_components/ui,
// components/account/ui, app/employee/_shared/ui, app/admin/_shared/ui)
// re-export these, keep their older prop names working, and add only the
// pieces specific to that area.

import { Children, cloneElement, forwardRef, Fragment, isValidElement, useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { trapTab } from "@/lib/ui/focus-trap";
import { initials } from "@/lib/format";

export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

const FOCUS_RING = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-accent)]";

// ── Icons ───────────────────────────────────────────────────────────────────

const ICONS = {
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></>,
  download: <><path d="M12 4v12" /><path d="m7 11 5 5 5-5" /><path d="M5 20h14" /></>,
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
  wand: <><path d="m15 4 5 5" /><path d="M4 20 16 8" /><path d="M5 5v3M3.5 6.5h3M19 14v3M17.5 15.5h3M10 3v2M9 4h2" /></>,
  box: <><path d="m21 8-9-5-9 5 9 5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>,
  truck: <><path d="M3 6h11v10H3z" /><path d="M14 10h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.7" /><circle cx="17" cy="17.5" r="1.7" /></>,
  cup: <><path d="M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M8 3v2M11 3v2M14 3v2" /></>,
  bag: <><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  heart: <path d="M12 20s-7.5-4.6-9-9.4C2 7 4.3 4.5 7.2 4.5c2 0 3.5 1.1 4.8 2.8 1.3-1.7 2.8-2.8 4.8-2.8 2.9 0 5.2 2.5 4.2 6.1-1.5 4.8-9 9.4-9 9.4z" />,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><path d="m12 8 1.5 2.5L16 12l-2.5 1.5L12 16l-1.5-2.5L8 12l2.5-1.5z" /></>,
  hardhat: <><path d="M4 16a8 8 0 0 1 16 0" /><path d="M2 16h20v2H2z" /><path d="M10 8V5h4v3" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" /></>,
  shield: <path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" />,
  headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="13" width="4" height="6" rx="1.5" /><rect x="17" y="13" width="4" height="6" rx="1.5" /><path d="M19 19a3 3 0 0 1-3 3h-3" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1" /><path d="M9 10h6M9 14h6M9 18h3" /></>,
  circle: <circle cx="12" cy="12" r="8" />,
  bookmark: <path d="M6 3h12v18l-6-4.5L6 21z" />,
  trash: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></>,
  pencil: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  printer: <><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M6 14h12v7H6z" /></>,
  eye: <><path d="M2 12c1.5-3.5 5.5-7 10-7s8.5 3.5 10 7c-1.5 3.5-5.5 7-10 7S3.5 15.5 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  inbox: <><path d="M3 13h5l1.5 3h5l1.5-3h5" /><path d="M5 5h14l2 8v6H3v-6z" /></>,
  // Merged from the admin console, staff portal and privacy page sets.
  command: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  traffic: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  bug: <><path d="m8 2 1.88 1.88M14.12 3.88 16 2M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" /><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" /><path d="M12 20v-9M6.53 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4" /></>,
  trending: <><path d="m22 7-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" /></>,
  card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  scroll: <><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" /><path d="M19 17V5a2 2 0 0 0-2-2H4" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5M21 12H9" /></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  arrowUp: <path d="m5 12 7-7 7 7M12 19V5" />,
  arrowDown: <path d="M12 5v14m7-7-7 7-7-7" />,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  key: <><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3" /></>,
  globe: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  userPlus: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  ban: <><circle cx="12" cy="12" r="10" /><path d="m4.9 4.9 14.2 14.2" /></>,
  sparkles: <path d="M9.94 14.06 8 20l-1.94-5.94L0 12l6.06-2.06L8 4l1.94 5.94L16 12zM19 3v4M21 5h-4M19 17v4M21 19h-4" />,
  activity: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  todo: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
  chart: <><path d="M3 3v18h18" /><path d="M18 17V9M13 17V5M8 17v-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />,
};

// The app's one icon set. `size={null}` leaves the size to CSS (the admin
// console sizes icons from its stylesheet).
export function Icon({ name, size = 16, className = "", strokeWidth = 1.7, ...rest }) {
  return (
    <svg
      width={size ?? undefined}
      height={size ?? undefined}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx("shrink-0", className)}
      aria-hidden="true"
      {...rest}
    >
      {ICONS[name] ?? ICONS.info}
    </svg>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

export const BUTTON_BASE = cx(
  "inline-flex items-center justify-center gap-1.5 font-semibold rounded-btn border transition-colors whitespace-nowrap",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  FOCUS_RING
);

export const BUTTON_SIZES = {
  sm: "min-h-8 px-3 text-14",
  md: "min-h-9 px-3.5 text-14",
  lg: "min-h-11 px-5 text-15",
  // Marketing calls to action.
  xl: "min-h-12 px-6 text-15",
};

export const BUTTON_VARIANTS = {
  primary: "bg-[var(--ui-accent)] border-[var(--ui-accent)] text-[var(--ui-on-accent)] hover:bg-[var(--ui-accent-hover)] hover:border-[var(--ui-accent-hover)]",
  secondary: "bg-[var(--ui-surface)] border-[var(--ui-border)] text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]",
  outline: "bg-[var(--ui-surface)] border-[var(--ui-accent)] text-[var(--ui-accent)] hover:bg-[var(--ui-accent-soft)]",
  ghost: "bg-transparent border-transparent text-[var(--ui-text-soft)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface-muted)]",
  dark: "bg-[var(--ui-text)] border-[var(--ui-text)] text-[var(--ui-surface)] hover:opacity-90",
  danger: "bg-[var(--ui-surface)] border-[var(--ui-border)] text-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)]",
  dangerSolid: "bg-[var(--ui-danger)] border-[var(--ui-danger)] text-[var(--ui-on-danger)] hover:opacity-90",
  // On a solid accent background (a forest call-to-action band).
  inverse: "bg-[var(--ui-surface)] border-[var(--ui-surface)] text-[var(--ui-accent)] hover:bg-[var(--ui-surface-muted)] hover:border-[var(--ui-surface-muted)]",
};

export function Spinner({ size = 16, label }) {
  return (
    <span
      className="inline-block shrink-0 rounded-full animate-spin motion-reduce:animate-none"
      style={{ width: size, height: size, border: `${Math.max(2, Math.round(size / 8))}px solid var(--ui-border)`, borderTopColor: "var(--ui-accent)" }}
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}

export const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", href, icon, iconRight, loading = false, disabled, className = "", type = "button", children, ...props },
  ref
) {
  const cls = cx(BUTTON_BASE, BUTTON_SIZES[size] || BUTTON_SIZES.md, BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.secondary, className);
  const iconSize = size === "lg" ? 17 : 15;
  const content = (
    <>
      {loading ? <Spinner size={14} /> : icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </>
  );
  if (href) {
    return (
      <Link ref={ref} href={href} className={cls} {...props}>
        {content}
      </Link>
    );
  }
  return (
    // The kit passes its own `type` prop through; it defaults to "button".
    // eslint-disable-next-line react/button-has-type
    <button ref={ref} type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {content}
    </button>
  );
});

// ── Surfaces ────────────────────────────────────────────────────────────────

export function Card({ as: Tag = "section", className = "", children, ...props }) {
  return (
    <Tag className={cx("bg-[var(--ui-surface)] rounded-card border border-[var(--ui-border)]", className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, eyebrow, description, count, action, id, className = "" }) {
  return (
    <div className={cx("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-12 font-semibold uppercase tracking-[0.1em] mb-0.5 text-[var(--ui-text-faint)]">{eyebrow}</p>}
        <h2 id={id} className="text-15 font-semibold tracking-tight flex items-center gap-2 text-[var(--ui-text)] font-display">
          {title}
          {typeof count === "number" && count > 0 && <Pill>{count}</Pill>}
        </h2>
        {description && <p className="text-14 mt-0.5 text-[var(--ui-text-soft)]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const PILL_TONES = {
  neutral: { background: "var(--ui-surface-muted)", color: "var(--ui-text-soft)" },
  green: { background: "var(--ui-accent-soft)", color: "var(--ui-accent)" },
  amber: { background: "var(--ui-warn-soft)", color: "var(--ui-warn)" },
  red: { background: "var(--ui-danger-soft)", color: "var(--ui-danger)" },
};

export function Pill({ tone = "neutral", color, background, className = "", children }) {
  const t = PILL_TONES[tone] || PILL_TONES.neutral;
  return (
    <span
      className={cx("inline-flex items-center gap-1 text-12 font-semibold px-2 py-0.5 rounded-full whitespace-nowrap tabular-nums", className)}
      style={{ background: background || t.background, color: color || t.color }}
    >
      {children}
    </span>
  );
}

// A person's initials in a circle. `tone="solid"` fills it with the accent.
export function Avatar({ name, letter, size = 36, tone = "soft", bordered = false, className = "" }) {
  const solid = tone === "solid";
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex items-center justify-center shrink-0 rounded-full font-semibold", bordered && "border border-[var(--ui-border)]", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.34),
        background: solid ? "var(--ui-accent)" : "var(--ui-surface-muted)",
        color: solid ? "var(--ui-on-accent)" : "var(--ui-accent)",
      }}
    >
      {letter || initials(name)}
    </span>
  );
}

// An eyebrow, title and optional action above a section.
export function SectionHeading({ eyebrow, title, action, className = "" }) {
  return (
    <div className={cx("flex items-end justify-between gap-4 mb-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="text-12 font-semibold uppercase tracking-widest mb-1 text-[var(--ui-text-faint)]">{eyebrow}</p>}
        <h2 className="text-base font-semibold text-[var(--ui-text)] font-display">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function Divider() {
  return <div className="h-px my-6 bg-[var(--ui-border)]" aria-hidden="true" />;
}

export function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center h-5 px-1.5 rounded-sm border border-[var(--ui-border)] bg-[var(--ui-surface)] text-12 font-medium text-[var(--ui-text-faint)] font-mono">
      {children}
    </kbd>
  );
}

// ── Forms ───────────────────────────────────────────────────────────────────

// 16px on phones: iOS Safari zooms the page into any field smaller than that.
export const FIELD_BASE = cx(
  "w-full bg-[var(--ui-surface)] rounded-input border border-[var(--ui-border)] text-16 sm:text-15 text-[var(--ui-text)]",
  "placeholder:text-[var(--ui-text-faint)] outline-none transition-shadow",
  "focus:border-[var(--ui-accent)] focus:shadow-[0_0_0_3px_var(--ui-accent-soft)]",
  "disabled:bg-[var(--ui-surface-muted)] disabled:cursor-not-allowed",
  "aria-[invalid=true]:border-[var(--ui-danger)]"
);

export const TextInput = forwardRef(function TextInput({ error, className = "", ...props }, ref) {
  return <input ref={ref} aria-invalid={error ? true : undefined} className={cx(FIELD_BASE, "min-h-9 px-3", className)} {...props} />;
});

export const TextArea = forwardRef(function TextArea({ error, className = "", rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} aria-invalid={error ? true : undefined} className={cx(FIELD_BASE, "px-3 py-2.5 leading-relaxed resize-y", className)} {...props} />;
});

export const Select = forwardRef(function Select({ options, className = "", children, ...props }, ref) {
  return (
    <select ref={ref} className={cx(FIELD_BASE, "min-h-9 pl-3 pr-8", className)} {...props}>
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        : children}
    </select>
  );
});

export function Label({ htmlFor, children, hint }) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2 mb-1.5">
      <span className="text-14 font-medium text-[var(--ui-text)]">{children}</span>
      {hint && <span className="text-13 text-[var(--ui-text-faint)]">{hint}</span>}
    </label>
  );
}

// A labelled field. The label wraps the control, so its name comes for free;
// the hint (or error) is tied on with aria-describedby so screen readers read
// it too.
export function Field({ label, hint, error, children, className = "" }) {
  const noteId = useId();
  const note = error || hint;
  const only = note && Children.count(children) === 1 && isValidElement(children) && children.type !== Fragment ? children : null;
  const control = only
    ? cloneElement(only, {
        "aria-describedby": [only.props["aria-describedby"], noteId].filter(Boolean).join(" "),
        ...(error ? { "aria-invalid": true } : {}),
      })
    : children;
  return (
    <label className={cx("block", className)}>
      <span className="block text-13 font-medium mb-1.5 text-[var(--ui-text-soft)]">{label}</span>
      {control}
      {note && (
        <span id={noteId} role={error ? "alert" : undefined} className={cx("block text-12 mt-1", error ? "font-medium text-[var(--ui-danger)]" : "text-[var(--ui-text-faint)]")}>
          {note}
        </span>
      )}
    </label>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p className="text-14 text-[var(--ui-danger)]" role="alert">
      {children}
    </p>
  );
}

// On/off switch. `align="end"` puts the switch after the text (settings
// rows); the default puts it first.
export function Switch({ checked, onChange, label, description, disabled = false, id, align = "start" }) {
  const autoId = useId();
  const labelId = `${id || autoId}-label`;
  const track = (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={!!checked}
      aria-labelledby={label ? labelId : undefined}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cx("relative shrink-0 mt-0.5 w-9 h-5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed", FOCUS_RING)}
      style={{ background: checked ? "var(--ui-accent)" : "var(--ui-border-strong)" }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform motion-reduce:transition-none"
        style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </button>
  );
  const text = label && (
    <span className="min-w-0">
      <span id={labelId} className="block text-14 font-medium text-[var(--ui-text)]">
        {label}
      </span>
      {description && <span className="block text-13 mt-0.5 text-[var(--ui-text-soft)]">{description}</span>}
    </span>
  );
  return (
    <div className={cx("flex items-start gap-3", align === "end" && "justify-between", disabled && "opacity-70")}>
      {align === "end" ? <>{text}{track}</> : <>{track}{text}</>}
    </div>
  );
}

// Segmented control - for switching between a few peer views.
export function Segmented({ value, onChange, options, ariaLabel, size = "md" }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex p-0.5 rounded-lg bg-[var(--ui-surface-muted)] border border-[var(--ui-border)]">
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
              "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
              size === "sm" ? "h-7 px-2.5 text-13" : "h-8 px-3 text-14",
              active ? "bg-[var(--ui-surface)] text-[var(--ui-text)] shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-[var(--ui-text-soft)] hover:text-[var(--ui-text)]"
            )}
          >
            {o.icon && <Icon name={o.icon} size={14} />}
            {o.label}
            {o.count != null && <span className="text-12 tabular-nums text-[var(--ui-text-faint)]">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────

const NOTICE_TONES = {
  info: { bg: "var(--ui-surface-muted)", fg: "var(--ui-text-soft)", border: "var(--ui-border)", icon: "info" },
  warn: { bg: "var(--ui-warn-soft)", fg: "var(--ui-warn)", border: "var(--ui-warn-soft)", icon: "alert" },
  error: { bg: "var(--ui-danger-soft)", fg: "var(--ui-danger)", border: "var(--ui-danger-soft)", icon: "alert" },
  ok: { bg: "var(--ui-accent-soft)", fg: "var(--ui-accent-hover)", border: "var(--ui-accent-soft)", icon: "check" },
};

export function Notice({ tone = "info", children, action, onDismiss, className = "" }) {
  const t = NOTICE_TONES[tone] || NOTICE_TONES.info;
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cx("flex items-start gap-2.5 rounded-btn px-3.5 py-2.5 text-14 leading-relaxed", className)}
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

export function Skeleton({ className = "", width, height, style }) {
  return (
    <span
      aria-hidden="true"
      className={cx("block animate-pulse motion-reduce:animate-none rounded-btn bg-[var(--ui-surface-muted)]", className)}
      style={{ width, height, ...style }}
    />
  );
}

export function LoadingCard({ rows = 3 }) {
  return (
    <Card className="p-5 space-y-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </Card>
  );
}

// `icon` is an icon name from this kit, or any element. `framed={false}`
// drops the card, for an empty state inside a panel that already has one.
export function EmptyState({ icon, title, body, children, action, framed = true, className = "" }) {
  const Frame = framed ? Card : "div";
  return (
    <Frame className={cx("py-12 px-6 text-center", className)}>
      {icon && (
        <span className="mx-auto mb-3 flex w-11 h-11 items-center justify-center rounded-xl bg-[var(--ui-surface-muted)] text-[var(--ui-text-faint)]">
          {typeof icon === "string" ? <Icon name={icon} size={20} /> : icon}
        </span>
      )}
      <p className="text-15 font-semibold mb-1 text-[var(--ui-text)]">{title}</p>
      {(body || children) && <div className="text-14 max-w-md mx-auto text-[var(--ui-text-soft)]">{body || children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Frame>
  );
}

export function ErrorState({ title = "Something went wrong", body, onRetry }) {
  return (
    <Card className="p-10 text-center">
      <p className="font-semibold mb-1 text-[var(--ui-text)]">{title}</p>
      {body && <p className="text-14 mb-4 text-[var(--ui-text-soft)]">{body}</p>}
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

// toast(message, tone?, { action?: { label, onClick }, duration? }) - an
// action (e.g. Undo) shows as a button and keeps the toast up longer.
// Toasts: short notices at the bottom of the screen, the app's one toast
// system (the staff portal and admin console render theirs with it too).
//   const { toasts, toast, notify, dismiss } = useToasts();
//   toast("Saved");                          // tone as the 2nd argument
//   notify("Deleted", { tone: "info", action: { label: "Undo", onClick } });
//   <Toasts toasts={toasts} onDismiss={dismiss} />
// Tones: "ok" (default for toast), "info" (default for notify), "warn", "error".
export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);
  const notify = useCallback(
    (message, { tone = "info", action, duration } = {}) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((list) => [...list.slice(-2), { id, message, tone, action }]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration ?? (action ? 6000 : tone === "error" ? 7000 : 3600)));
      return id;
    },
    [dismiss]
  );
  const toast = useCallback((message, tone = "ok", options = {}) => notify(message, { ...options, tone }), [notify]);
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);
  return { toasts, toast, notify, dismiss };
}

const TOAST_TONES = {
  ok: { icon: "check", cls: "bg-[var(--ui-text)] text-[var(--ui-surface)] border-transparent" },
  info: { icon: "info", cls: "bg-[var(--ui-text)] text-[var(--ui-surface)] border-transparent" },
  warn: { icon: "alert", cls: "bg-[var(--ui-warn-soft)] text-[var(--ui-warn)] border-[var(--ui-warn)]/30" },
  error: { icon: "alert", cls: "bg-[var(--ui-danger)] text-[var(--ui-on-danger)] border-transparent" },
};

export function Toasts({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-[calc(1.25rem+var(--tabbar-h))] left-1/2 -translate-x-1/2 z-[1300] flex flex-col items-center gap-2 w-[min(440px,calc(100vw-2rem))] pointer-events-none" role="status" aria-live="polite">
      {toasts.map((t) => {
        const tone = TOAST_TONES[t.tone] || TOAST_TONES.ok;
        return (
          <div key={t.id} className={cx("fade-up-in pointer-events-auto flex items-center gap-2.5 max-w-full pl-3.5 pr-1.5 py-1.5 min-h-10 rounded-btn border text-14 font-medium shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)]", tone.cls)}>
            <Icon name={tone.icon} size={14} />
            <span className="flex-1 min-w-0 py-0.5">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action.onClick();
                  onDismiss?.(t.id);
                }}
                className={cx("shrink-0 px-2 py-1 rounded-md font-semibold underline underline-offset-2", FOCUS_RING)}
              >
                {t.action.label}
              </button>
            )}
            {onDismiss && (
              <button type="button" onClick={() => onDismiss(t.id)} aria-label="Dismiss" className={cx("shrink-0 w-7 h-7 rounded-md flex items-center justify-center opacity-70 hover:opacity-100", FOCUS_RING)}>
                <Icon name="x" size={13} strokeWidth={2.2} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Dialog ──────────────────────────────────────────────────────────────────

// A modal dialog: Escape and the backdrop close it; focus starts inside, Tab
// stays inside, and focus returns to whatever opened it.
export function Dialog({ title, onClose, children, width = 560, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    return () => {
      if (opener && opener.isConnected && typeof opener.focus === "function") opener.focus();
    };
  }, []);
  useEffect(() => {
    const first = ref.current?.querySelector("input, select, textarea, button");
    first?.focus();
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key === "Tab") trapTab(e, ref.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(19,32,27,0.45)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-h-[92vh] overflow-y-auto rounded-2xl p-6 bg-[var(--ui-surface)] shadow-xl"
        style={{ maxWidth: width }}
      >
        <h2 className="text-base font-semibold mb-4 text-[var(--ui-text)]">{title}</h2>
        {children}
      </div>
    </div>
  );
}

// "£12,500" style money, in the given currency (GBP by default).
export function formatMoney(value, currency = "GBP") {
  if (value == null || value === "" || !Number.isFinite(Number(value))) return "-";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value));
}
