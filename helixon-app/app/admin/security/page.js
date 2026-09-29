"use client";
// /admin/security - every firewall control in one place: the policy
// (thresholds, auto-blocking, alert emails), IP blocks with an optional
// expiry, the allow list, and country blocks. Changes are audited
// server-side and reach every server within about 30 seconds.

import { useMemo, useState } from "react";

import { PageHeader, RangeControl, KpiCard, Panel, Switch } from "../_shared/ui";
import { Icon } from "../_shared/icons";
import { useAdminStats, useAdminTraffic } from "../_shared/hooks";
import { useAdminData, formatDateTime, timeAgo } from "../_shared/data";
import { csrfHeaders } from "../_shared/csrf";
import { confirmAction } from "../_shared/modal";
import { toast } from "../_shared/toast";

const DURATIONS = [
  { hours: 0, label: "Permanently" },
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "24 hours" },
  { hours: 24 * 7, label: "7 days" },
  { hours: 24 * 30, label: "30 days" },
];

function Expiry({ at }) {
  if (!at) return <span className="faint">Permanent</span>;
  return <span title={formatDateTime(at)}>Lifts {timeAgo(at)}</span>;
}

async function send(method, body) {
  const response = await fetch("/api/admin/firewall", {
    method,
    headers: csrfHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "That change didn't save.");
  return data;
}

function PolicyPanel({ policy, onSaved }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const value = { ...policy, ...draft };
  const dirty = draft && Object.keys(draft).some((k) => draft[k] !== policy?.[k]);

  async function save() {
    setSaving(true);
    try {
      await send("PATCH", { policy: value });
      toast.success("Firewall policy saved");
      setDraft(null);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Panel title="Firewall policy" sub="Every request is scored against known attack signatures (see Pentester). These settings decide what happens next.">
      {!policy ? (
        <div className="skeleton" style={{ height: 160, marginTop: 12 }} />
      ) : (
        <div className="stack" style={{ gap: 12, marginTop: 12 }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="fw-block">Auto-block at score</label>
              <input id="fw-block" type="number" min={10} max={200} value={value.blockThreshold} onChange={(e) => set({ blockThreshold: Number(e.target.value) })} />
              <span className="faint" style={{ fontSize: 12 }}>30 blocks on one clear attack signal (e.g. a SQL injection probe).</span>
            </div>
            <div className="field">
              <label htmlFor="fw-alert">Alert at score</label>
              <input id="fw-alert" type="number" min={5} max={200} value={value.alertThreshold} onChange={(e) => set({ alertThreshold: Number(e.target.value) })} />
              <span className="faint" style={{ fontSize: 12 }}>Flag weaker signals (scanners, probes for /.git) without blocking.</span>
            </div>
          </div>
          <Switch id="fw-auto" label="Block automatically" description="Off: suspicious IPs are only flagged, and a person decides." checked={value.autoBlock} onChange={(on) => set({ autoBlock: on })} />
          <Switch
            id="fw-query"
            label="Also block on attacks in query strings"
            description="Query strings are always scored and flagged. Off by default because searches (yours included) can look like SQL - allow-list your IP before turning this on."
            checked={value.blockOnQuery}
            disabled={!value.autoBlock}
            onChange={(on) => set({ blockOnQuery: on })}
          />
          <div className="field">
            <label htmlFor="fw-hours">Automatic blocks last</label>
            <select id="fw-hours" value={value.autoBlockHours} onChange={(e) => set({ autoBlockHours: Number(e.target.value) })} disabled={!value.autoBlock}>
              {DURATIONS.map((d) => (
                <option key={d.hours} value={d.hours}>{d.hours ? d.label : "Until someone unblocks"}</option>
              ))}
            </select>
          </div>
          <Switch
            id="fw-email"
            label="Email alerts"
            description={policy.alertEmailConfigured ? "Emails the security address when the firewall blocks or flags something." : "Needs SECURITY_ALERT_EMAIL and RESEND_API_KEY set on the server."}
            checked={value.emailAlerts}
            onChange={(on) => set({ emailAlerts: on })}
          />
          {dirty && (
            <div className="actions">
              <button className="btn small primary" onClick={save} disabled={saving}>Save policy</button>
              <button className="btn small ghost" onClick={() => setDraft(null)}>Discard</button>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

// Who gets the firewall's emails and the daily health check's.
function AlertsPanel({ alerts, onSaved }) {
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const current = (alerts?.recipients || []).join(", ");
  const text = draft ?? current;

  async function save(patch, success) {
    setSaving(true);
    try {
      await send("PATCH", { alerts: patch });
      toast.success(success);
      setDraft(null);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Who gets alerts" sub="Firewall blocks and flags, and the daily health check when something's wrong.">
      <div className="stack" style={{ gap: 12, marginTop: 12 }}>
        <div className="field">
          <label htmlFor="alert-recipients">Email addresses (comma-separated, up to 10)</label>
          <textarea id="alert-recipients" rows={2} value={text} onChange={(e) => setDraft(e.target.value)} placeholder="security@helixon.co.uk" disabled={!alerts} />
          {alerts?.envFallback && (
            <span className="faint" style={{ fontSize: 12 }}>
              None set here, so alerts go to SECURITY_ALERT_EMAIL ({(alerts.effective || []).join(", ")}).
            </span>
          )}
          {alerts && !alerts.effective?.length && <span className="faint" style={{ fontSize: 12 }}>Nobody gets alerts yet.</span>}
        </div>
        {draft !== null && draft !== current && (
          <div className="actions">
            <button className="btn small primary" disabled={saving} onClick={() => save({ recipients: text }, "Alert recipients saved")}>Save recipients</button>
            <button className="btn small ghost" onClick={() => setDraft(null)}>Discard</button>
          </div>
        )}
        <Switch
          id="alert-health"
          label="Daily health check email"
          description="Once a day (around 03:30 UTC) the checks on System health run on their own and email these addresses if anything is down."
          checked={alerts?.healthDigest !== false}
          disabled={!alerts || saving}
          onChange={(on) => save({ healthDigest: on }, on ? "Daily health email on" : "Daily health email off")}
        />
      </div>
    </Panel>
  );
}

export default function SecurityPage() {
  const [range, setRange] = useState("24h");
  const [blockForm, setBlockForm] = useState({ ip: "", reason: "", hours: 0 });
  const [allowForm, setAllowForm] = useState({ ip: "", note: "" });
  const [countryForm, setCountryForm] = useState({ code: "", note: "", hours: 0 });
  const [requestForm, setRequestForm] = useState({ kind: "block_path", value: "", note: "", hours: 0 });
  const [working, setWorking] = useState(false);

  const { traffic, error, busy, block, unblock, reload } = useAdminTraffic(range);
  const { stats } = useAdminStats(range);
  const firewall = useAdminData("/api/admin/firewall");

  const blocked = traffic?.blockedIps || [];
  const totals = stats?.totals || {};
  const rules = firewall.data?.rules || [];
  const allowList = rules.filter((r) => r.kind === "allow_ip" && !r.expired);
  const countryBlocks = rules.filter((r) => r.kind === "block_country" && !r.expired);
  const requestBlocks = rules.filter((r) => ["block_path", "block_ua", "block_cidr"].includes(r.kind) && !r.expired);
  const blockedCountrySet = new Set(countryBlocks.map((r) => r.value));
  const myIp = firewall.data?.myIp;
  const myIpAllowed = allowList.some((r) => r.value === myIp);
  const autoBlockedCount = blocked.filter((item) => item.created_by === "firewall").length;

  // Requests per country in range, for one-click country blocks.
  const countries = useMemo(() => {
    const byCountry = new Map();
    for (const p of traffic?.globe || []) {
      if (!p.country) continue;
      const c = byCountry.get(p.country) || { country: p.country, count: 0, blocked: 0 };
      c.count += p.count;
      c.blocked += p.blocked;
      byCountry.set(p.country, c);
    }
    return [...byCountry.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }, [traffic?.globe]);

  async function addRule(kind, value, note, hours, success) {
    setWorking(true);
    try {
      await send("POST", { kind, value, note, hours });
      toast.success(success);
      firewall.reload();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function removeRule(rule) {
    const label = rule.kind === "allow_ip" ? `Remove ${rule.value} from the allow list?` : `Stop blocking ${rule.value}?`;
    if (!(await confirmAction(label, { title: "Remove rule" }))) return;
    setWorking(true);
    try {
      await send("DELETE", { id: rule.id });
      toast.success("Rule removed");
      firewall.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function submitBlock(e) {
    e.preventDefault();
    const ok = await block(blockForm.ip.trim(), blockForm.reason.trim() || "Admin block", blockForm.hours);
    if (ok) setBlockForm({ ip: "", reason: "", hours: 0 });
  }

  async function submitAllow(e) {
    e.preventDefault();
    if (await addRule("allow_ip", allowForm.ip.trim(), allowForm.note.trim(), 0, `${allowForm.ip.trim()} is on the allow list`)) setAllowForm({ ip: "", note: "" });
  }

  async function submitRequestBlock(e) {
    e.preventDefault();
    const v = requestForm.value.trim();
    const label = { block_path: `Requests to ${v} are blocked`, block_ua: `User agents containing “${v}” are blocked`, block_cidr: `Range ${v} is blocked` }[requestForm.kind];
    if (await addRule(requestForm.kind, requestForm.value.trim(), requestForm.note.trim(), requestForm.hours, label)) {
      setRequestForm((f) => ({ ...f, value: "", note: "" }));
    }
  }

  async function blockCountry(code, note = "", hours = 0) {
    const upper = code.trim().toUpperCase();
    if (!myIpAllowed && !(await confirmAction(`Block every request from ${upper}? Anyone there, including customers, will see the blocked page.`, { title: "Block country", danger: true }))) return false;
    return addRule("block_country", upper, note, hours, `${upper} blocked`);
  }

  async function submitCountry(e) {
    e.preventDefault();
    if (await blockCountry(countryForm.code, countryForm.note.trim(), countryForm.hours)) setCountryForm({ code: "", note: "", hours: 0 });
  }

  return (
    <>
      <PageHeader title="Security" description="The firewall policy, blocked IPs, the allow list and country blocks. Changes apply everywhere within about 30 seconds.">
        <RangeControl range={range} setRange={setRange} />
        <button className="btn small" onClick={() => { reload(); firewall.reload(); }} disabled={busy}>
          <Icon name="refresh" size={13} /> Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}
      {firewall.data && !firewall.data.migrated && (
        <div className="notice section">The allow list and country blocks need the latest database migration (admin_granular_controls).</div>
      )}

      <div className="kpi-grid cols-6">
        <KpiCard label="Blocked IPs" icon="ban" value={blocked.length} tone="var(--critical)" foot={`${autoBlockedCount} by the firewall`} />
        <KpiCard label="Blocked countries" icon="globe" value={countryBlocks.length} tone={countryBlocks.length ? "var(--critical)" : undefined} />
        <KpiCard label="Allow-listed IPs" icon="check" value={allowList.length} tone="var(--ok)" />
        <KpiCard label="Requests denied" icon="shield" value={totals.blockedRequests ?? "-"} foot={`Last ${range}`} />
        <KpiCard label="Sign-in attempts" icon="key" value={totals.loginAttempts ?? "-"} />
        <KpiCard label="Failed sign-ins" icon="alert" value={totals.failedAuthAttempts ?? "-"} tone={totals.failedAuthAttempts ? "var(--warn)" : undefined} />
      </div>

      {myIp && myIp !== "unknown" && !myIpAllowed && firewall.data?.migrated && (
        <div className="notice section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>Your IP is <b className="mono">{myIp}</b>. Allow-listing it means no rule here can lock you out.</span>
          <button className="btn small" disabled={working} onClick={() => addRule("allow_ip", myIp, "Admin (added from Security page)", 0, "Your IP is on the allow list")}>
            Allow my IP
          </button>
        </div>
      )}

      <div className="split section">
        <PolicyPanel policy={firewall.data?.policy} onSaved={firewall.reload} />

        <Panel title="Allow list" sub="Never blocked and never scored: your office, uptime monitors, a pentest you've booked.">
          <form onSubmit={submitAllow} className="inline-form" style={{ marginTop: 12 }}>
            <input className="search-input no-icon" placeholder="IP address" value={allowForm.ip} onChange={(e) => setAllowForm((f) => ({ ...f, ip: e.target.value }))} aria-label="IP address to allow" required />
            <input className="search-input no-icon" placeholder="Note (optional)" value={allowForm.note} onChange={(e) => setAllowForm((f) => ({ ...f, note: e.target.value }))} aria-label="Note" />
            <button className="btn small primary" disabled={working || !allowForm.ip.trim()}>Allow</button>
          </form>
          {allowList.length === 0 ? (
            <div className="empty" style={{ padding: "20px 0 6px" }}>Nothing on the allow list.</div>
          ) : (
            <div className="mini-list" style={{ marginTop: 10 }}>
              {allowList.map((r) => (
                <div className="mini-row" key={r.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="mono">{r.value}{r.value === myIp && <span className="pill good bare" style={{ marginLeft: 6 }}>You</span>}</div>
                    <div className="faint truncate" style={{ fontSize: 12 }}>{r.note || "No note"} · by {r.created_by || "-"}</div>
                  </div>
                  <button className="btn small" onClick={() => removeRule(r)} disabled={working}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Blocked IPs" sub="Every request from these goes to the blocked page. Time-limited blocks lift on their own." className="section">
        <form onSubmit={submitBlock} className="inline-form" style={{ marginTop: 12 }}>
          <input className="search-input no-icon" placeholder="IP address" value={blockForm.ip} onChange={(e) => setBlockForm((f) => ({ ...f, ip: e.target.value }))} aria-label="IP address to block" required />
          <input className="search-input no-icon" placeholder="Reason (optional)" value={blockForm.reason} onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))} aria-label="Reason" />
          <select className="select-input" value={blockForm.hours} onChange={(e) => setBlockForm((f) => ({ ...f, hours: Number(e.target.value) }))} aria-label="How long">
            {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
          </select>
          <button className="btn small danger" disabled={busy || !blockForm.ip.trim()}>Block IP</button>
        </form>
        {blocked.length === 0 ? (
          <div className="empty" style={{ padding: "20px 0 6px" }}>No blocked IPs.</div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="table">
              <thead>
                <tr><th>IP</th><th>Reason</th><th>By</th><th>Since</th><th>Expires</th><th></th></tr>
              </thead>
              <tbody>
                {blocked.map((item) => (
                  <tr key={item.ip}>
                    <td className="mono"><a className="panel-link" style={{ marginLeft: 0 }} href={`/admin/security/investigate?q=${encodeURIComponent(item.ip)}`}>{item.ip}</a></td>
                    <td className="muted" style={{ maxWidth: 360 }}><span className="truncate" style={{ display: "block" }} title={item.reason || ""}>{item.reason || "Admin block"}</span></td>
                    <td>{item.created_by === "firewall" ? <span className="pill bad">Firewall</span> : <span className="muted">{item.created_by || "-"}</span>}</td>
                    <td className="muted" title={formatDateTime(item.created_at)}>{timeAgo(item.created_at)}</td>
                    <td className="muted"><Expiry at={item.expires_at} /></td>
                    <td><button className="btn small" onClick={() => unblock(item.ip)} disabled={busy}>Unblock</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="split section">
        <Panel title="Country blocks" sub="Refuse every request from a country (by the visitor's location at the edge).">
          <form onSubmit={submitCountry} className="inline-form" style={{ marginTop: 12 }}>
            <input className="search-input no-icon" placeholder="Country code, e.g. RU" maxLength={2} style={{ maxWidth: 170 }} value={countryForm.code} onChange={(e) => setCountryForm((f) => ({ ...f, code: e.target.value }))} aria-label="Country code" required />
            <input className="search-input no-icon" placeholder="Note (optional)" value={countryForm.note} onChange={(e) => setCountryForm((f) => ({ ...f, note: e.target.value }))} aria-label="Note" />
            <select className="select-input" value={countryForm.hours} onChange={(e) => setCountryForm((f) => ({ ...f, hours: Number(e.target.value) }))} aria-label="How long">
              {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
            </select>
            <button className="btn small danger" disabled={working || countryForm.code.trim().length !== 2}>Block country</button>
          </form>
          {countryBlocks.length === 0 ? (
            <div className="empty" style={{ padding: "20px 0 6px" }}>No countries blocked.</div>
          ) : (
            <div className="mini-list" style={{ marginTop: 10 }}>
              {countryBlocks.map((r) => (
                <div className="mini-row" key={r.id}>
                  <div style={{ minWidth: 0 }}>
                    <div><b>{r.value}</b> <span className="faint" style={{ fontSize: 12 }}>· <Expiry at={r.expires_at} /></span></div>
                    <div className="faint truncate" style={{ fontSize: 12 }}>{r.note || "No note"} · by {r.created_by || "-"}</div>
                  </div>
                  <button className="btn small" onClick={() => removeRule(r)} disabled={working}>Unblock</button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Where requests come from" sub={`Top countries, last ${range}.`}>
          {countries.length === 0 ? (
            <div className="empty">No geolocated traffic in this range.</div>
          ) : (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="table">
                <thead><tr><th>Country</th><th>Requests</th><th>Denied</th><th></th></tr></thead>
                <tbody>
                  {countries.map((c) => (
                    <tr key={c.country}>
                      <td><a className="panel-link" style={{ marginLeft: 0 }} href={`/admin/traffic?country=${c.country}`}>{c.country}</a></td>
                      <td className="mono">{c.count.toLocaleString()}</td>
                      <td className="mono" style={c.blocked ? { color: "var(--critical)" } : undefined}>{c.blocked.toLocaleString()}</td>
                      <td>
                        {blockedCountrySet.has(c.country) ? (
                          <span className="pill bad bare">Blocked</span>
                        ) : (
                          <button className="btn small ghost" onClick={() => blockCountry(c.country)} disabled={working}>Block</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="split section">
        <Panel title="Range, path and user-agent blocks" sub="Refuse a whole IP range, or matching requests from anyone. For scans spread across a /24, probes like /wp-admin, or tools like sqlmap.">
          <form onSubmit={submitRequestBlock} className="inline-form" style={{ marginTop: 12 }}>
            <select className="select-input" value={requestForm.kind} onChange={(e) => setRequestForm((f) => ({ ...f, kind: e.target.value }))} aria-label="Rule type">
              <option value="block_path">Path starts with</option>
              <option value="block_ua">User agent contains</option>
              <option value="block_cidr">IP range (CIDR)</option>
            </select>
            <input
              className="search-input no-icon"
              placeholder={{ block_path: "/wp-admin", block_ua: "sqlmap", block_cidr: "45.9.1.0/24" }[requestForm.kind]}
              value={requestForm.value}
              onChange={(e) => setRequestForm((f) => ({ ...f, value: e.target.value }))}
              aria-label={{ block_path: "Path prefix", block_ua: "User-agent fragment", block_cidr: "IP range" }[requestForm.kind]}
              required
              maxLength={64}
            />
            <select className="select-input" value={requestForm.hours} onChange={(e) => setRequestForm((f) => ({ ...f, hours: Number(e.target.value) }))} aria-label="How long">
              {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
            </select>
            <button className="btn small danger" disabled={working || requestForm.value.trim().length < 2}>Block</button>
          </form>
          {requestBlocks.length === 0 ? (
            <div className="empty" style={{ padding: "20px 0 6px" }}>No range, path or user-agent blocks.</div>
          ) : (
            <div className="mini-list" style={{ marginTop: 10 }}>
              {requestBlocks.map((r) => (
                <div className="mini-row" key={r.id}>
                  <div style={{ minWidth: 0 }}>
                    <div>
                      <span className="faint" style={{ fontSize: 12 }}>{{ block_path: "Path ", block_ua: "User agent ", block_cidr: "Range " }[r.kind]}</span>
                      <b className="mono">{r.value}</b>
                      <span className="faint" style={{ fontSize: 12 }}> · <Expiry at={r.expires_at} /></span>
                    </div>
                    <div className="faint truncate" style={{ fontSize: 12 }}>{r.note || "No note"} · by {r.created_by || "-"}</div>
                  </div>
                  <button className="btn small" onClick={() => removeRule(r)} disabled={working}>Remove</button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <AlertsPanel alerts={firewall.data?.alerts} onSaved={firewall.reload} />
      </div>

      <div className="footer-note section">
        Order of rules: the allow list wins, then country blocks, then IP ranges, then path and user-agent blocks, then single IP blocks, then the automatic policy. Locations come from Vercel edge headers - no third-party lookup.
      </div>
    </>
  );
}
