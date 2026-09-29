"use client";

import { useMemo, useState } from "react";

import { PageHeader, RangeControl, Panel, BarList, KpiCard } from "../_shared/ui";
import { RequestTable } from "../_shared/table";
import TrafficMapPanel, { pointKey } from "../_shared/TrafficMapPanel";
import { useAdminStats, useAdminTraffic } from "../_shared/hooks";
import { placeLabel } from "@/lib/admin-traffic";

function formatNumber(n) {
  return typeof n === "number" ? n.toLocaleString() : "-";
}

export default function TrafficPage() {
  const [range, setRange] = useState("24h");
  // Map point driving the country filter; ?country=GB (from Command's map)
  // starts the page filtered.
  const [selected, setSelected] = useState(() => {
    if (typeof window === "undefined") return null;
    const c = new URLSearchParams(window.location.search).get("country");
    return c ? { country: c.toUpperCase().slice(0, 8), city: null, lat: null, lon: null } : null;
  });
  const [ipInput, setIpInput] = useState("");
  const [ipFilter, setIpFilter] = useState("");
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [blockForm, setBlockForm] = useState({ ip: "", reason: "" });

  const filters = { country: selected?.country || "", ip: ipFilter, blocked: onlyBlocked };
  const { traffic, error, busy, block, unblock, reload } = useAdminTraffic(range, filters);
  const { stats } = useAdminStats(range);

  const rows = traffic?.rows || [];
  const summary = traffic?.summary;
  const blocked = useMemo(() => traffic?.blockedIps || [], [traffic]);
  const blockedSet = useMemo(() => new Set(blocked.map((b) => b.ip)), [blocked]);
  const points = traffic?.globe || [];

  function selectPoint(p) {
    setSelected((cur) => (cur && pointKey(cur) === pointKey(p) ? null : p));
  }

  async function submitBlock(e) {
    e.preventDefault();
    const ok = await block(blockForm.ip.trim(), blockForm.reason.trim() || "Admin block");
    if (ok) setBlockForm({ ip: "", reason: "" });
  }

  const blockedShare = summary?.requests ? Math.round((summary.blocked / summary.requests) * 100) : 0;
  const filterActive = selected || ipFilter || onlyBlocked;

  return (
    <>
      <PageHeader title="Traffic" description="Every request to the site, where it came from, and what the firewall did with it.">
        <RangeControl range={range} setRange={setRange} />
        <button className="btn small" onClick={reload} disabled={busy}>
          Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}

      <div className="kpi-grid">
        <KpiCard label="Requests" icon="traffic" value={formatNumber(summary?.requests)} foot={`Last ${range}`} />
        <KpiCard label="Blocked" icon="ban" tone="var(--critical)" value={formatNumber(summary?.blocked)} foot={summary ? `${blockedShare}% of requests` : undefined} />
        <KpiCard label="Unique IPs" icon="users" value={formatNumber(summary?.uniqueIps)} />
        <KpiCard label="Countries" icon="globe" value={formatNumber(summary?.countries)} foot={summary ? `${formatNumber(summary.geolocated)} requests located` : undefined} />
      </div>

      <TrafficMapPanel
        points={points}
        summary={summary}
        partial={traffic?.partial}
        onSelect={selectPoint}
        selectedKey={selected ? pointKey(selected) : null}
      />

      <div className="grid-3 section">
        <Panel title="Top paths">
          <BarList items={stats?.traffic?.topPaths || []} limit={8} />
        </Panel>
        <Panel title="Referrers">
          <BarList items={stats?.traffic?.referrers || []} limit={8} />
        </Panel>
        <Panel title="User agents">
          <BarList items={stats?.traffic?.userAgents || []} limit={8} />
        </Panel>
      </div>

      <div className="split section">
        <Panel title="Blocked IPs" sub={`${blocked.length} blocked · every request from these goes to the rate-limited page`}>
          <form onSubmit={submitBlock} className="inline-form" style={{ marginTop: 12 }}>
            <input className="search-input no-icon" placeholder="IP address" value={blockForm.ip} onChange={(e) => setBlockForm((f) => ({ ...f, ip: e.target.value }))} aria-label="IP address to block" required />
            <input className="search-input no-icon" placeholder="Reason (optional)" value={blockForm.reason} onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))} aria-label="Reason" />
            <button className="btn danger" disabled={busy || !blockForm.ip.trim()}>Block IP</button>
          </form>
          {blocked.length === 0 ? (
            <div className="empty" style={{ padding: "24px 0 8px" }}>No blocked IPs.</div>
          ) : (
            <div className="mini-list" style={{ marginTop: 10, maxHeight: 280, overflowY: "auto" }}>
              {blocked.map((b) => (
                <div className="mini-row" key={b.ip}>
                  <div style={{ minWidth: 0 }}>
                    <div className="mono">{b.ip}</div>
                    <div className="faint truncate" style={{ fontSize: 12 }}>
                      {b.reason || "Admin block"}{b.created_by ? ` · by ${b.created_by}` : ""}{b.created_at ? ` · ${new Date(b.created_at).toLocaleDateString()}` : ""}
                    </div>
                  </div>
                  <button className="btn small" onClick={() => unblock(b.ip)} disabled={busy}>Unblock</button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Top countries" sub="All requests in range, including ones without a precise location">
          <BarList items={stats?.traffic?.countries || []} limit={8} />
        </Panel>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="panel-title">Request log</div>
            <div className="panel-sub">
              Newest {formatNumber(traffic?.logLimit || 2000)} matching requests
              {selected ? ` from ${placeLabel({ country: selected.country })}` : ""}
            </div>
          </div>
          <div className="page-controls">
            {selected && (
              <button className="pill info" onClick={() => setSelected(null)} aria-label={`Clear country filter ${selected.country}`}>
                Country: {selected.country} ✕
              </button>
            )}
            <form onSubmit={(e) => { e.preventDefault(); setIpFilter(ipInput.trim()); }} className="inline-form">
              <input className="search-input" placeholder="Filter by IP" value={ipInput} onChange={(e) => setIpInput(e.target.value)} aria-label="Filter by IP" />
              {ipFilter && <button type="button" className="btn small ghost" onClick={() => { setIpFilter(""); setIpInput(""); }}>Clear</button>}
            </form>
            <div className="segmented" role="group" aria-label="Which requests">
              <button className={!onlyBlocked ? "active" : ""} aria-pressed={!onlyBlocked} onClick={() => setOnlyBlocked(false)}>All</button>
              <button className={onlyBlocked ? "active" : ""} aria-pressed={onlyBlocked} onClick={() => setOnlyBlocked(true)}>Blocked</button>
            </div>
          </div>
        </div>

        <RequestTable
          rows={rows}
          blockedSet={blockedSet}
          onBlock={(ip) => block(ip)}
          emptyLabel={filterActive ? "No requests match these filters." : undefined}
        />
      </section>
    </>
  );
}
