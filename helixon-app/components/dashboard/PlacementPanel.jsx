"use client";

// The candidate profile's Placement card: offers made, what came of them,
// invoices and (for contractors) timesheets - components/dashboard/placements.jsx.

import { useCallback, useEffect, useState } from "react";
import { getPlacements } from "@/lib/dashboard-api";
import { Card, Button, INK_MUTED } from "@/components/dashboard/ui";
import { PlacementDialog, PlacementItem } from "@/components/dashboard/placements";

export default function PlacementPanel({ candidate, onChanged }) {
  const [placements, setPlacements] = useState(null);
  const [recording, setRecording] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPlacements({ candidateId: candidate.id })
      .then((list) => {
        if (!cancelled) setPlacements(list);
      })
      .catch(() => {
        if (!cancelled) setPlacements([]);
      });
    return () => {
      cancelled = true;
    };
  }, [candidate.id, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
    onChanged?.();
  }, [onChanged]);
  const close = useCallback(() => setRecording(false), []);

  return (
    <Card
      eyebrow="Offer & placement"
      title={placements?.length ? `${placements.length} offer${placements.length === 1 ? "" : "s"}` : "Offer & placement"}
      action={
        <Button variant="primary" size="sm" onClick={() => setRecording(true)}>
          Record offer
        </Button>
      }
    >
      {placements === null ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>Loading…</p>
      ) : placements.length === 0 ? (
        <p className="text-[14px]" style={{ color: INK_MUTED }}>
          No offer yet. Recording one keeps the salary, fee and rebate period, moves them to Offer / Placed, and lets you raise the invoice.
        </p>
      ) : (
        <ul className="divide-y -my-3.5" style={{ borderColor: "var(--border)" }}>
          {placements.map((p) => (
            <PlacementItem key={p.id} placement={p} onChanged={reload} />
          ))}
        </ul>
      )}
      {recording && (
        <PlacementDialog
          candidate={{ id: candidate.id, name: candidate.fullName }}
          onClose={close}
          onSaved={() => {
            setRecording(false);
            reload();
          }}
        />
      )}
    </Card>
  );
}
