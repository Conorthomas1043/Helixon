"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { PageHeader, RangeControl, KpiCard, Panel, BarList } from "../_shared/ui";
import { Globe, useGlobePoints } from "../_shared/globe";
import { RequestTable } from "../_shared/table";
import { useAdminStats, useAdminTraffic } from "../_shared/hooks";

export default function CommandPage() {
  const [range, setRange] = useState("24h");

  const { stats, error: statsError, reload: reloadStats } = useAdminStats(range);
  const {
    traffic,
    error: trafficError,
    busy,
    block,
    unblock,
    reload: reloadTraffic,
  } = useAdminTraffic(range);

  const trafficRows = traffic?.rows || [];
  const blocked = traffic?.blockedIps || [];
  const totals = stats?.totals || {};

  const blockedSet = useMemo(() => new Set(blocked.map((entry) => entry.ip)), [blocked]);
  const globePoints = useGlobePoints(traffic?.globe);

  const geolocatedEvents = (traffic?.globe || []).reduce(
    (sum, item) => sum + Number(item.count || 0),
    0,
  );

  const error = statsError || trafficError;

  function refresh() {
    reloadStats();
    reloadTraffic();
  }

  return (
    <>
      <PageHeader
        title="Command"
        description="Live snapshot of traffic, product usage, and revenue health."
      >
        <RangeControl range={range} setRange={setRange} />
        <button className="btn small" onClick={refresh} disabled={busy}>
          Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}

      <div className="kpi-grid">
        <KpiCard label="Requests" value={totals.requests ?? trafficRows.length} />

        <KpiCard
          label="Blocked"
          value={totals.blockedRequests ?? trafficRows.filter((row) => row.blocked).length}
          tone="var(--critical)"
        />

        <KpiCard label="Users" value={totals.users ?? "-"} />
        <KpiCard label="Employees" value={totals.employees ?? "-"} tone="var(--ok)" />
      </div>

      <div className="kpi-grid cols-6">
        <KpiCard label="Agencies" value={totals.agencies ?? "-"} />
        <KpiCard label="Candidates" value={totals.candidates ?? "-"} />
        <KpiCard label="Jobs" value={totals.jobs ?? "-"} />
        <KpiCard label="Analyses run" value={totals.analyses ?? "-"} />
        <KpiCard label="Demo requests" value={totals.demoRequests ?? "-"} />
        <KpiCard
          label="Failed logins"
          value={totals.failedAuthAttempts ?? "-"}
          tone={totals.failedAuthAttempts ? "var(--warn)" : undefined}
        />
      </div>

      <div className="split section">
        <div className="panel globe-panel">
          <div className="globe-overlay">
            <div className="panel-title">Live geo traffic</div>
            <div className="panel-sub">Drag to rotate, scroll to zoom.</div>
            <div className="panel-sub">{geolocatedEvents} geolocated events plotted.</div>
          </div>

          <div className="globe-legend">
            <span className="legend-item">
              <span className="legend-dot legend-ok" /> Traffic
            </span>

            <span className="legend-item">
              <span className="legend-dot legend-critical" /> Hotspot
            </span>
          </div>

          <Globe points={globePoints} />
        </div>

        <div className="panel">
          <div className="panel-title">Security posture</div>

          <div className="section">
            <div className="notice">
              Raw response bodies are <b>not</b> stored. Request metadata,
              blocking state, and safe analytics stay available for triage
              without retaining CVs, tokens, credentials, or generated
              documents.
            </div>
          </div>

          <div className="section">
            <div className="section-head">
              <div className="panel-title">Blocked IPs</div>
              <Link className="panel-link" href="/admin/security">
                Manage
              </Link>
            </div>

            {blocked.length === 0 ? (
              <div className="empty">
                No blocked IPs - anything blocked from Traffic shows up here.
              </div>
            ) : (
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="table">
                  <tbody>
                    {blocked.slice(0, 6).map((item) => (
                      <tr key={item.ip}>
                        <td className="mono">{item.ip}</td>
                        <td className="muted">{item.reason || "Admin block"}</td>
                        <td>
                          <button className="btn small" onClick={() => unblock(item.ip)}>
                            Unblock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid-3 section">
        <Panel title="Top paths">
          <BarList items={stats?.traffic?.topPaths || []} limit={6} />
        </Panel>

        <Panel title="Top countries">
          <BarList items={stats?.traffic?.countries || []} limit={6} />
        </Panel>

        <Panel title="Referrers">
          <BarList items={stats?.traffic?.referrers || []} limit={6} />
        </Panel>
      </div>

      <section className="section">
        <div className="section-head">
          <div className="panel-title">Recent requests</div>
          <Link className="btn small" href="/admin/traffic">
            View traffic log
          </Link>
        </div>

        <RequestTable rows={trafficRows.slice(0, 20)} blockedSet={blockedSet} onBlock={block} />
      </section>
    </>
  );
}
