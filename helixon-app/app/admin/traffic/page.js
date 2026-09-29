"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { PageHeader, RangeControl, Panel, BarList, KpiCard, Switch } from "../_shared/ui";
import { Icon } from "../_shared/icons";
import { RequestTable } from "../_shared/table";
import TrafficMapPanel, { pointKey } from "../_shared/TrafficMapPanel";
import TrafficTimeline from "../_shared/TrafficTimeline";
import { OUTCOME_FILTERS, REQUEST_CSV_COLUMNS, RequestInspector, ThreatPill, downloadCsv } from "../_shared/traffic-ui";
import { useAdminStats, useAdminTraffic } from "../_shared/hooks";
import { timeAgo } from "../_shared/data";
import { csrfHeaders } from "../_shared/csrf";
import { toast } from "../_shared/toast";
import { placeLabel } from "@/lib/admin-traffic";

// Every refresh is itself a logged request, so live mode stays modest.
const LIVE_MS = 15_000;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
// Matches DETAIL_DAYS in lib/site-settings.js (server-only module).
const DETAIL_DAYS = [3, 7, 14, 30];
const NO_TEXT = { ip: "", path: "", ua: "" };

function formatNumber(n) {
  return typeof n === "number" ? n.toLocaleString() : "-";
}

function TopIpsPanel({ topIps, blockedSet }) {
  return (
    <Panel title="Top IPs" sub="The busiest addresses in range. Open one for its full history and a lookup of who's behind it.">
      {topIps === undefined ? (
        <div className="skeleton" style={{ height: 200, marginTop: 12 }} />
      ) : topIps === null ? (
        <div className="empty">Needs the latest database migration (request_inspector).</div>
      ) : !topIps.length ? (
        <div className="empty">No requests in this range.</div>
      ) : (
        <div className="table-wrap" style={{ marginTop: 12, maxHeight: 360 }}>
          <table className="table compact">
            <thead>
              <tr>
                <th>IP</th>
                <th className="num">Requests</th>
                <th className="num">Blocked</th>
                <th>Worst threat</th>
                <th>Country</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {topIps.map((row) => (
                <tr key={row.ip}>
                  <td>
                    <Link className="mono panel-link" style={{ marginLeft: 0 }} href={`/admin/security/investigate?q=${encodeURIComponent(row.ip)}`}>
                      {row.ip}
                    </Link>
                    {blockedSet.has(row.ip) && <span className="pill bad bare" style={{ marginLeft: 8 }}>Blocked</span>}
                  </td>
                  <td className="num">{Number(row.requests).toLocaleString()}</td>
                  <td className="num">{Number(row.blocked).toLocaleString()}</td>
                  <td>
                    <ThreatPill score={row.max_threat} />
                  </td>
                  <td className="muted">{(row.countries || []).join(", ") || "-"}</td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{timeAgo(row.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// What the request inspector keeps (site_settings.traffic).
function CapturePanel({ capture, onSaved }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const value = { captureHeaders: true, capturePayloads: true, detailDays: 14, ...capture, ...draft };
  const dirty = Boolean(draft) && Object.keys(draft).some((k) => draft[k] !== capture?.[k]);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/site", {
        method: "PATCH",
        headers: csrfHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ key: "traffic", value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Capture settings didn't save.");
      toast.success("Capture settings saved - every server picks them up within 30 seconds.");
      setDraft(null);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="What's recorded" sub="Detail kept for each request, shown in the request inspector.">
      {!capture ? (
        <div className="skeleton" style={{ height: 150, marginTop: 12 }} />
      ) : (
        <>
          <div className="switch-list">
            <Switch
              id="cap-headers"
              label="Headers and query strings"
              description="Every header, with cookies, tokens, signatures and passwords replaced by a marker saying they were there."
              checked={value.captureHeaders}
              onChange={(v) => set({ captureHeaders: v })}
            />
            <Switch
              id="cap-bodies"
              label="Bodies of blocked requests"
              description="Only for requests the firewall blocked - redacted the same way and cut off at 4,000 characters."
              checked={value.capturePayloads}
              onChange={(v) => set({ capturePayloads: v })}
            />
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="cap-days">Keep request detail for</label>
            <select id="cap-days" value={value.detailDays} onChange={(e) => set({ detailDays: Number(e.target.value) })}>
              {DETAIL_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
            <span className="faint" style={{ fontSize: 12 }}>
              After that the daily clean-up clears headers, and the query and body of anything that wasn&apos;t flagged. The log line itself stays.
            </span>
          </div>
          <p className="footer-note">Never recorded: the body of requests that were let through, and anything the app sends back.</p>
          <div className="actions" style={{ marginTop: 10 }}>
            <button className="btn small primary" disabled={!dirty || saving} onClick={save}>
              {saving ? "Saving…" : "Save"}
            </button>
            {dirty && (
              <button className="btn small ghost" onClick={() => setDraft(null)} disabled={saving}>
                Discard
              </button>
            )}
          </div>
        </>
      )}
    </Panel>
  );
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
  // A bar clicked on the timeline: { from, to, label }.
  const [slice, setSlice] = useState(null);
  const [outcome, setOutcome] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [method, setMethod] = useState("");
  // Typed filters apply on submit, not per keystroke.
  const [textInput, setTextInput] = useState(NO_TEXT);
  const [text, setText] = useState(NO_TEXT);
  const [live, setLive] = useState(false);
  const [inspecting, setInspecting] = useState(null);

  const filters = { country: selected?.country || "", ip: text.ip, path: text.path, ua: text.ua, outcome, flagged, method, from: slice?.from || "", to: slice?.to || "" };
  const { traffic, error, busy, block, unblock, reload, olderRows, hasOlder, loadOlder } = useAdminTraffic(range, filters);
  const { stats, reload: reloadStats } = useAdminStats(range);

  // Live: refresh the log, chart and totals while the tab is visible.
  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) reload();
    }, LIVE_MS);
    return () => clearInterval(timer);
  }, [live, reload]);

  const rows = useMemo(() => [...(traffic?.rows || []), ...olderRows], [traffic, olderRows]);
  const summary = traffic?.summary;
  const blocked = useMemo(() => traffic?.blockedIps || [], [traffic]);
  const blockedSet = useMemo(() => new Set(blocked.map((b) => b.ip)), [blocked]);
  const points = traffic?.globe || [];
  const flaggedTotal = traffic?.timeline ? traffic.timeline.points.reduce((sum, p) => sum + p.flagged, 0) : null;
  const closeInspector = useCallback(() => setInspecting(null), []);
  const isBlocked = useCallback((ip) => blockedSet.has(ip), [blockedSet]);

  function changeRange(next) {
    setRange(next);
    setSlice(null); // a bar from the old range means nothing in the new one
  }

  function selectPoint(p) {
    setSelected((cur) => (cur && pointKey(cur) === pointKey(p) ? null : p));
  }

  function clearFilters() {
    setSelected(null);
    setSlice(null);
    setOutcome("");
    setFlagged(false);
    setMethod("");
    setText(NO_TEXT);
    setTextInput(NO_TEXT);
  }

  function exportCsv() {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    downloadCsv(`helixon-requests-${range}-${stamp}.csv`, REQUEST_CSV_COLUMNS, rows);
    toast.success(`Exported ${rows.length.toLocaleString()} requests`);
  }

  const blockedShare = summary?.requests ? Math.round((summary.blocked / summary.requests) * 100) : 0;
  const filterActive = Boolean(selected || slice || outcome || flagged || method || text.ip || text.path || text.ua);

  return (
    <>
      <PageHeader title="Traffic" description="Every request to the site, where it came from, and what the firewall did with it. Click any request to inspect it in full.">
        <RangeControl range={range} setRange={changeRange} />
        <button
          className={`btn small ${live ? "toggled" : ""}`}
          aria-pressed={live}
          onClick={() => setLive((v) => !v)}
          title="Refresh every 15 seconds"
        >
          {live && <span className="status-dot pulse" aria-hidden="true" />}
          {live ? "Live" : "Go live"}
        </button>
        <button className="btn small" onClick={() => { reload(); reloadStats(); }} disabled={busy}>
          <Icon name="refresh" /> Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}

      <div className="kpi-grid cols-5">
        <KpiCard label="Requests" icon="traffic" value={formatNumber(summary?.requests)} foot={`Last ${range}`} />
        <KpiCard label="Blocked" icon="ban" tone="var(--critical)" value={formatNumber(summary?.blocked)} foot={summary ? `${blockedShare}% of requests` : undefined} />
        <KpiCard label="Flagged" icon="alert" tone="var(--warn)" value={formatNumber(flaggedTotal ?? undefined)} foot="Threat score 20 or more" />
        <KpiCard label="Unique IPs" icon="users" value={formatNumber(summary?.uniqueIps)} />
        <KpiCard label="Countries" icon="globe" value={formatNumber(summary?.countries)} foot={summary ? `${formatNumber(summary.geolocated)} requests located` : undefined} />
      </div>

      <TrafficTimeline
        timeline={traffic ? traffic.timeline : undefined}
        since={traffic?.since}
        busy={busy}
        selected={slice}
        onSelect={setSlice}
      />

      <TrafficMapPanel
        points={points}
        summary={summary}
        partial={traffic?.partial}
        onSelect={selectPoint}
        selectedKey={selected ? pointKey(selected) : null}
      />

      <div className="split section">
        <TopIpsPanel topIps={traffic ? traffic.topIps : undefined} blockedSet={blockedSet} />

        <Panel
          title="Blocked IPs"
          sub={`${blocked.length} active · allow list, ranges and country blocks are on Security`}
          action={<Link href="/admin/security" className="panel-link">Manage firewall</Link>}
        >
          {blocked.length === 0 ? (
            <div className="empty" style={{ padding: "24px 0 8px" }}>No blocked IPs.</div>
          ) : (
            <div className="mini-list" style={{ marginTop: 10, maxHeight: 330, overflowY: "auto" }}>
              {blocked.map((b) => (
                <div className="mini-row" key={b.ip}>
                  <div style={{ minWidth: 0 }}>
                    <Link className="mono panel-link" style={{ marginLeft: 0 }} href={`/admin/security/investigate?q=${encodeURIComponent(b.ip)}`}>
                      {b.ip}
                    </Link>
                    <div className="faint truncate" style={{ fontSize: 12 }}>
                      {b.reason || "Admin block"}{b.created_by ? ` · by ${b.created_by}` : ""}{b.expires_at ? ` · lifts ${new Date(b.expires_at).toLocaleString()}` : " · permanent"}
                    </div>
                  </div>
                  <button className="btn small" onClick={() => unblock(b.ip)} disabled={busy}>Unblock</button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

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
        <Panel title="Top countries" sub="All requests in range, including ones without a precise location">
          <BarList items={stats?.traffic?.countries || []} limit={8} />
        </Panel>
        <CapturePanel capture={traffic?.capture} onSaved={reload} />
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="panel-title">Request log</div>
            <div className="panel-sub">
              {formatNumber(rows.length)} {filterActive ? "matching " : ""}requests shown, newest first
              {selected ? ` · from ${placeLabel({ country: selected.country })}` : ""}
              {slice ? ` · ${slice.label}` : ""}
            </div>
          </div>
          <div className="page-controls">
            <button className="btn small" onClick={exportCsv} disabled={!rows.length}>
              <Icon name="arrowDown" /> Export CSV
            </button>
          </div>
        </div>

        <div className="filter-row">
          <div className="segmented" role="group" aria-label="Outcome">
            {OUTCOME_FILTERS.map((o) => (
              <button key={o.value || "all"} className={outcome === o.value ? "active" : ""} aria-pressed={outcome === o.value} onClick={() => setOutcome(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <button className={`btn small ${flagged ? "toggled" : ""}`} aria-pressed={flagged} onClick={() => setFlagged((v) => !v)}>
            Flagged only
          </button>
          <select className="select-input" aria-label="Method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Any method</option>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          {selected && (
            <button className="pill info" onClick={() => setSelected(null)} aria-label={`Clear country filter ${selected.country}`}>
              Country: {selected.country} ✕
            </button>
          )}
          {slice && (
            <button className="pill info" onClick={() => setSlice(null)} aria-label="Clear the time filter">
              {slice.label} ✕
            </button>
          )}
        </div>

        <form
          className="filter-row"
          onSubmit={(e) => {
            e.preventDefault();
            setText({ ip: textInput.ip.trim(), path: textInput.path.trim(), ua: textInput.ua.trim() });
          }}
        >
          <input className="search-input" placeholder="IP address" aria-label="Filter by IP" value={textInput.ip} onChange={(e) => setTextInput((t) => ({ ...t, ip: e.target.value }))} />
          <input className="search-input" placeholder="Path contains…" aria-label="Filter by path" value={textInput.path} onChange={(e) => setTextInput((t) => ({ ...t, path: e.target.value }))} />
          <input className="search-input" placeholder="User agent contains…" aria-label="Filter by user agent" value={textInput.ua} onChange={(e) => setTextInput((t) => ({ ...t, ua: e.target.value }))} />
          <button className="btn small" type="submit">Apply</button>
          {filterActive && (
            <button type="button" className="btn small ghost" onClick={clearFilters}>
              Clear all filters
            </button>
          )}
        </form>

        <RequestTable
          rows={rows}
          blockedSet={blockedSet}
          onBlock={(ip) => block(ip)}
          onOpen={(row) => setInspecting(row.id)}
          emptyLabel={filterActive ? "No requests match these filters." : undefined}
        />

        {(hasOlder || olderRows.length > 0) && (
          <div className="table-foot" style={{ border: 0, background: "transparent", padding: "12px 2px" }}>
            {/* Each live refresh starts the log again from the newest request. */}
            <span>
              {!hasOlder ? "That's every matching request in this range." : live ? "Pause live updates to load older requests." : "Older requests in this range aren't shown yet."}
            </span>
            {hasOlder && !live && (
              <button className="btn small" onClick={loadOlder} disabled={busy}>
                {busy ? "Loading…" : "Load older"}
              </button>
            )}
          </div>
        )}
      </section>

      <RequestInspector id={inspecting} onClose={closeInspector} onBlock={(ip) => block(ip)} blocked={isBlocked} />
    </>
  );
}
