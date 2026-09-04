"use client";

import { useMemo, useState } from "react";

import { PageHeader, RangeControl, KpiCard, Panel } from "../_shared/ui";
import { useAdminStats, useAdminTraffic } from "../_shared/hooks";

export default function SecurityPage() {
  const [range, setRange] = useState("24h");
  const [ipInput, setIpInput] = useState("");

  const { traffic, error, busy, block, unblock, reload } = useAdminTraffic(range);
  const { stats } = useAdminStats(range);

  const blocked = traffic?.blockedIps || [];
  const totals = stats?.totals || {};

  const hotspots = useMemo(
    () => (traffic?.globe || []).slice().sort((a, b) => b.count - a.count).slice(0, 10),
    [traffic?.globe],
  );

  function submitBlock(event) {
    event.preventDefault();
    const ip = ipInput.trim();
    if (!ip) return;
    block(ip);
    setIpInput("");
  }

  return (
    <>
      <PageHeader
        title="Security"
        description="Blocking decisions, authentication risk, and where traffic is coming from."
      >
        <RangeControl range={range} setRange={setRange} />
        <button className="btn small" onClick={reload} disabled={busy}>
          Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}

      <div className="kpi-grid">
        <KpiCard label="Blocked IPs" value={blocked.length} tone="var(--critical)" />
        <KpiCard label="Requests denied" value={totals.blockedRequests ?? "-"} />
        <KpiCard label="Login attempts" value={totals.loginAttempts ?? "-"} />
        <KpiCard
          label="Failed auth attempts"
          value={totals.failedAuthAttempts ?? "-"}
          tone={totals.failedAuthAttempts ? "var(--warn)" : undefined}
        />
      </div>

      <div className="notice section">
        Raw response bodies are <b>not</b> stored. Request metadata, blocking
        state, and safe analytics stay available for triage without retaining
        CVs, tokens, credentials, or generated documents.
      </div>

      <div className="split section">
        <Panel title="Blocked IPs" sub="Manually or automatically denied sources.">
          <form
            onSubmit={submitBlock}
            className="actions"
            style={{ marginBottom: 14, gap: 8 }}
          >
            <input
              className="search-input"
              placeholder="IP address to block…"
              value={ipInput}
              onChange={(event) => setIpInput(event.target.value)}
            />
            <button className="btn primary small" disabled={busy || !ipInput.trim()}>
              Block IP
            </button>
          </form>

          {blocked.length === 0 ? (
            <div className="empty">No blocked IPs yet.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>IP</th>
                    <th>Reason</th>
                    <th>Blocked by</th>
                    <th>Since</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {blocked.map((item) => (
                    <tr key={item.ip}>
                      <td className="mono">{item.ip}</td>
                      <td className="muted">{item.reason || "Admin block"}</td>
                      <td className="muted">{item.created_by || "-"}</td>
                      <td className="mono">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : "-"}
                      </td>
                      <td>
                        <button className="btn small" onClick={() => unblock(item.ip)} disabled={busy}>
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Traffic hotspots" sub="Highest-volume geographic sources in range.">
          {hotspots.length === 0 ? (
            <div className="empty">No geolocated traffic in this range.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>Requests</th>
                    <th>Blocked</th>
                    <th>Unique IPs</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((point, index) => (
                    <tr key={`${point.city}-${point.country}-${index}`}>
                      <td>{[point.city, point.country].filter(Boolean).join(", ") || "-"}</td>
                      <td className="mono">{point.count}</td>
                      <td className="mono" style={point.blocked ? { color: "var(--critical)" } : undefined}>
                        {point.blocked}
                      </td>
                      <td className="mono">{point.uniqueIps}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="footer-note section">
        Geolocation is derived from Vercel edge headers captured at request
        time - no third-party lookup, no added latency.
      </div>
    </>
  );
}
