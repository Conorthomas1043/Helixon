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
import { TRAFFIC_CLASSES } from "@/lib/traffic-class";
import { timeAgo } from "../_shared/data";
import { csrfHeaders } from "../_shared/csrf";
import { toast } from "../_shared/toast";
import { placeLabel } from "@/lib/admin/traffic";

// Every refresh is itself a logged request, so live mode stays modest.
const LIVE_MS = 15_000;
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
// Match DETAIL_DAYS / RETENTION_DAYS in lib/site-settings.js (server-only module).
const DETAIL_DAYS = [3, 7, 14, 30];
const RETENTION_DAYS = [30, 60, 90];
const RANGES = ["24h", "7d", "30d", "90d"];
const NO_TEXT = { ip: "", path: "", ua: "", referrer: "" };
// Who the numbers are about. "People" leaves out bots, crawlers, uptime
// checks and the admin area itself.
const AUDIENCES = [
  { value: "people", label: "People" },
  { value: "automated", label: "Bots & crawlers" },
  { value: "all", label: "Everything" },
];
const CLASS_TO_AUDIENCE = { human: "people", crawler: "crawler", monitor: "monitor", bot: "bot" };
const AUDIENCE_LABEL = { people: "people", automated: "bots & crawlers", crawler: "search & previews", monitor: "uptime monitors", bot: "other bots", all: "all traffic" };
const VIEWS_KEY = "helixon.admin.trafficViews";
const ALERT_LABELS = { surge: "Traffic surge", blocked_surge: "Blocked surge", errors: "Server errors", ip_flood: "Flood from one address" };

// % change vs the previous period of the same length; null when there's
// nothing to compare against.
function change(current, previous) {
  if (previous === null || previous === undefined || current === null || current === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

// The page's filters <-> its URL, so a view can be bookmarked or shared.
const URL_KEYS = ["range", "audience", "country", "outcome", "flagged", "method", "ip", "path", "ua", "referrer"];
function readUrlState() {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  return Object.fromEntries(URL_KEYS.filter((k) => q.get(k)).map((k) => [k, q.get(k)]));
}

function loadViews() {
  try {
    const v = JSON.parse(window.localStorage.getItem(VIEWS_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.name === "string" && typeof x.query === "string").slice(0, 30) : [];
  } catch {
    return [];
  }
}

function storeViews(views) {
  try {
    window.localStorage.setItem(VIEWS_KEY, JSON.stringify(views));
  } catch {
    // private window / storage blocked - views just won't persist
  }
}

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

// What's recorded and kept, and when to alert (site_settings.traffic).
function SettingsPanel({ capture, onSaved }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const value = {
    captureHeaders: true,
    capturePayloads: true,
    detailDays: 14,
    retentionDays: 90,
    logMonitors: false,
    spikeAlerts: true,
    spikeMultiplier: 5,
    spikeMinRequests: 300,
    floodRequests: 300,
    ...capture,
    ...draft,
  };
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
      if (!response.ok) throw new Error(data.error || "Settings didn't save.");
      toast.success("Saved - every server picks it up within 30 seconds.");
      setDraft(null);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Recording, retention & alerts" sub="What's kept for each request, for how long, and when you get an email.">
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
            <Switch
              id="cap-monitors"
              label="Log uptime monitor checks"
              description="Sentry, UptimeRobot and similar ping the site every minute or so. Off keeps them out of the log; a check that looks suspicious or gets blocked is always logged."
              checked={value.logMonitors}
              onChange={(v) => set({ logMonitors: v })}
            />
            <Switch
              id="cap-spikes"
              label="Email me about spikes"
              description="A surge in requests or blocked requests, a burst of server errors, or one address flooding the site - checked every five minutes, at most one email an hour per kind, to the Security page's alert recipients."
              checked={value.spikeAlerts}
              onChange={(v) => set({ spikeAlerts: v })}
            />
          </div>
          {value.spikeAlerts && (
            <div className="filter-row" style={{ marginTop: 10, gap: 12 }}>
              <label className="field" style={{ minWidth: 150 }}>
                <span>Surge = times usual</span>
                <input type="number" min={2} max={50} value={value.spikeMultiplier} onChange={(e) => set({ spikeMultiplier: Number(e.target.value) })} />
              </label>
              <label className="field" style={{ minWidth: 150 }}>
                <span>and at least (per 15 min)</span>
                <input type="number" min={20} step={10} value={value.spikeMinRequests} onChange={(e) => set({ spikeMinRequests: Number(e.target.value) })} />
              </label>
              <label className="field" style={{ minWidth: 150 }}>
                <span>One IP flood (per 15 min)</span>
                <input type="number" min={20} step={10} value={value.floodRequests} onChange={(e) => set({ floodRequests: Number(e.target.value) })} />
              </label>
            </div>
          )}
          <div className="filter-row" style={{ marginTop: 10, gap: 12 }}>
            <label className="field">
              <span>Keep request detail for</span>
              <select value={value.detailDays} onChange={(e) => set({ detailDays: Number(e.target.value) })}>
                {DETAIL_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Delete log lines after</span>
              <select value={value.retentionDays} onChange={(e) => set({ retentionDays: Number(e.target.value) })}>
                {RETENTION_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d} days
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="footer-note">
            Detail (headers, query, body) is cleared first; the whole line - IP, browser, location, page - is deleted after the second period, as the privacy policy says. Never recorded: the body of requests that were let through, and anything the app sends back.
          </p>
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

function AlertsPanel({ alerts }) {
  return (
    <Panel title="Spike alerts" sub="Raised automatically - see the settings below.">
      {!alerts ? (
        <div className="skeleton" style={{ height: 120, marginTop: 12 }} />
      ) : !alerts.length ? (
        <div className="empty">No spikes so far.</div>
      ) : (
        <div className="mini-list" style={{ marginTop: 10, maxHeight: 300, overflowY: "auto" }}>
          {alerts.map((a) => (
            <div className="mini-row" key={a.id}>
              <div style={{ minWidth: 0 }}>
                <span className={`pill ${a.kind === "surge" ? "warn" : "bad"}`}>{ALERT_LABELS[a.kind] || a.kind}</span>
                <div className="faint" style={{ fontSize: 13, marginTop: 4 }}>
                  {a.message}
                  {a.details?.ip ? (
                    <>
                      {" "}
                      <Link className="panel-link" style={{ marginLeft: 0 }} href={`/admin/security/investigate?q=${encodeURIComponent(a.details.ip)}`}>
                        Investigate
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
              <span className="faint" style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                {timeAgo(a.created_at)}
                {a.emailed ? " · emailed" : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function TrafficPage() {
  // Everything starts from the URL, so a shared or bookmarked link opens
  // the same view (Command's map links here with ?country=).
  const [initial] = useState(readUrlState);
  const [range, setRange] = useState(RANGES.includes(initial.range) ? initial.range : "24h");
  const [audience, setAudience] = useState(initial.audience || "people");
  const [selected, setSelected] = useState(() => (initial.country ? { country: initial.country.toUpperCase().slice(0, 8), city: null, lat: null, lon: null } : null));
  // A bar clicked on the timeline: { from, to, label }.
  const [slice, setSlice] = useState(null);
  const [outcome, setOutcome] = useState(initial.outcome || "");
  const [flagged, setFlagged] = useState(initial.flagged === "1");
  const [method, setMethod] = useState(initial.method || "");
  // Typed filters apply on submit, not per keystroke.
  const startText = { ip: initial.ip || "", path: initial.path || "", ua: initial.ua || "", referrer: initial.referrer || "" };
  const [textInput, setTextInput] = useState(startText);
  const [text, setText] = useState(startText);
  const [live, setLive] = useState(false);
  const [inspecting, setInspecting] = useState(null);
  const [views, setViews] = useState([]);

  const filters = {
    audience,
    country: selected?.country || "",
    ip: text.ip,
    path: text.path,
    ua: text.ua,
    referrer: text.referrer,
    outcome,
    flagged,
    method,
    from: slice?.from || "",
    to: slice?.to || "",
  };
  const { traffic, error, busy, block, unblock, reload, olderRows, hasOlder, loadOlder } = useAdminTraffic(range, filters);
  const legacy = Boolean(traffic?.legacy);
  // Only needed while the database is missing migration 20261001100000.
  const { stats } = useAdminStats(legacy ? range : null);

  const query = useMemo(() => {
    const q = new URLSearchParams();
    if (range !== "24h") q.set("range", range);
    if (audience !== "people") q.set("audience", audience);
    if (selected?.country) q.set("country", selected.country);
    if (outcome) q.set("outcome", outcome);
    if (flagged) q.set("flagged", "1");
    if (method) q.set("method", method);
    for (const k of ["ip", "path", "ua", "referrer"]) if (text[k]) q.set(k, text[k]);
    return q.toString();
  }, [range, audience, selected, outcome, flagged, method, text]);

  // Keep the address bar in step (without a navigation).
  useEffect(() => {
    const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, "", next);
  }, [query]);

  // Saved views live in this browser.
  useEffect(() => {
    const stored = loadViews();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    if (stored.length) setViews(stored);
  }, []);

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
  const previous = traffic?.previous;
  const breakdowns = traffic?.breakdowns;
  const blocked = useMemo(() => traffic?.blockedIps || [], [traffic]);
  const blockedSet = useMemo(() => new Set(blocked.map((b) => b.ip)), [blocked]);
  const points = traffic?.globe || [];
  const flaggedTotal = summary?.flagged ?? (traffic?.timeline ? traffic.timeline.points.reduce((sum, p) => sum + p.flagged, 0) : null);
  const closeInspector = useCallback(() => setInspecting(null), []);
  const isBlocked = useCallback((ip) => blockedSet.has(ip), [blockedSet]);

  function applyQuery(qs) {
    const q = new URLSearchParams(qs);
    setRange(RANGES.includes(q.get("range")) ? q.get("range") : "24h");
    setAudience(q.get("audience") || "people");
    setSelected(q.get("country") ? { country: q.get("country").toUpperCase().slice(0, 8), city: null, lat: null, lon: null } : null);
    setSlice(null);
    setOutcome(q.get("outcome") || "");
    setFlagged(q.get("flagged") === "1");
    setMethod(q.get("method") || "");
    const t = { ip: q.get("ip") || "", path: q.get("path") || "", ua: q.get("ua") || "", referrer: q.get("referrer") || "" };
    setText(t);
    setTextInput(t);
  }

  function saveView() {
    const name = window.prompt("Name this view", "");
    if (!name || !name.trim()) return;
    const next = [...views.filter((v) => v.name !== name.trim()), { name: name.trim().slice(0, 60), query }].slice(-30);
    setViews(next);
    storeViews(next);
    toast.success(`Saved "${name.trim()}"`);
  }

  function deleteView(name) {
    const next = views.filter((v) => v.name !== name);
    setViews(next);
    storeViews(next);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link to this view copied");
    } catch {
      toast.error("Couldn't copy - the browser blocked clipboard access.");
    }
  }

  function changeRange(next) {
    setRange(next);
    setSlice(null); // a bar from the old range means nothing in the new one
  }

  function selectPoint(p) {
    setSelected((cur) => (cur && pointKey(cur) === pointKey(p) ? null : p));
  }

  // A row clicked in one of the breakdown panels: filter to it (again to clear).
  function filterTo(key, value) {
    const next = { ...text, [key]: text[key] === value ? "" : value };
    setText(next);
    setTextInput(next);
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
  const filterActive = Boolean(selected || slice || outcome || flagged || method || text.ip || text.path || text.ua || text.referrer);
  const delta = (key, goodWhen = "up") => (previous && summary ? { value: change(summary[key], previous[key]), goodWhen } : undefined);
  const errorsNote = (item) => (item.errors ? `${item.errors.toLocaleString()} err` : null);
  const classItems = (breakdowns?.class || []).map((c) => ({ ...c, label: TRAFFIC_CLASSES[c.name] || c.name }));

  const lists = breakdowns
    ? {
        paths: breakdowns.path,
        referrers: breakdowns.referrer,
        userAgents: breakdowns.user_agent,
        countries: breakdowns.country,
      }
    : {
        paths: stats?.traffic?.topPaths || [],
        referrers: stats?.traffic?.referrers || [],
        userAgents: stats?.traffic?.userAgents || [],
        countries: stats?.traffic?.countries || [],
      };

  return (
    <>
      <PageHeader title="Traffic" description="Every request to the site, who sent it, where it came from, and what the firewall did with it. Click any request to inspect it, or any row in a panel to filter to it.">
        <RangeControl range={range} setRange={changeRange} options={RANGES} />
        <button
          className={`btn small ${live ? "toggled" : ""}`}
          aria-pressed={live}
          onClick={() => setLive((v) => !v)}
          title="Refresh every 15 seconds"
        >
          {live && <span className="status-dot pulse" aria-hidden="true" />}
          {live ? "Live" : "Go live"}
        </button>
        <button className="btn small" onClick={reload} disabled={busy}>
          <Icon name="refresh" /> Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}
      {legacy && (
        <div className="notice section">
          The database is missing the latest traffic migration (20261001100000), so totals ignore the filters and the panels below are a sample of recent requests.
        </div>
      )}

      <div className="filter-row section" style={{ marginTop: 0 }}>
        <div className="segmented" role="group" aria-label="Whose traffic">
          {AUDIENCES.map((a) => (
            <button key={a.value} className={audience === a.value ? "active" : ""} aria-pressed={audience === a.value} onClick={() => setAudience(a.value)}>
              {a.label}
            </button>
          ))}
        </div>
        {!AUDIENCES.some((a) => a.value === audience) && (
          <button className="pill info" onClick={() => setAudience("all")} aria-label="Show all traffic">
            Only {AUDIENCE_LABEL[audience]} ✕
          </button>
        )}
        <span className="faint" style={{ fontSize: 13 }}>
          {audience === "people" ? "Bots, crawlers, uptime checks and the admin area are left out." : audience === "all" ? "Everything, including bots and your own admin use." : ""}
        </span>
        <div className="page-controls" style={{ marginLeft: "auto" }}>
          <select
            className="select-input"
            aria-label="Saved views"
            value=""
            onChange={(e) => {
              const v = views.find((x) => x.name === e.target.value);
              if (v) applyQuery(v.query);
            }}
          >
            <option value="">{views.length ? "Saved views…" : "No saved views"}</option>
            {views.map((v) => (
              <option key={v.name} value={v.name}>
                {v.name}
              </option>
            ))}
          </select>
          <button className="btn small" onClick={saveView}>
            Save view
          </button>
          {views.length > 0 && (
            <button
              className="btn small ghost"
              onClick={() => {
                const name = window.prompt(`Delete which view? (${views.map((v) => v.name).join(", ")})`, views[views.length - 1].name);
                if (name) deleteView(name);
              }}
            >
              Delete view
            </button>
          )}
          <button className="btn small ghost" onClick={copyLink}>
            <Icon name="copy" /> Copy link
          </button>
        </div>
      </div>

      <div className="kpi-grid cols-6">
        <KpiCard label="Requests" icon="traffic" value={formatNumber(summary?.requests)} delta={delta("requests")} foot={previous ? `vs previous ${range}` : `Last ${range}`} />
        <KpiCard label="Visitors" icon="users" value={formatNumber(summary?.visitors ?? summary?.uniqueIps)} delta={delta("visitors")} foot={summary?.visitors !== undefined ? "Browser + address, approx." : "Unique IPs"} />
        <KpiCard label="Blocked" icon="ban" tone="var(--critical)" value={formatNumber(summary?.blocked)} delta={delta("blocked", "down")} foot={summary ? `${blockedShare}% of requests` : undefined} />
        <KpiCard label="Flagged" icon="alert" tone="var(--warn)" value={formatNumber(flaggedTotal ?? undefined)} delta={delta("flagged", "down")} foot="Threat score 20 or more" />
        <KpiCard label="Not found" icon="search" value={formatNumber(summary?.notFound)} delta={delta("notFound", "down")} foot="Pages answered 404" />
        <KpiCard label="Server errors" icon="alert" tone={summary?.serverErrors ? "var(--critical)" : undefined} value={formatNumber(summary?.serverErrors)} delta={delta("serverErrors", "down")} foot="5xx responses" />
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
        <Panel title="Who's sending it" sub={`All of the ${range}, whatever the audience switch says - click a kind to see only it`}>
          {breakdowns ? (
            <BarList items={classItems} limit={4} onSelect={(item) => setAudience(CLASS_TO_AUDIENCE[item.name] || "all")} emptyLabel="No requests in this range." />
          ) : (
            <div className="empty">Needs the latest database migration.</div>
          )}
        </Panel>
        <AlertsPanel alerts={traffic ? traffic.alerts || [] : undefined} />
      </div>

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
                    <div className="faint truncate" style={{ fontSize: 13 }}>
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
          <BarList items={lists.paths} limit={8} onSelect={breakdowns ? (item) => filterTo("path", item.name) : undefined} active={text.path} note={errorsNote} />
        </Panel>
        <Panel title="Referrers" sub="By site">
          <BarList
            items={lists.referrers}
            limit={8}
            onSelect={breakdowns ? (item) => (item.name === "(direct)" ? null : filterTo("referrer", item.name)) : undefined}
            active={text.referrer}
          />
        </Panel>
        <Panel title="User agents">
          <BarList items={lists.userAgents} limit={8} onSelect={breakdowns ? (item) => filterTo("ua", item.name) : undefined} active={text.ua} />
        </Panel>
      </div>

      <div className="grid-3 section">
        <Panel title="Top countries">
          <BarList
            items={lists.countries}
            limit={8}
            onSelect={breakdowns ? (item) => (item.name === "(unknown)" ? null : selectPoint({ country: item.name, city: null, lat: null, lon: null })) : undefined}
            active={selected?.country}
          />
        </Panel>
        <Panel title="API endpoints" sub="Busiest /api routes, with errors">
          {breakdowns ? <BarList items={breakdowns.api} limit={8} onSelect={(item) => filterTo("path", item.name)} active={text.path} note={errorsNote} emptyLabel="No API calls in this range." /> : <div className="empty">Needs the latest database migration.</div>}
        </Panel>
        <Panel title="Broken links & errors" sub="Pages answered 404, and paths that failed with a server error">
          {breakdowns ? (
            <>
              <BarList items={breakdowns.not_found} limit={5} onSelect={(item) => filterTo("path", item.name)} active={text.path} emptyLabel="No 404s in this range." />
              {breakdowns.server_error.length > 0 && (
                <>
                  <div className="panel-sub" style={{ marginTop: 12 }}>Server errors (5xx)</div>
                  <BarList items={breakdowns.server_error} limit={5} onSelect={(item) => filterTo("path", item.name)} active={text.path} />
                </>
              )}
            </>
          ) : (
            <div className="empty">Needs the latest database migration.</div>
          )}
        </Panel>
      </div>

      <div className="section">
        <SettingsPanel capture={traffic?.capture} onSaved={reload} />
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <div className="panel-title">Request log</div>
            <div className="panel-sub">
              {formatNumber(rows.length)} {filterActive ? "matching " : ""}requests from {AUDIENCE_LABEL[audience] || "all traffic"} shown, newest first
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
            setText({ ip: textInput.ip.trim(), path: textInput.path.trim(), ua: textInput.ua.trim(), referrer: textInput.referrer.trim() });
          }}
        >
          <input className="search-input" placeholder="IP address" aria-label="Filter by IP" value={textInput.ip} onChange={(e) => setTextInput((t) => ({ ...t, ip: e.target.value }))} />
          <input className="search-input" placeholder="Path contains…" aria-label="Filter by path" value={textInput.path} onChange={(e) => setTextInput((t) => ({ ...t, path: e.target.value }))} />
          <input className="search-input" placeholder="User agent contains…" aria-label="Filter by user agent" value={textInput.ua} onChange={(e) => setTextInput((t) => ({ ...t, ua: e.target.value }))} />
          <input className="search-input" placeholder="Referrer contains…" aria-label="Filter by referrer" value={textInput.referrer} onChange={(e) => setTextInput((t) => ({ ...t, referrer: e.target.value }))} />
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
