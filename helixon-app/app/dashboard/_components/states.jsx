"use client";

// Part of the dashboard home (app/dashboard/page.js).

import { Skeleton as Block, Button, EmptyState as KitEmptyState } from "@/components/ui";
import { ACCENT, CARD, TEXT, TEXT_SUB } from "./shared";

export function EmptyState({ title, body, actionLabel, actionHref }) {
  return (
    <KitEmptyState
      framed={false}
      icon="plus"
      title={title}
      body={body}
      action={
        actionLabel && actionHref ? (
          <Button variant="primary" href={actionHref}>
            {actionLabel}
          </Button>
        ) : null
      }
    />
  );
}

/* ─── Skeleton ──────────────────────────────────────────────────────────── */

export function DashboardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} aria-busy="true" aria-label="Loading dashboard">
      <div style={{ ...CARD, padding: 28 }}>
        <Block style={{ height: 14, width: 120, marginBottom: 14 }} />
        <Block style={{ height: 28, width: 280, marginBottom: 10 }} />
        <Block style={{ height: 14, width: 360 }} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ ...CARD, padding: 20 }}>
            <Block style={{ height: 10, width: 80, marginBottom: 12 }} />
            <Block style={{ height: 28, width: 60 }} />
          </div>
        ))}
      </div>
      <div style={{ ...CARD, padding: 24 }}>
        <Block style={{ height: 16, width: 180, marginBottom: 20 }} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {[...Array(5)].map((_, i) => <Block key={i} style={{ height: 80 }} />)}
        </div>
      </div>
    </div>
  );
}

/* ─── Error ─────────────────────────────────────────────────────────────── */

export function DashboardError({ onRetry }) {
  return (
    <div style={{ ...CARD, padding: 40, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: TEXT, marginBottom: 6 }}>Unable to load dashboard</p>
      <p style={{ fontSize: 14, color: TEXT_SUB, maxWidth: 320, marginBottom: 20 }}>Something went wrong while loading your recruitment data.</p>
      <button type="button" onClick={onRetry} style={{ fontSize: 14, fontWeight: 600, padding: "10px 20px", borderRadius: 9999, background: ACCENT, color: "#fff", border: "none", cursor: "pointer" }}>
        Try again
      </button>
    </div>
  );
}
