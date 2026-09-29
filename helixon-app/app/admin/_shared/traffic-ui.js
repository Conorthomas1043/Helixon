"use client";

// Request details shared by Traffic, Command and Investigate: how a
// request's outcome and threat score read, the request inspector drawer
// and CSV export. What the log keeps - and deliberately doesn't - is
// decided in lib/request-capture.js and the Traffic page's capture settings.

import Link from "next/link";
import { Drawer, Skeleton } from "./ui";
import { Icon } from "./icons";
import { useAdminData } from "./data";
import { toast } from "./toast";

// What decided a request (request_logs.rule).
export const RULE_LABELS = {
  allow_list: "Allow list - always let through",
  country: "Country block",
  ip_range: "Blocked IP range",
  path: "Blocked path",
  user_agent: "Blocked user agent",
  ip_block: "The IP was already blocked",
  firewall: "Firewall auto-block (threat score)",
  maintenance: "Maintenance mode",
  sign_in: "Sign-in required",
  admin: "Admin area gate",
};

const OUTCOMES = {
  allowed: { label: "Allowed", tone: "good" },
  blocked: { label: "Blocked", tone: "bad" },
  redirected: { label: "Redirected", tone: "info" },
  not_found: { label: "Hidden (404)", tone: "warn" },
};

export const OUTCOME_FILTERS = [
  { value: "", label: "All" },
  { value: "allowed", label: "Allowed" },
  { value: "blocked", label: "Blocked" },
  { value: "redirected", label: "Redirected" },
  { value: "not_found", label: "Hidden 404" },
];

// Rows logged before outcomes were recorded only know blocked or not.
export function outcomeOf(row) {
  return OUTCOMES[row?.outcome] ? row.outcome : row?.blocked ? "blocked" : "allowed";
}

export function OutcomePill({ row }) {
  const { label, tone } = OUTCOMES[outcomeOf(row)];
  return (
    <span className={`pill ${tone}`}>
      {label}
      {row.status_code ? ` · ${row.status_code}` : ""}
    </span>
  );
}

// The Pentester page's bands: 20 and up is flagged.
export function threatLevel(score) {
  const s = Number(score) || 0;
  return s >= 70 ? "Critical" : s >= 40 ? "High" : s >= 20 ? "Medium" : null;
}

export function ThreatPill({ score, signals }) {
  const level = threatLevel(score);
  if (!level) return <span className="faint">-</span>;
  return (
    <span className={`pill ${Number(score) >= 40 ? "bad" : "warn"}`} title={(signals || []).join(", ") || undefined}>
      {level} · {score}
    </span>
  );
}

/** One line on what the edge did with a request. */
export function describeOutcome(row) {
  const outcome = outcomeOf(row);
  const api = String(row.path || "").startsWith("/api");
  if (outcome === "blocked") {
    return api ? "Refused with 403 Forbidden." : `Sent to ${row.location || "/rate-limited"} (${row.status_code || 307} redirect) instead of the page.`;
  }
  if (outcome === "redirected") return `Redirected to ${row.location || "another page"}${row.status_code ? ` (${row.status_code})` : ""}.`;
  if (outcome === "not_found") return "Answered 404 Not Found, so the admin area stays hidden.";
  return "Passed every check at the edge and went on to the site.";
}

/** A stored query string as a person reads it: "id=1' or 1=1", not "id=1%27%20or%201%3D1". */
export function readableQuery(query) {
  try {
    return decodeURIComponent(String(query || ""));
  } catch {
    return String(query || "");
  }
}

export function formatStamp(value, { seconds = true } = {}) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", ...(seconds ? { second: "2-digit" } : {}) });
}

const isRedacted = (value) => /^\[redacted/.test(String(value));

function ValueCell({ value }) {
  if (isRedacted(value)) {
    return (
      <dd className="mono redacted">
        <Icon name="lock" size={11} /> {value}
      </dd>
    );
  }
  return <dd className="mono">{value === "" ? <span className="faint">(empty)</span> : value}</dd>;
}

function InspectorBody({ r, onBlock, blocked }) {
  const outcome = outcomeOf(r);
  const url = `${r.protocol || "https"}://${r.host || "(host not recorded)"}${r.path || "/"}${r.query ? `?${r.query}` : ""}`;
  let params = [];
  try {
    params = r.query ? [...new URLSearchParams(r.query)] : [];
  } catch {
    params = [];
  }
  const headers = r.headers && typeof r.headers === "object" ? Object.entries(r.headers).sort(([a], [b]) => a.localeCompare(b)) : null;
  const place = [r.city, r.region, r.country].filter(Boolean).join(", ");
  const hasCoords = r.lat !== null && r.lat !== undefined && r.lon !== null && r.lon !== undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(r, null, 2));
      toast.success("Request copied as JSON");
    } catch {
      toast.error("Couldn't copy - the browser blocked clipboard access.");
    }
  }

  return (
    <>
      <div className="drawer-actions">
        {r.ip && (
          <Link className="btn small" href={`/admin/security/investigate?q=${encodeURIComponent(r.ip)}`}>
            <Icon name="search" /> IP dossier
          </Link>
        )}
        {r.ip && onBlock && !blocked && (
          <button className="btn small danger" onClick={() => onBlock(r.ip)}>
            <Icon name="ban" /> Block IP
          </button>
        )}
        <button className="btn small ghost" onClick={copy}>
          <Icon name="copy" /> Copy as JSON
        </button>
      </div>

      <section className="drawer-section">
        <h3>What the edge did</h3>
        <div className="tag-row">
          <OutcomePill row={r} />
          <ThreatPill score={r.threat_score} signals={r.signals} />
          {blocked && <span className="pill bad bare">IP blocked now</span>}
        </div>
        <p className="inspect-lead">{describeOutcome(r)}</p>
        <dl className="kv">
          <dt>Decided by</dt>
          <dd>{RULE_LABELS[r.rule] || (outcome === "allowed" ? "No rule matched" : "Not recorded")}</dd>
          <dt>Threat score</dt>
          <dd>
            {r.threat_score ?? 0}
            {r.signals?.length ? ` - ${r.signals.join(", ")}` : " - nothing suspicious"}
          </dd>
        </dl>
      </section>

      <section className="drawer-section">
        <h3>Request</h3>
        <div className="code-line mono">{url}</div>
        <dl className="kv" style={{ marginTop: 12 }}>
          <dt>Method</dt>
          <dd className="mono">{r.method || "GET"}</dd>
          <dt>Referrer</dt>
          <dd className="mono">{r.referer || "-"}</dd>
          <dt>User agent</dt>
          <dd className="mono">{r.user_agent || "-"}</dd>
        </dl>
        {params.length > 0 && (
          <>
            <h4 className="inspect-sub">Query parameters ({params.length})</h4>
            <dl className="kv kv-wide">
              {params.map(([key, value], i) => (
                <div className="kv-pair" key={`${key}-${i}`}>
                  <dt className="mono">{key}</dt>
                  <ValueCell value={value} />
                </div>
              ))}
            </dl>
          </>
        )}
      </section>

      <section className="drawer-section">
        <h3>Headers{headers ? ` (${headers.length})` : ""}</h3>
        {headers ? (
          <dl className="kv kv-wide">
            {headers.map(([name, value]) => (
              <div className="kv-pair" key={name}>
                <dt className="mono">{name}</dt>
                <ValueCell value={value} />
              </div>
            ))}
          </dl>
        ) : (
          <p className="faint inspect-note">
            Not recorded for this request. Headers are captured for requests logged since the inspector was switched on, and cleared after the retention period set on the Traffic page.
          </p>
        )}
        {headers && <p className="faint inspect-note">Cookies, tokens, signatures and other secrets are replaced with a marker saying they were there.</p>}
      </section>

      <section className="drawer-section">
        <h3>Body</h3>
        {r.payload ? (
          <pre className="code-block">{r.payload}</pre>
        ) : (
          <p className="faint inspect-note">
            {outcome === "blocked"
              ? "No body - it was a GET, the body wasn't text, or body capture is switched off."
              : "Only kept for requests the firewall blocked. Normal traffic carries CVs and passwords, which never belong in a log."}
          </p>
        )}
      </section>

      <section className="drawer-section">
        <h3>Network</h3>
        <dl className="kv">
          <dt>IP</dt>
          <dd className="mono">{r.ip || "-"}</dd>
          <dt>Location</dt>
          <dd>
            {place || "Unknown"}
            {r.postal ? ` · ${r.postal}` : ""}
          </dd>
          <dt>Coordinates</dt>
          <dd className="mono">{hasCoords ? `${Number(r.lat).toFixed(3)}, ${Number(r.lon).toFixed(3)}` : "-"}</dd>
          <dt>Time zone</dt>
          <dd>{r.timezone || "-"}</dd>
          <dt>Protocol</dt>
          <dd>{r.protocol ? r.protocol.toUpperCase() : "-"}</dd>
          <dt>Vercel request ID</dt>
          <dd className="mono">{r.edge_id || "-"}</dd>
          <dt>Logged at</dt>
          <dd className="mono">{r.ts ? new Date(r.ts).toISOString().replace("T", " ").replace("Z", " UTC") : "-"}</dd>
          <dt>Log ID</dt>
          <dd className="mono">{r.id}</dd>
        </dl>
      </section>

      <div className="notice">
        <b>Not recorded:</b> what the app sent back to requests it let through (status, headers, page), and the body of any request that wasn&apos;t blocked.
        Requests are logged at the edge, before the page renders.
        {r.edge_id ? " The Vercel request ID above finds this request in Vercel's runtime logs." : ""}
      </div>
    </>
  );
}

/**
 * Everything logged about one request, in a slide-over. `id` opens it
 * (null closes); `blocked` says whether its IP is blocked right now.
 */
export function RequestInspector({ id, onClose, onBlock, blocked }) {
  const { data, error, loading } = useAdminData(id ? `/api/admin/traffic/request/${id}` : null, { enabled: Boolean(id) });
  // The previous request stays in `data` while the next one loads.
  const r = data?.request && String(data.request.id) === String(id) ? data.request : null;

  return (
    <Drawer
      open={Boolean(id)}
      onClose={onClose}
      title={r ? `${r.method || "GET"} ${r.path || "/"}` : "Request"}
      subtitle={r ? `${formatStamp(r.ts)} · ${r.ip || "unknown IP"}` : undefined}
    >
      {r ? (
        <InspectorBody r={r} onBlock={onBlock} blocked={blocked?.(r.ip)} />
      ) : error && !loading ? (
        <div className="notice error">{error}</div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <Skeleton height={16} width="60%" />
          <Skeleton height={60} />
          <Skeleton height={140} />
        </div>
      )}
    </Drawer>
  );
}

// ── CSV export ──────────────────────────────────────────────────────────

// Spreadsheet apps run a cell that starts with = + - or @ as a formula,
// and paths and user agents are whatever a visitor chose to send - so
// those cells get a leading apostrophe.
function csvCell(value) {
  let text = value === null || value === undefined ? "" : Array.isArray(value) ? value.join(" ") : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(filename, columns, rows) {
  const lines = [columns.map((c) => csvCell(c.label)), ...rows.map((row) => columns.map((c) => csvCell(c.value(row))))];
  const blob = new Blob([`﻿${lines.map((cells) => cells.join(",")).join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const REQUEST_CSV_COLUMNS = [
  { label: "Time (UTC)", value: (r) => r.ts },
  { label: "IP", value: (r) => r.ip },
  { label: "Country", value: (r) => r.country },
  { label: "City", value: (r) => r.city },
  { label: "Method", value: (r) => r.method },
  { label: "Host", value: (r) => r.host },
  { label: "Path", value: (r) => r.path },
  { label: "Query (redacted)", value: (r) => r.query },
  { label: "Outcome", value: (r) => outcomeOf(r) },
  { label: "Status", value: (r) => r.status_code },
  { label: "Rule", value: (r) => r.rule },
  { label: "Threat score", value: (r) => r.threat_score },
  { label: "Signals", value: (r) => r.signals },
  { label: "User agent", value: (r) => r.user_agent },
  { label: "Referrer", value: (r) => r.referer },
];
