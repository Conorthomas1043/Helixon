"use client";
// app/employee/_shared/ui.jsx
// Visual building blocks for the employee portal, in the same language as
// the customer dashboard (app/dashboard/page.js): white cards on mist,
// small uppercase eyebrows, Outfit headings, mono numbers.

import Link from "next/link";
import CountUp from "@/components/dashboard/CountUp";

export function Card({ as: Tag = "section", className = "", children, ...props }) {
  return (
    <Tag className={`rounded-[16px] bg-white ${className}`} style={{ border: "1px solid var(--border)" }} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, eyebrow, count, action, id }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-0.5" style={{ color: "var(--ink-faint)" }}>{eyebrow}</p>
        )}
        <h2 id={id} className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--ink)", fontFamily: "var(--font-display)" }}>
          {title}
          {typeof count === "number" && count > 0 && (
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums" style={{ background: "var(--mist)", color: "var(--ink-soft)", fontFamily: "var(--font-body)" }}>
              {count}
            </span>
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

const CHIP_TONES = {
  neutral: { background: "var(--mist)", color: "var(--ink-soft)" },
  green: { background: "var(--mint)", color: "var(--forest)" },
  amber: { background: "#fdf5e9", color: "#8a5a12" },
  red: { background: "#fbefed", color: "#a83226" },
};

export function Chip({ tone = "neutral", children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${className}`} style={CHIP_TONES[tone]}>
      {children}
    </span>
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2.5" style={{ color: "var(--ink-faint)" }}>{label}</p>
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
  return (
    <div
      className="rounded-full animate-spin"
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size, border: `${Math.max(2, size / 8)}px solid var(--border)`, borderTopColor: "var(--forest)" }}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--mist)" }}>
      <Spinner />
    </div>
  );
}
