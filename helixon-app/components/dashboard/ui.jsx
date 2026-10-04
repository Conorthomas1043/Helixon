"use client";

// Small shared building blocks for dashboard pages, in the same look the
// Jobs / Candidates / Shortlists pages already use (CSS tokens from
// app/globals.css via lib/candidate-format.js). Newer pages use these
// rather than each re-declaring their own card, button and field styles.

import { useEffect, useRef } from "react";
import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { INK, INK_MUTED, INK_FAINT, CARD } from "@/lib/candidate-format";

export { INK, INK_MUTED, INK_FAINT, CARD };

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

export function Page({ children, width = 1200 }) {
  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav />
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-6" style={{ maxWidth: width }}>
        {children}
      </div>
    </main>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions, back }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="inline-block text-[12px] font-semibold mb-2" style={{ color: INK_MUTED }}>
            ← {back.label}
          </Link>
        )}
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
          {title}
        </h1>
        {subtitle && (
          <div className="text-[13px] mt-1 max-w-3xl" style={{ color: INK_MUTED }}>
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

export function Card({ title, eyebrow, action, children, className = "", padded = true }) {
  return (
    <section className={`rounded-[14px] ${padded ? "p-5 sm:p-6" : ""} ${className}`} style={CARD}>
      {(title || eyebrow || action) && (
        <div className="flex items-end justify-between gap-3 mb-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
                {eyebrow}
              </p>
            )}
            {title && (
              <h2 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
                {title}
              </h2>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const BUTTON = {
  primary: { background: "var(--forest)", color: "white", border: "1px solid var(--forest)" },
  secondary: { background: "white", color: INK, border: "1px solid var(--border)" },
  outline: { background: "white", color: "var(--forest)", border: "1px solid var(--forest)" },
  ghost: { background: "transparent", color: INK_MUTED, border: "1px solid transparent" },
  danger: { background: "white", color: "var(--score-low)", border: "1px solid var(--border)" },
};

export function Button({ variant = "secondary", size = "md", href, className = "", style, children, ...props }) {
  const cls = `inline-flex items-center justify-center gap-1.5 font-semibold rounded-full transition-colors disabled:opacity-50 ${FOCUS} ${
    size === "sm" ? "text-[12px] px-3 py-1 min-h-[28px]" : "text-[12px] px-3.5 py-1.5 min-h-[32px]"
  } ${className}`;
  const s = { ...BUTTON[variant], ...style };
  if (href) {
    return (
      <Link href={href} className={cls} style={s} {...props}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} style={s} {...props}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: INK_FAINT }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[11px] mt-1" style={{ color: INK_FAINT }}>
          {hint}
        </span>
      )}
    </label>
  );
}

const INPUT_CLS = `w-full text-[13px] px-3 py-2 rounded-[8px] bg-white ${FOCUS}`;
const INPUT_STYLE = { border: "1px solid var(--border)", color: INK };

export function TextInput(props) {
  return <input {...props} className={`${INPUT_CLS} ${props.className || ""}`} style={{ ...INPUT_STYLE, ...props.style }} />;
}

export function TextArea(props) {
  return <textarea rows={3} {...props} className={`${INPUT_CLS} ${props.className || ""}`} style={{ ...INPUT_STYLE, ...props.style }} />;
}

export function Select({ options, ...props }) {
  return (
    <select {...props} className={`${INPUT_CLS} ${props.className || ""}`} style={{ ...INPUT_STYLE, ...props.style }}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Pill({ children, color = INK_MUTED, background = "var(--mist)" }) {
  return (
    <span className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color, background }}>
      {children}
    </span>
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse motion-reduce:animate-none rounded-[10px] ${className}`} style={{ background: "var(--mist)" }} />;
}

export function LoadingCard({ rows = 3 }) {
  return (
    <div className="rounded-[14px] p-5 space-y-3" style={CARD} aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-[14px] py-12 px-6 text-center" style={CARD}>
      <p className="text-sm font-semibold mb-1" style={{ color: INK }}>
        {title}
      </p>
      {body && (
        <p className="text-[13px] max-w-md mx-auto" style={{ color: INK_MUTED }}>
          {body}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", body, onRetry }) {
  return (
    <div className="rounded-[14px] p-10 text-center" style={CARD}>
      <p className="font-semibold mb-1" style={{ color: INK }}>
        {title}
      </p>
      {body && (
        <p className="text-[13px] mb-4" style={{ color: INK_MUTED }}>
          {body}
        </p>
      )}
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p className="text-[12px]" role="alert" style={{ color: "var(--score-low)" }}>
      {children}
    </p>
  );
}

// A modal dialog: Escape and the backdrop close it; focus starts inside.
export function Dialog({ title, onClose, children, width = 560, busy = false }) {
  const ref = useRef(null);
  // Focus goes back to whatever opened the dialog when it closes; it used
  // to drop to the top of the page, losing a keyboard user's place.
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
        className="w-full max-h-[92vh] overflow-y-auto rounded-[16px] p-6 bg-white shadow-xl"
        style={{ maxWidth: width }}
      >
        <h2 className="text-base font-semibold mb-4" style={{ color: INK }}>
          {title}
        </h2>
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
