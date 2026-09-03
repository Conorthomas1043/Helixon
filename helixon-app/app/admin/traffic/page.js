"use client";

import { useState } from "react";

import { PageHeader, RangeControl, Panel, BarList } from "../_shared/ui";
import { RequestTable } from "../_shared/table";
import { useAdminStats, useAdminTraffic } from "../_shared/hooks";

export default function TrafficPage() {
  const [range, setRange] = useState("24h");
  const [view, setView] = useState("log");

  const { traffic, error, busy, block, reload } = useAdminTraffic(range);
  const { stats } = useAdminStats(range);

  const trafficRows = traffic?.rows || [];
  const blockedSet = new Set((traffic?.blockedIps || []).map((entry) => entry.ip));

  return (
    <>
      <PageHeader
        title="Traffic"
        description="Inbound requests, blocking decisions, and IP-level detail."
      >
        <RangeControl range={range} setRange={setRange} />
        <button className="btn small" onClick={reload} disabled={busy}>
          Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}

      <div className="kpi-grid cols-3">
        <div className="kpi-card">
          <div className="kpi-label">Requests in range</div>
          <div className="kpi-value">{trafficRows.length}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Blocked</div>
          <div className="kpi-value" style={{ color: "var(--critical)" }}>
            {trafficRows.filter((row) => row.blocked).length}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Geolocated</div>
          <div className="kpi-value">{traffic?.geolocation?.resolvedIps ?? "—"}</div>
        </div>
      </div>

      <div className="grid-3 section">
        <Panel title="Top paths">
          <BarList items={stats?.traffic?.topPaths || []} limit={8} />
        </Panel>

        <Panel title="Top countries">
          <BarList items={stats?.traffic?.countries || []} limit={8} />
        </Panel>

        <Panel title="User agents">
          <BarList items={stats?.traffic?.userAgents || []} limit={8} />
        </Panel>
      </div>

      <section className="section">
        <div className="section-head">
          <div className="panel-title">Request log</div>
          <div className="segmented">
            <button className={view === "log" ? "active" : ""} onClick={() => setView("log")}>
              All requests
            </button>
            <button
              className={view === "blocked" ? "active" : ""}
              onClick={() => setView("blocked")}
            >
              Blocked only
            </button>
          </div>
        </div>

        <RequestTable
          rows={view === "blocked" ? trafficRows.filter((row) => row.blocked) : trafficRows}
          blockedSet={blockedSet}
          onBlock={block}
        />
      </section>
    </>
  );
}
