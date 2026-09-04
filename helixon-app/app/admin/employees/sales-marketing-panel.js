"use client";

import { KpiCard, Panel, BarList, StatList } from "../_shared/ui";
import { useAdminStats } from "../_shared/hooks";

const STATUS_TONE = {
  active: "var(--ok)",
  trialing: "var(--accent-strong)",
  past_due: "var(--warn)",
  canceled: "var(--critical)",
};

export default function SalesMarketingPanel({ range }) {
  const { stats, error, loading } = useAdminStats(range);

  const totals = stats?.totals || {};
  const byStatus = stats?.subscriptions?.byStatus || {};
  const byPlan = stats?.subscriptions?.byPlan || {};
  const traffic = stats?.traffic || {};

  return (
    <>
      {error && <div className="notice error section">{error}</div>}

      <div className="kpi-grid cols-6">
        <KpiCard
          label="Leads (demo requests)"
          value={totals.demoRequests ?? "-"}
          foot="All-time"
        />
        <KpiCard
          label="Customer accounts"
          value={totals.agencies ?? "-"}
          foot="All-time"
        />
        <KpiCard
          label="Active subscriptions"
          value={byStatus.active ?? 0}
          tone="var(--ok)"
        />
        <KpiCard
          label="Trialing"
          value={byStatus.trialing ?? 0}
          tone="var(--accent-strong)"
        />
        <KpiCard
          label="Past due"
          value={byStatus.past_due ?? 0}
          tone="var(--warn)"
        />
        <KpiCard
          label="Site visits"
          value={totals.requests ?? "-"}
          foot={`Last ${range}`}
        />
      </div>

      <div className="grid-3 section">
        <Panel
          title="Top pages"
          sub="Most-visited pages - a quick read on what content is pulling traffic."
        >
          {loading ? (
            <div className="empty">Loading…</div>
          ) : (
            <BarList items={traffic.topPaths || []} limit={8} />
          )}
        </Panel>

        <Panel
          title="Traffic sources"
          sub="Where visitors came from - search, social, or a direct link."
        >
          {loading ? (
            <div className="empty">Loading…</div>
          ) : (
            <BarList items={traffic.referrers || []} limit={8} />
          )}
        </Panel>

        <Panel
          title="Visitor countries"
          sub="Where prospects are located - useful for territory planning."
        >
          {loading ? (
            <div className="empty">Loading…</div>
          ) : (
            <BarList items={traffic.countries || []} limit={8} />
          )}
        </Panel>
      </div>

      <div className="split section">
        <Panel
          title="Subscriptions by plan"
          sub="What customers are actually buying."
        >
          <StatList
            rows={Object.entries(byPlan).map(([plan, count]) => ({
              label: plan,
              value: count,
            }))}
          />
        </Panel>

        <Panel
          title="Subscriptions by status"
          sub="Simple pipeline health check."
        >
          <StatList
            rows={Object.entries(byStatus).map(([status, count]) => ({
              label: status,
              value: count,
              tone: STATUS_TONE[status],
            }))}
          />
        </Panel>
      </div>

      <div className="footer-note section">
        This is pulled straight from Helixon&apos;s own site traffic logs and
        subscription records - not a third-party SEO tool, so treat “top pages”
        and “traffic sources” as directional, not keyword-level SEO data.
      </div>
    </>
  );
}
