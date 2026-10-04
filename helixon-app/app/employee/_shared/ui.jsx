"use client";
// app/employee/_shared/ui.jsx
// The staff portal's view of the UI kit (components/ui): Card, Chip and
// Spinner are the shared ones; the rest are this portal's own layouts, in
// the same language as the customer dashboard: white cards on mist, small
// uppercase eyebrows, Outfit headings, mono numbers.

import Link from "next/link";
import CountUp from "@/components/dashboard/CountUp";
import { Card as KitCard, Pill, Spinner as KitSpinner } from "@/components/ui";

export const Card = KitCard;

export function CardHeader({ title, eyebrow, count, action, id }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-0.5" style={{ color: "var(--ink-faint)" }}>{eyebrow}</p>
        )}
        <h2 id={id} className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          {title}
          {typeof count === "number" && count > 0 && (
            <Pill>{count}</Pill>
          )}
        </h2>
      </div>
      {action}
    </div>
  );
}

export function HeaderLink({ href, children }) {
  return (
    <Link href={href} className="text-xs font-semibold whitespace-nowrap hover:underline" style={{ color: "var(--forest)" }}>
      {children}
    </Link>
  );
}

export function Chip({ tone = "neutral", children, className = "" }) {
  return (
    <Pill tone={tone} className={className}>
      {children}
    </Pill>
  );
}

export function ProgressBar({ pct, tone = "var(--forest)", label }) {
  return (
    <div
      className="h-1.5 w-full rounded-full overflow-hidden"
      style={{ background: "var(--border-soft)" }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: tone, transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }} />
    </div>
  );
}

export function Kpi({ label, value, sub, tone, index = 0, href }) {
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-2.5" style={{ color: "var(--ink-faint)" }}>{label}</p>
      <p className="text-[28px] font-semibold leading-none tabular-nums" style={{ fontFamily: "var(--font-mono)", color: tone || "var(--ink)" }}>
        {typeof value === "number" ? <CountUp value={value} /> : value ?? "-"}
      </p>
      {sub && <p className="text-xs mt-2" style={{ color: "var(--ink-faint)" }}>{sub}</p>}
    </>
  );
  const className = "fade-up-in block rounded-[16px] bg-white p-4 sm:p-5";
  const style = { border: "1px solid var(--border)", "--stagger-delay": `${index * 60}ms` };
  if (href) {
    return (
      <Link href={href} className={`${className} lift-on-hover`} style={style}>
        {body}
      </Link>
    );
  }
  return <div className={className} style={style}>{body}</div>;
}

export function EmptyLine({ children, action }) {
  return (
    <div className="px-5 pb-5 pt-1">
      <p className="text-sm" style={{ color: "var(--ink-faint)" }}>{children}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Spinner({ size = 32 }) {
  return <KitSpinner size={size} label="Loading" />;
}

export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--mist)" }}>
      <Spinner />
    </div>
  );
}
