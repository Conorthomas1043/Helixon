"use client";

import { useEffect, useState } from "react";

import { PageHeader, KpiCard, Panel, BarList } from "../_shared/ui";

function useOpsData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/ops", { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Request failed");
        return body;
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, error, loading };
}

function asBarItems(rows = [], nameKey) {
  return rows.map((row) => ({ name: row[nameKey] || "-", count: row.count }));
}

export default function SeoPage() {
  const { data, error, loading } = useOpsData();
  const seo = data?.seo;
  const kpis = data?.kpis;

  return (
    <>
      <PageHeader
        title="SEO / Acquisition"
        description="Channel mix, campaign performance, and organic reach - derived from UTM and referrer telemetry, no synthetic traffic."
      />

      {error && <div className="notice error section">{error}</div>}

      {loading ? (
        <div className="empty section">Loading…</div>
      ) : (
        <>
          <div className="kpi-grid cols-3">
            <KpiCard label="Demo requests" value={kpis?.demos ?? "-"} />
            <KpiCard label="Trial verifications" value={kpis?.trials ?? "-"} />
            <KpiCard
              label="Tracked requests"
              value={kpis?.requests?.toLocaleString?.() ?? kpis?.requests ?? "-"}
            />
          </div>

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
            <Panel title="Top campaigns" sub="UTM source / medium / campaign combinations, most requests first.">
              <BarList items={asBarItems(seo?.campaigns, "campaign")} limit={12} />
            </Panel>

            <Panel title="Top landing paths" sub="Most-requested paths across the tracked window.">
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
