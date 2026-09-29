"use client";
// /admin/seo - acquisition for a chosen window: channels, referrers,
// campaigns, landing pages and countries, with requests and demo requests
// compared against the window before it. Everything comes from our own
// request and demo-request logs - no third-party analytics.

import { useState } from "react";

import { PageHeader, KpiCard, Panel, BarList, RangeControl } from "../_shared/ui";
import { useAdminData, formatNumber } from "../_shared/data";
import { Icon } from "../_shared/icons";
import { downloadCsv } from "@/lib/csv";

const RANGE_LABEL = { "24h": "24 hours", "7d": "7 days", "30d": "30 days", "90d": "90 days" };

function asBarItems(rows = [], nameKey) {
  return rows.map((row) => ({ name: row[nameKey] || "-", count: row.count }));
}

// % change vs the previous window; null when there's nothing to compare.
function change(current, previous) {
  if (previous === null || previous === undefined || current === null || current === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export default function SeoPage() {
  const [range, setRange] = useState("30d");
  const { data, error, loading, reload } = useAdminData(`/api/admin/ops?range=${range}`);
  const seo = data?.seo;
  const kpis = data?.kpis;
  const previous = data?.previous;

  const requests = kpis?.requests ?? null;
  const demos = kpis?.demos ?? null;
  const perThousand = requests ? ((demos || 0) / requests) * 1000 : null;
  const prevPerThousand = previous?.requests ? ((previous.demos || 0) / previous.requests) * 1000 : null;

  function exportCsv() {
    const rows = [
      ...(seo?.channels || []).map((r) => ({ type: "channel", name: r.channel, count: r.count })),
      ...(seo?.referrers || []).map((r) => ({ type: "referrer", name: r.referrer, count: r.count })),
      ...(seo?.campaigns || []).map((r) => ({ type: "campaign", name: r.campaign, count: r.count })),
      ...(seo?.topPaths || []).map((r) => ({ type: "landing_path", name: r.path, count: r.count })),
      ...(seo?.topCountries || []).map((r) => ({ type: "country", name: r.country, count: r.count })),
    ];
    downloadCsv(`helixon-acquisition-${range}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <>
      <PageHeader
        title="SEO / Acquisition"
        description="Channel mix, campaign performance and landing pages for the selected window, compared with the window before. Derived from UTM and referrer data, no synthetic traffic."
      >
        <RangeControl range={range} setRange={setRange} options={["24h", "7d", "30d", "90d"]} />
        <button className="btn small" onClick={exportCsv} disabled={!seo}>Export CSV</button>
        <button className="btn small" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={13} /> Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}

      {loading && !data ? (
        <div className="empty section">Loading…</div>
      ) : (
        <>
          <div className="kpi-grid">
            <KpiCard
              label="Tracked requests"
              icon="traffic"
              value={requests === null ? "-" : formatNumber(requests)}
              delta={{ value: change(requests, previous?.requests) }}
              foot={`vs previous ${RANGE_LABEL[range]}`}
            />
            <KpiCard
              label="Demo requests"
              icon="inbox"
              tone="var(--ok)"
              value={demos === null ? "-" : formatNumber(demos)}
              delta={{ value: change(demos, previous?.demos) }}
              foot={`vs previous ${RANGE_LABEL[range]}`}
            />
            <KpiCard
              label="Demos per 1,000 requests"
              icon="trending"
              value={perThousand === null ? "-" : perThousand.toFixed(1)}
              delta={{ value: perThousand !== null && prevPerThousand ? Math.round(((perThousand - prevPerThousand) / prevPerThousand) * 100) : null }}
              foot="How well traffic converts"
            />
            <KpiCard label="Trial verifications" icon="check" value={kpis?.trials ?? "-"} foot="All time" />
          </div>

          {data?.sampled && requests > 0 && (
            <div className="notice section">
              Breakdowns below are from the newest {formatNumber(5000)} requests in this window; the totals above count all of them.
            </div>
          )}

          <div className="grid-3 section">
            <Panel title="Acquisition channels" sub="Where sessions are classified as originating.">
              <BarList items={asBarItems(seo?.channels, "channel")} limit={8} />
            </Panel>

            <Panel title="Top referrers" sub="External sites sending the most traffic.">
              <BarList items={asBarItems(seo?.referrers, "referrer")} limit={8} />
            </Panel>

            <Panel title="Top countries" sub="Geographic spread of inbound requests.">
              <BarList items={asBarItems(seo?.topCountries, "country")} limit={8} />
            </Panel>
          </div>

          <div className="grid-2 section">
            <Panel title="Top campaigns" sub="UTM source / medium / campaign on demo requests, most first.">
              <BarList items={asBarItems(seo?.campaigns, "campaign")} limit={12} />
            </Panel>

            <Panel title="Top landing paths" sub="Most-requested paths in this window.">
              <BarList items={asBarItems(seo?.topPaths, "path")} limit={12} />
            </Panel>
          </div>

          <div className="footer-note section">
            Figures are derived from server-side request and demo-request
            telemetry only - no third-party analytics pixel, no cookie-based
            tracking beyond the admin session itself.
          </div>
        </>
      )}
    </>
  );
}
