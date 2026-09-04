"use client";

import { useEffect, useState } from "react";

import { PageHeader, KpiCard, Panel } from "../../_shared/ui";

function SeverityPill({ score }) {
  const severity = score >= 70 ? "critical" : score >= 40 ? "high" : score >= 20 ? "medium" : "low";
  const tone = severity === "critical" || severity === "high" ? "bad" : severity === "medium" ? "warn" : "good";
  return <span className={`pill ${tone}`}>{severity}</span>;
}

export default function SecurityInvestigatePage() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
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

  const q = query.trim().toLowerCase();
  const allRequests = data?.requests || [];
  const rows = allRequests
    .filter(
      (x) =>
        !q || `${x.ip} ${x.path} ${x.user_agent} ${x.country}`.toLowerCase().includes(q),
    )
    .slice(0, 200);

  return (
    <>
      <PageHeader
        title="Investigate"
        description="Raw, searchable request log with threat scoring - for tracing a specific IP, path, or user-agent across the tracked window."
      />

      {error && <div className="notice error section">{error}</div>}

      {loading ? (
        <div className="empty section">Loading…</div>
      ) : (
        <>
          <div className="kpi-grid cols-3">
            <KpiCard label="Requests in window" value={allRequests.length} />
            <KpiCard
              label="Flagged (score ≥20)"
              value={data?.kpis?.threats ?? "-"}
              tone="var(--warn)"
            />
            <KpiCard
              label="Denied at the edge"
              value={data?.kpis?.blockedRequests ?? "-"}
              tone="var(--critical)"
            />
          </div>

          <Panel
            title="Request log"
            sub="Searches IP, path, user-agent, and country simultaneously."
            className="section"
          >
            <input
              className="search-input"
              placeholder="IP, path, country, or user-agent…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ marginBottom: 14, maxWidth: 420 }}
            />

            {rows.length === 0 ? (
              <div className="empty">No requests match.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>IP</th>
                      <th>Country</th>
                      <th>Method</th>
                      <th>Path</th>
                      <th>User-agent</th>
                      <th>Risk</th>
                      <th>Signals</th>
                      <th>Blocked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((x, i) => (
                      <tr key={`${x.ip}-${x.created_at}-${i}`}>
                        <td className="mono">
                          {x.created_at ? new Date(x.created_at).toLocaleString() : "-"}
                        </td>
                        <td className="mono">{x.ip}</td>
                        <td className="muted">{x.country || "-"}</td>
                        <td className="mono">{x.method}</td>
                        <td className="mono" title={x.path}>
                          {x.path}
                        </td>
                        <td className="muted mono" title={x.user_agent}>
                          {(x.user_agent || "-").slice(0, 40)}
                        </td>
                        <td>
                          <SeverityPill score={x.threat.score} />
                        </td>
                        <td className="muted">{(x.threat.signals || []).join(", ") || "-"}</td>
                        <td className="mono" style={x.blocked ? { color: "var(--critical)" } : undefined}>
                          {x.blocked ? "yes" : "no"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
