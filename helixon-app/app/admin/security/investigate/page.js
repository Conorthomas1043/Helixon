"use client";

// /admin/security/investigate - search the request log, or open an IP's
// dossier (?q=<ip>): its whole conversation with the site, who's behind it
// (public records only - nothing is ever sent to the address itself), the
// rest of its network range, and what the firewall makes of it, with the
// block / allow-list / dismiss actions to hand.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { PageHeader, KpiCard, Panel, BarList, StatList } from "../../_shared/ui";
import { Icon } from "../../_shared/icons";
import { useAdminData, formatDate, formatDateTime, timeAgo } from "../../_shared/data";
import { csrfHeaders } from "../../_shared/csrf";
import { confirmAction, promptText } from "../../_shared/modal";
import { toast } from "../../_shared/toast";
import { OutcomePill, RequestInspector, ThreatPill, formatStamp, outcomeOf, readableQuery, threatLevel } from "../../_shared/traffic-ui";

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
// Loose on purpose: the server validates properly. This only decides
// between opening a dossier and searching the log.
const IPV6 = /^[0-9a-f]{0,4}(:[0-9a-f]{0,4}){2,7}(:\d{1,3}(\.\d{1,3}){3})?$/i;
const looksLikeIp = (value) => IPV4.test(value) || (value.includes(":") && IPV6.test(value));

const DURATIONS = [
  { hours: 0, label: "Permanently" },
  { hours: 1, label: "For 1 hour" },
  { hours: 24, label: "For 24 hours" },
  { hours: 24 * 7, label: "For 7 days" },
  { hours: 24 * 30, label: "For 30 days" },
];
// A pause longer than this starts a new visit in the conversation.
const VISIT_GAP_MS = 30 * 60 * 1000;

async function send(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: csrfHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "That change didn't save.");
  return data;
}

function gapLabel(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 90) return `${minutes} minutes earlier`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} hours earlier` : `${Math.round(hours / 24)} days earlier`;
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const k = key(row);
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

// ── IP dossier ──────────────────────────────────────────────────────────

function Tags({ intel, status, activity }) {
  const tags = [];
  if (intel?.version) tags.push({ label: intel.version });
  if (intel?.scope === "private") tags.push({ label: "Private address", tone: "warn" });
  if (status.blocked) tags.push({ label: status.blocked.expires_at ? `Blocked · lifts ${timeAgo(status.blocked.expires_at)}` : "Blocked permanently", tone: "bad" });
  if (status.blockedRange) tags.push({ label: `In blocked range ${status.blockedRange}`, tone: "bad" });
  if (status.allowListed) tags.push({ label: "On the allow list", tone: "good" });
  if (status.dismissed) tags.push({ label: "Findings dismissed", tone: "info" });
  if (intel?.tor?.exit) tags.push({ label: "Tor exit node", tone: "bad" });
  if (intel?.hosting) tags.push({ label: `Hosting network: ${intel.hosting}`, tone: "info" });
  if (intel?.crawler) {
    tags.push(
      intel.crawler.verified
        ? { label: `Verified ${intel.crawler.claimed}`, tone: "good" }
        : { label: `Claims to be ${intel.crawler.claimed} - it isn't`, tone: "bad" },
    );
  }
  if (activity?.countries?.length) tags.push({ label: `Seen from ${activity.countries.join(", ")}` });
  if (!tags.length) return null;
  return (
    <div className="tag-row" style={{ marginTop: 10 }}>
      {tags.map((t) => (
        <span key={t.label} className={`pill ${t.tone || "bare"}`}>
          {t.label}
        </span>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children || <span className="faint">-</span>}</dd>
    </>
  );
}

function IntelPanel({ intel, fetchedAt, looking, error, onRefresh }) {
  const failed = (section) => section?.error && <p className="faint inspect-note">Lookup failed: {section.error}</p>;
  const hostnames = intel?.reverseDns?.hostnames || [];
  const asn = intel?.asn && !intel.asn.error ? intel.asn : null;
  const rdap = intel?.rdap && !intel.rdap.error ? intel.rdap : null;

  return (
    <Panel
      title="Who is this?"
      sub="Public records only: reverse DNS, the network that announces the address, its registry entry and the Tor exit list. Nothing is sent to the address itself."
      action={
        <button className="btn small" onClick={onRefresh} disabled={looking}>
          <Icon name="refresh" /> {looking ? "Looking up…" : "Look up again"}
        </button>
      }
    >
      {error && <div className="notice error" style={{ marginTop: 12 }}>{error}</div>}
      {!intel ? (
        looking ? (
          <div className="intel-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 110 }} />
            ))}
          </div>
        ) : (
          <div className="empty">Not looked up yet.</div>
        )
      ) : intel.note ? (
        <div className="notice" style={{ marginTop: 12 }}>{intel.note}</div>
      ) : (
        <div className="intel-grid" style={looking ? { opacity: 0.55 } : undefined}>
          <div className="intel-block">
            <h4>Reverse DNS</h4>
            {failed(intel.reverseDns) ||
              (hostnames.length === 0 ? (
                <p className="muted inspect-note">No reverse DNS name is set for this address.</p>
              ) : (
                <div className="mini-list">
                  {hostnames.map((h) => (
                    <div className="mini-row" key={h.host}>
                      <span className="mono" style={{ overflowWrap: "anywhere" }}>{h.host}</span>
                      {h.confirmed ? (
                        <span className="pill good" title="The name resolves back to this address, so its owner set it">Confirmed</span>
                      ) : (
                        <span className="pill warn" title="The name doesn't resolve back to this address - anyone can set an unconfirmed name">Unconfirmed</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
          </div>

          <div className="intel-block">
            <h4>Network</h4>
            {failed(intel.asn) ||
              (!asn ? (
                <p className="muted inspect-note">No announcing network found.</p>
              ) : (
                <dl className="kv">
                  <Field label="AS number">
                    {asn.asn && (
                      <a className="panel-link mono" style={{ marginLeft: 0 }} href={`https://bgp.he.net/AS${asn.asn}`} target="_blank" rel="noreferrer">
                        AS{asn.asn}
                      </a>
                    )}
                  </Field>
                  <Field label="Operator">{asn.name}</Field>
                  <Field label="Announced as">{asn.prefix && <span className="mono">{asn.prefix}</span>}</Field>
                  <Field label="Registry">{asn.registry?.toUpperCase()}</Field>
                  <Field label="Country">{asn.country}</Field>
                  <Field label="Allocated">{asn.allocated && formatDate(asn.allocated)}</Field>
                </dl>
              ))}
          </div>

          <div className="intel-block">
            <h4>Registration (RDAP / WHOIS)</h4>
            {failed(intel.rdap) ||
              (!rdap ? (
                <p className="muted inspect-note">No registry record found.</p>
              ) : (
                <dl className="kv">
                  <Field label="Network">{[rdap.name, rdap.handle && `(${rdap.handle})`].filter(Boolean).join(" ")}</Field>
                  <Field label="Owner">{rdap.owner}</Field>
                  <Field label="Range">{rdap.range && <span className="mono">{rdap.range}</span>}</Field>
                  <Field label="CIDR">{rdap.cidrs?.length ? <span className="mono">{rdap.cidrs.join(", ")}</span> : null}</Field>
                  <Field label="Country">{rdap.country}</Field>
                  <Field label="Abuse contact">
                    {rdap.abuseEmail && (
                      <a className="panel-link" style={{ marginLeft: 0 }} href={`mailto:${rdap.abuseEmail}`}>
                        {rdap.abuseEmail}
                      </a>
                    )}
                  </Field>
                  <Field label="Registered">{rdap.registered && formatDate(rdap.registered)}</Field>
                  <Field label="Last changed">{rdap.lastChanged && formatDate(rdap.lastChanged)}</Field>
                </dl>
              ))}
          </div>

          <div className="intel-block">
            <h4>Signals</h4>
            <dl className="kv">
              <Field label="Tor exit">{intel.tor?.error ? <span className="faint">Couldn&apos;t check: {intel.tor.error}</span> : intel.tor?.exit ? "Yes - traffic from the Tor network" : "No"}</Field>
              <Field label="Hosting network">{intel.hosting ? `${intel.hosting} - servers, not people: usually a bot, scraper, VPN or monitor` : "No match - likely a home, office or mobile connection"}</Field>
              <Field label="Crawler">
                {!intel.crawler
                  ? "Doesn't claim to be a known search crawler"
                  : intel.crawler.verified
                    ? `A real ${intel.crawler.claimed} - its reverse DNS checks out`
                    : `Claims to be ${intel.crawler.claimed} but its reverse DNS doesn't match - a spoofed crawler`}
              </Field>
              <Field label="Neighbourhood">{intel.neighbourhood && <span className="mono">{intel.neighbourhood}</span>}</Field>
            </dl>
          </div>
        </div>
      )}
      {fetchedAt && <p className="footer-note">Looked up {timeAgo(fetchedAt)}; kept for a day. Port scanning isn&apos;t offered - probing someone else&apos;s machine without permission is illegal in the UK.</p>}
    </Panel>
  );
}

function Conversation({ rows, onOpen, hasOlder, onLoadOlder, loadingOlder }) {
  const [show, setShow] = useState("all");
  const visible = rows.filter((r) => (show === "blocked" ? outcomeOf(r) === "blocked" : show === "flagged" ? Number(r.threat_score) >= 20 : true));

  const items = [];
  visible.forEach((row, i) => {
    const prev = visible[i - 1];
    const gap = prev ? Date.parse(prev.ts) - Date.parse(row.ts) : 0;
    const newVisit = !prev || gap > VISIT_GAP_MS;
    if (prev && newVisit) items.push(<div className="conv-gap" key={`gap-${row.id}`}>{gapLabel(gap)}</div>);
    const newAgent = newVisit || prev.user_agent !== row.user_agent;
    const meta = [
      newAgent && (row.user_agent || "No user agent"),
      [row.city, row.country].filter(Boolean).join(", "),
      row.referer && `from ${row.referer}`,
      row.location && `→ ${row.location}`,
    ].filter(Boolean);
    const at = new Date(row.ts);
    items.push(
      <button type="button" className="conv-row" key={row.id} onClick={() => onOpen(row.id)} title="Inspect this request">
        <span className="conv-time">
          {newVisit && <span className="conv-date">{at.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>}
          {at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        <span className="conv-main">
          <span className="conv-path">
            <b>{row.method || "GET"}</b> {row.path || "/"}
            {row.query && <span className="faint">?{readableQuery(row.query)}</span>}
          </span>
          {meta.length > 0 && <span className="conv-meta">{meta.join(" · ")}</span>}
        </span>
        <span className="conv-side">
          <OutcomePill row={row} />
          <ThreatPill score={row.threat_score} signals={row.signals} />
        </span>
      </button>,
    );
  });

  return (
    <Panel
      title="Conversation"
      sub="Every request from this address, newest first. A pause of over 30 minutes starts a new visit. Click a request to see it in full."
      action={
        <div className="segmented" role="group" aria-label="Show">
          {[
            ["all", "All"],
            ["blocked", "Blocked"],
            ["flagged", "Flagged"],
          ].map(([value, label]) => (
            <button key={value} className={show === value ? "active" : ""} aria-pressed={show === value} onClick={() => setShow(value)}>
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div className="conv" style={{ marginTop: 10 }}>
        {items.length ? items : <div className="empty">{rows.length ? "Nothing matches - try All." : "No requests from this address are in the log."}</div>}
      </div>
      {hasOlder && (
        <div className="table-foot" style={{ border: 0, background: "transparent", padding: "12px 2px 0" }}>
          <span>Showing the newest {rows.length.toLocaleString()} requests.</span>
          <button className="btn small" onClick={onLoadOlder} disabled={loadingOlder}>
            {loadingOlder ? "Loading…" : "Load older"}
          </button>
        </div>
      )}
    </Panel>
  );
}

function Neighbours({ neighbours, blockedRange, onBlockRange, working }) {
  if (!neighbours) return null;
  const { cidr, ips } = neighbours;
  return (
    <Panel
      title="Same network"
      sub={`Other addresses in ${cidr} seen in the last 30 days. A scan spread across neighbouring addresses shows up here.`}
      action={
        blockedRange ? (
          <span className="pill bad">Blocked by {blockedRange}</span>
        ) : (
          <button className="btn small danger" onClick={onBlockRange} disabled={working}>
            Block {cidr}
          </button>
        )
      }
    >
      {ips.length === 0 ? (
        <div className="empty" style={{ padding: "22px 0 8px" }}>No other address from this range has visited.</div>
      ) : (
        <div className="mini-list" style={{ marginTop: 10, maxHeight: 300, overflowY: "auto" }}>
          {ips.map((n) => (
            <div className="mini-row" key={n.ip}>
              <Link className="mono panel-link" style={{ marginLeft: 0 }} href={`/admin/security/investigate?q=${encodeURIComponent(n.ip)}`}>
                {n.ip}
              </Link>
              <span className="muted" style={{ fontSize: 12, textAlign: "right" }}>
                {Number(n.requests).toLocaleString()} requests
                {Number(n.blocked) ? ` · ${Number(n.blocked).toLocaleString()} blocked` : ""} · {timeAgo(n.last_seen)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function IpDossier({ ip }) {
  const base = `/api/admin/ip/${encodeURIComponent(ip)}`;
  const { data, error, loading, reload } = useAdminData(base);
  const [lookup, setLookup] = useState({ intel: null, fetchedAt: null, error: "", refreshing: false });
  const [older, setOlder] = useState({ rows: [], cursor: null, done: false, busy: false });
  const [hours, setHours] = useState(0);
  const [working, setWorking] = useState(false);
  const [inspecting, setInspecting] = useState(null);
  const closeInspector = useCallback(() => setInspecting(null), []);

  const fetchIntel = useCallback(
    async (refresh) => {
      try {
        const response = await fetch(`${base}?part=intel${refresh ? "&refresh=1" : ""}`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "The lookup failed.");
        setLookup({ intel: body.intel, fetchedAt: body.intelFetchedAt, error: "", refreshing: false });
      } catch (err) {
        setLookup((s) => ({ ...s, error: err.message, refreshing: false }));
      }
    },
    [base],
  );

  // The registries can take a few seconds, so the lookup runs after the
  // rest of the dossier has loaded - and only when the cached one is stale.
  const needsLookup = Boolean(data?.intelStale);
  useEffect(() => {
    if (needsLookup) fetchIntel(false);
  }, [needsLookup, fetchIntel]);

  const status = data?.status || {};
  const activity = data?.activity;
  const intel = lookup.intel || data?.intel || null;
  const fetchedAt = lookup.fetchedAt || data?.intelFetchedAt || null;
  const looking = lookup.refreshing || (needsLookup && !lookup.fetchedAt && !lookup.error);
  const rows = useMemo(() => [...(data?.requests || []), ...older.rows], [data, older.rows]);
  const cursor = older.rows.length ? older.cursor : data?.cursor;
  const hasOlder = Boolean(cursor) && !older.done;

  async function loadOlder() {
    setOlder((s) => ({ ...s, busy: true }));
    try {
      const response = await fetch(`${base}?before=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Couldn't load older requests.");
      setOlder((s) => ({ rows: [...s.rows, ...(body.requests || [])], cursor: body.cursor, done: !body.cursor, busy: false }));
    } catch (err) {
      toast.error(err.message);
      setOlder((s) => ({ ...s, busy: false }));
    }
  }

  async function act(run, success) {
    setWorking(true);
    try {
      await run();
      toast.success(success);
      reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function blockIp() {
    const reason = await promptText(`Reason for blocking ${ip}:`, { defaultValue: "Blocked from the IP dossier" });
    if (reason === null) return;
    const label = DURATIONS.find((d) => d.hours === hours)?.label.toLowerCase() || "permanently";
    await act(() => send("/api/admin/traffic", "POST", { ip, reason, hours }), `${ip} blocked ${label}.`);
  }

  async function unblockIp() {
    if (!(await confirmAction(`Unblock ${ip}? Its requests will reach the site again.`, { title: "Unblock IP" }))) return;
    await act(() => send("/api/admin/traffic", "DELETE", { ip }), `${ip} unblocked.`);
  }

  async function allowIp() {
    const ok = await confirmAction(`Allow-list ${ip}? Allow-listed addresses skip every firewall check, blocks included. Only do this for an address you trust, like your office.`, { title: "Allow-list IP" });
    if (!ok) return;
    await act(() => send("/api/admin/firewall", "POST", { kind: "allow_ip", value: ip, note: "Added from the IP dossier" }), `${ip} is on the allow list.`);
  }

  async function removeAllow() {
    if (!(await confirmAction(`Take ${ip} off the allow list? The firewall checks it like everyone else again.`, { title: "Remove from allow list" }))) return;
    await act(() => send("/api/admin/firewall", "DELETE", { id: status.allowListed.id }), `${ip} is off the allow list.`);
  }

  async function dismiss() {
    const reason = await promptText(`Why are ${ip}'s findings safe to dismiss? (optional)`, { defaultValue: "" });
    if (reason === null) return;
    await act(() => send("/api/admin/threats", "POST", { ip, reason }), "Findings dismissed - anything new from this address is still flagged.");
  }

  async function restore() {
    await act(() => send("/api/admin/threats", "DELETE", { ip }), "Findings are showing again.");
  }

  async function blockRange() {
    const cidr = data?.neighbours?.cidr;
    if (!cidr) return;
    const size = cidr.includes(":") ? "every address behind one IPv6 connection" : "256 addresses";
    const ok = await confirmAction(
      `Block ${cidr}? That's ${size} - anyone else on that network (an office, a VPN, a mobile carrier) is blocked too.`,
      { title: "Block IP range", danger: true },
    );
    if (!ok) return;
    const label = DURATIONS.find((d) => d.hours === hours)?.label.toLowerCase() || "permanently";
    await act(() => send("/api/admin/firewall", "POST", { kind: "block_cidr", value: cidr, note: `Range of ${ip}`, hours }), `${cidr} blocked ${label}.`);
  }

  if (!data) {
    return error && !loading ? (
      <div className="notice error">{error}</div>
    ) : (
      <div className="stack">
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 240 }} />
      </div>
    );
  }

  const worst = Number(activity?.max_threat || 0);
  return (
    <>
      {error && <div className="notice error section">{error}</div>}

      <div className="panel">
        <div className="dossier-head">
          <div style={{ minWidth: 0 }}>
            <h2 className="ip-title">{ip}</h2>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {activity
                ? `${Number(activity.requests).toLocaleString()} requests · ${Number(activity.paths).toLocaleString()} different paths · ${Number(activity.user_agents).toLocaleString()} user agents`
                : "No requests from this address are in the log."}
            </div>
            <Tags intel={intel} status={status} activity={activity} />
          </div>
          <div className="actions" style={{ alignItems: "center" }}>
            {status.blocked ? (
              <button className="btn small" onClick={unblockIp} disabled={working}>
                Unblock
              </button>
            ) : (
              <>
                <select className="select-input" aria-label="Block for" value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                  {DURATIONS.map((d) => (
                    <option key={d.hours} value={d.hours}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <button className="btn small danger" onClick={blockIp} disabled={working}>
                  <Icon name="ban" /> Block
                </button>
              </>
            )}
            {status.allowListed ? (
              <button className="btn small" onClick={removeAllow} disabled={working}>
                Remove from allow list
              </button>
            ) : (
              <button className="btn small" onClick={allowIp} disabled={working}>
                <Icon name="check" /> Allow-list
              </button>
            )}
            {status.dismissed ? (
              <button className="btn small ghost" onClick={restore} disabled={working}>
                Show findings again
              </button>
            ) : (
              worst >= 20 && (
                <button className="btn small ghost" onClick={dismiss} disabled={working}>
                  Dismiss findings
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {activity && (
        <div className="kpi-grid cols-5 section">
          <KpiCard label="Requests" icon="traffic" value={Number(activity.requests).toLocaleString()} foot="Everything still in the log" />
          <KpiCard label="Blocked" icon="ban" tone="var(--critical)" value={Number(activity.blocked).toLocaleString()} />
          <KpiCard label="Worst threat" icon="alert" tone={worst >= 40 ? "var(--critical)" : worst >= 20 ? "var(--warn)" : undefined} value={worst} foot={threatLevel(worst) || "Nothing flagged"} />
          <KpiCard label="First seen" icon="clock" value={timeAgo(activity.first_seen)} foot={formatDateTime(activity.first_seen)} />
          <KpiCard label="Last seen" icon="activity" value={timeAgo(activity.last_seen)} foot={formatDateTime(activity.last_seen)} />
        </div>
      )}

      <div className="section">
        <IntelPanel
          intel={intel}
          fetchedAt={fetchedAt}
          looking={looking}
          error={lookup.error}
          onRefresh={() => {
            setLookup((s) => ({ ...s, refreshing: true, error: "" }));
            fetchIntel(true);
          }}
        />
      </div>

      <div className="split section">
        <Conversation rows={rows} onOpen={setInspecting} hasOlder={hasOlder} onLoadOlder={loadOlder} loadingOlder={older.busy} />
        <div className="stack" style={{ alignContent: "start" }}>
          <Neighbours neighbours={data.neighbours} blockedRange={status.blockedRange} onBlockRange={blockRange} working={working} />
          <Panel title="Paths" sub={`From the ${rows.length.toLocaleString()} requests loaded`}>
            <BarList items={countBy(rows, (r) => r.path || "/")} limit={8} emptyLabel="No requests." />
          </Panel>
          <Panel title="User agents">
            <BarList items={countBy(rows, (r) => r.user_agent || "(none)")} limit={6} emptyLabel="No requests." />
          </Panel>
          <Panel title="Outcomes">
            <StatList
              rows={[
                { label: "Allowed", value: rows.filter((r) => outcomeOf(r) === "allowed").length },
                { label: "Blocked", value: rows.filter((r) => outcomeOf(r) === "blocked").length, tone: "var(--critical)" },
                { label: "Redirected", value: rows.filter((r) => outcomeOf(r) === "redirected").length },
                { label: "Hidden (404)", value: rows.filter((r) => outcomeOf(r) === "not_found").length },
                { label: "Flagged", value: rows.filter((r) => Number(r.threat_score) >= 20).length, tone: "var(--warn)" },
              ]}
            />
          </Panel>
        </div>
      </div>

      <RequestInspector id={inspecting} onClose={closeInspector} onBlock={status.blocked ? undefined : blockIp} blocked={() => Boolean(status.blocked)} />
    </>
  );
}

// ── Search ──────────────────────────────────────────────────────────────

function SearchResults({ query }) {
  const { data, error, loading } = useAdminData("/api/admin/ops");
  const [inspecting, setInspecting] = useState(null);
  const closeInspector = useCallback(() => setInspecting(null), []);

  const q = query.toLowerCase();
  const allRequests = data?.requests || [];
  const rows = allRequests.filter((x) => !q || `${x.ip} ${x.path} ${x.user_agent} ${x.country}`.toLowerCase().includes(q)).slice(0, 200);
  const suspects = (data?.ipInvestigations || []).filter((x) => x.maxScore >= 20).slice(0, 8);

  if (loading && !data) return <div className="empty section">Loading…</div>;

  return (
    <>
      {error && <div className="notice error section">{error}</div>}

      <div className="kpi-grid cols-3">
        <KpiCard label="Requests searched" value={allRequests.length} foot="The newest requests in the log" />
        <KpiCard label="Flagged (score 20+)" value={data?.kpis?.threats ?? "-"} tone="var(--warn)" />
        <KpiCard label="Denied at the edge" value={data?.kpis?.blockedRequests ?? "-"} tone="var(--critical)" />
      </div>

      {!q && suspects.length > 0 && (
        <Panel title="Addresses worth a look" sub="The highest threat scores in recent traffic. Open one for its dossier." className="section">
          <div className="mini-list" style={{ marginTop: 10 }}>
            {suspects.map((s) => (
              <div className="mini-row" key={s.ip}>
                <div style={{ minWidth: 0 }}>
                  <Link className="mono panel-link" style={{ marginLeft: 0 }} href={`/admin/security/investigate?q=${encodeURIComponent(s.ip)}`}>
                    {s.ip}
                  </Link>
                  <div className="faint truncate" style={{ fontSize: 12 }}>
                    {s.requests} requests{s.blocked ? ` · ${s.blocked} blocked` : ""}
                    {s.countries?.length ? ` · ${s.countries.join(", ")}` : ""}
                    {s.signals?.length ? ` · ${s.signals.join(", ")}` : ""}
                  </div>
                </div>
                <ThreatPill score={s.maxScore} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel
        title={q ? `Requests matching “${query}”` : "Recent requests"}
        sub="Matches IP, path, user agent and country. Enter a full IP address above for its dossier."
        className="section"
      >
        {rows.length === 0 ? (
          <div className="empty">No requests match.</div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>IP</th>
                  <th>Country</th>
                  <th>Request</th>
                  <th>User agent</th>
                  <th>Threat</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className="clickable" tabIndex={0} onClick={() => setInspecting(x.id)} onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && setInspecting(x.id)}>
                    <td className="mono" style={{ whiteSpace: "nowrap" }}>{formatStamp(x.created_at)}</td>
                    <td>
                      <Link className="mono panel-link" style={{ marginLeft: 0 }} href={`/admin/security/investigate?q=${encodeURIComponent(x.ip)}`} onClick={(e) => e.stopPropagation()}>
                        {x.ip}
                      </Link>
                    </td>
                    <td className="muted">{x.country || "-"}</td>
                    <td className="mono truncate" style={{ maxWidth: 280 }} title={x.path}>
                      <b>{x.method}</b> {x.path}
                    </td>
                    <td className="muted mono truncate" style={{ maxWidth: 220 }} title={x.user_agent}>
                      {x.user_agent || "-"}
                    </td>
                    <td>
                      <ThreatPill score={x.threat?.score} signals={x.threat?.signals} />
                    </td>
                    <td>
                      <OutcomePill row={x} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <RequestInspector id={inspecting} onClose={closeInspector} />
    </>
  );
}

// ── Page ────────────────────────────────────────────────────────────────

function SearchBox({ initial, onSubmit }) {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="inline-form"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
      }}
    >
      <input className="search-input" placeholder="IP address, path, country or user agent" aria-label="Look up" value={value} onChange={(e) => setValue(e.target.value)} style={{ minWidth: 240 }} />
      <button className="btn small primary" type="submit">
        Look up
      </button>
    </form>
  );
}

function InvestigateView() {
  const router = useRouter();
  const query = (useSearchParams().get("q") || "").trim();
  const ip = looksLikeIp(query) ? query : null;

  function go(value) {
    const v = value.trim();
    router.push(v ? `/admin/security/investigate?q=${encodeURIComponent(v)}` : "/admin/security/investigate");
  }

  return (
    <>
      <PageHeader
        title={ip ? "IP dossier" : "Investigate"}
        description={
          ip
            ? "Everything logged from one address, who's behind it, and the firewall's controls for it."
            : "Search recent requests, or enter an IP address for its full history and a lookup of who's behind it."
        }
      >
        {ip && (
          <Link className="btn small ghost" href="/admin/security/investigate">
            <Icon name="chevronLeft" /> Search
          </Link>
        )}
        {/* Keyed so the box shows the new query after a link or Back. */}
        <SearchBox key={query} initial={query} onSubmit={go} />
      </PageHeader>

      {ip ? <IpDossier key={ip} ip={ip} /> : <SearchResults query={query} />}
    </>
  );
}

export default function SecurityInvestigatePage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <InvestigateView />
    </Suspense>
  );
}
