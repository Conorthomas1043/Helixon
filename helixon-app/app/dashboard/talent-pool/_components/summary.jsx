"use client";

// Part of the talent pool page (app/dashboard/talent-pool/page.jsx).

import { Card, cx } from "@/app/analyse/_components/ui";

export function StatCard({ label, value, sub, accent, onClick, active }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? active : undefined}
      className={cx(
        "text-left rounded-[14px] p-4 sm:p-5 bg-white border transition-colors",
        active ? "border-[var(--forest)] ring-1 ring-[var(--forest)]" : "border-[var(--border)]",
        onClick && "hover:border-[var(--ink-mute)]"
      )}
    >
      <p className="text-[12px] font-semibold uppercase tracking-widest text-[var(--ink-faint)]">{label}</p>
      <p className="text-[26px] font-semibold tabular-nums leading-none mt-2.5" style={{ fontFamily: "var(--font-mono)", color: accent || "var(--ink)" }}>
        {value}
      </p>
      {sub && <p className="text-[12.5px] text-[var(--ink-faint)] mt-2">{sub}</p>}
    </Tag>
  );
}

export function PoolSkeleton() {
  return (
    <Card className="divide-y divide-[var(--border-soft)]" aria-busy="true" aria-label="Loading talent pool">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-5">
          <div className="w-10 h-10 rounded-full shimmer-block" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-48 rounded shimmer-block" />
            <div className="h-3 w-72 rounded shimmer-block" />
          </div>
        </div>
      ))}
    </Card>
  );
}
