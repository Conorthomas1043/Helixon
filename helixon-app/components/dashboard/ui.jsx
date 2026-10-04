"use client";

// The dashboard's view of the UI kit (components/ui): the shared building
// blocks, plus the page frame (nav + width) and the titled card the
// dashboard pages are laid out with.

import Link from "next/link";
import DashboardNav from "@/components/DashboardNav";
import { INK, INK_MUTED, INK_FAINT, CARD } from "@/lib/candidate-format";
import { trapTab } from "@/lib/focus-trap";
import { Card as SurfaceCard, cx } from "@/components/ui";

export {
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  ErrorText,
  Field,
  LoadingCard,
  Pill,
  Select,
  Skeleton,
  TextArea,
  TextInput,
  formatMoney,
} from "@/components/ui";

export { INK, INK_MUTED, INK_FAINT, CARD, trapTab };

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
          <Link href={back.href} className="inline-block text-[13px] font-semibold mb-2" style={{ color: INK_MUTED }}>
            ← {back.label}
          </Link>
        )}
        {eyebrow && (
          <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)", color: INK }}>
          {title}
        </h1>
        {subtitle && (
          <div className="text-[14px] mt-1 max-w-3xl" style={{ color: INK_MUTED }}>
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}

// A padded card with an optional eyebrow, title and action in its header.
export function Card({ title, eyebrow, action, children, className = "", padded = true }) {
  return (
    <SurfaceCard className={cx(padded && "p-5 sm:p-6", className)}>
      {(title || eyebrow || action) && (
        <div className="flex items-end justify-between gap-3 mb-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[12px] font-semibold uppercase tracking-widest mb-1" style={{ color: INK_FAINT }}>
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
    </SurfaceCard>
  );
}
