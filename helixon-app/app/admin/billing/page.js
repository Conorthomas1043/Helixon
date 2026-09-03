"use client";

import { useState } from "react";

import { PageHeader, RangeControl, KpiCard, Panel, StatList } from "../_shared/ui";
import { useAdminStats } from "../_shared/hooks";

const STATUS_TONE = {
  active: "var(--ok)",
  trialing: "var(--accent-strong)",
  past_due: "var(--warn)",
  canceled: "var(--critical)",
};

export default function BillingPage() {
  const [range, setRange] = useState("30d");
  const { stats, error, reload } = useAdminStats(range);

  const byStatus = stats?.subscriptions?.byStatus || {};
  const byPlan = stats?.subscriptions?.byPlan || {};
  const totalSubs = stats?.totals?.subscriptions ?? 0;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Subscription and revenue status across all accounts."
      >
        <RangeControl range={range} setRange={setRange} />
        <button className="btn small" onClick={reload}>
          Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}

      <div className="kpi-grid">
        <KpiCard label="Active subs" value={byStatus.active ?? 0} tone="var(--ok)" />
        <KpiCard label="Trialing" value={byStatus.trialing ?? 0} tone="var(--accent-strong)" />
        <KpiCard label="Past due" value={byStatus.past_due ?? 0} tone="var(--warn)" />
        <KpiCard label="Cancelled" value={byStatus.canceled ?? 0} tone="var(--critical)" />
      </div>

      <div className="split section">
        <Panel title="Subscriptions by status" sub={`${totalSubs} total subscription records`}>
          <StatList
            rows={Object.entries(byStatus).map(([status, count]) => ({
              label: status,
              value: count,
              tone: STATUS_TONE[status],
            }))}
          />
        </Panel>

        <Panel title="Subscriptions by plan">
          <StatList
            rows={Object.entries(byPlan).map(([plan, count]) => ({
              label: plan,
              value: count,
            }))}
          />
        </Panel>
      </div>

      <div className="panel section">
        <div className="panel-title">Billing telemetry</div>
        <div className="footer-note">
          This view reads from the existing subscription and admin APIs — it
          never exposes Stripe secrets or payment credentials directly.
        </div>
      </div>
    </>
  );
}
