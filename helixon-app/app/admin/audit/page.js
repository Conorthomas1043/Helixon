"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PageHeader, Panel, EmptyState, Skeleton } from "../_shared/ui";
import { useAdminData, formatDateTime, timeAgo } from "../_shared/data";
import { Icon } from "../_shared/icons";
import { toast } from "../_shared/toast";
import { downloadCsv } from "@/lib/csv";

// How each recorded action is worded and coloured. Anything not listed falls
// back to a readable version of its name, so new actions still display sensibly.
const ACTIONS = {
  admin_login: { label: "Signed in", icon: "key", tone: "good" },
  admin_login_failed: { label: "Failed sign-in attempt", icon: "alert", tone: "bad" },
  admin_login_rate_limited: { label: "Sign-in rate limited", icon: "ban", tone: "warn" },
  create_user: { label: "Created a user", icon: "userPlus", tone: "good" },
  create_test_user: { label: "Created a test user", icon: "userPlus", tone: "good" },
  user_ban: { label: "Banned a user", icon: "ban", tone: "bad" },
  user_unban: { label: "Unbanned a user", icon: "check", tone: "good" },
  user_reset_password: { label: "Reset a user's password", icon: "key", tone: "warn" },
  user_update_profile: { label: "Edited a user's profile", icon: "user", tone: "info" },
  user_provision_agency: { label: "Set up an agency for a user", icon: "building", tone: "info" },
  user_confirm_email: { label: "Confirmed a user's email", icon: "check", tone: "info" },
  delete_user: { label: "Deleted a user", icon: "trash", tone: "bad" },
  create_employee: { label: "Created an employee", icon: "userPlus", tone: "good" },
  employee_set_role: { label: "Changed an employee's role", icon: "briefcase", tone: "warn" },
  employee_activate: { label: "Reactivated an employee", icon: "check", tone: "good" },
  employee_deactivate: { label: "Deactivated an employee", icon: "ban", tone: "bad" },
  employee_reset_password: { label: "Reset an employee's password", icon: "key", tone: "warn" },
  employee_update_name: { label: "Renamed an employee", icon: "user", tone: "info" },
  employee_set_permissions: { label: "Changed an employee's permissions", icon: "lock", tone: "warn" },
  employee_reset_permissions: { label: "Reset an employee's permissions", icon: "lock", tone: "info" },
  employee_update_profile: { label: "Edited an employee's profile", icon: "user", tone: "info" },
  employee_revoke_sessions: { label: "Signed an employee out everywhere", icon: "logout", tone: "warn" },
  employee_revoke_session: { label: "Signed out one employee session", icon: "logout", tone: "info" },
  employee_view_as: { label: "Viewed the staff portal as an employee", icon: "external", tone: "warn" },
  employee_portal_open: { label: "Opened the staff portal", icon: "external", tone: "info" },
  employee_portal_account_created: { label: "Created a staff portal account", icon: "userPlus", tone: "info" },
  user_set_agency: { label: "Moved a user to another agency", icon: "building", tone: "warn" },
  user_revoke_sessions: { label: "Signed a user out everywhere", icon: "logout", tone: "warn" },
  user_grant_demo_access: { label: "Granted demo access", icon: "sparkles", tone: "info" },
  user_revoke_demo_access: { label: "Revoked demo access", icon: "sparkles", tone: "warn" },
  block_ip: { label: "Blocked an IP address", icon: "shield", tone: "warn" },
  unblock_ip: { label: "Unblocked an IP address", icon: "shield", tone: "info" },
  firewall_allow_ip: { label: "Allow-listed an IP", icon: "check", tone: "info" },
  firewall_block_country: { label: "Blocked a country", icon: "globe", tone: "bad" },
  firewall_rule_removed: { label: "Removed a firewall rule", icon: "shield", tone: "info" },
  firewall_block_path: { label: "Blocked a request path", icon: "shield", tone: "warn" },
  firewall_block_ua: { label: "Blocked a user agent", icon: "shield", tone: "warn" },
  firewall_block_cidr: { label: "Blocked an IP range", icon: "shield", tone: "warn" },
  site_traffic_update: { label: "Changed request capture settings", icon: "traffic", tone: "info" },
  alert_recipients_update: { label: "Changed who gets alerts", icon: "mail", tone: "info" },
  health_checks_muted: { label: "Changed which health checks count", icon: "activity", tone: "info" },
  lead_invited: { label: "Invited a lead to sign up", icon: "userPlus", tone: "good" },
  firewall_policy_update: { label: "Changed the firewall policy", icon: "shield", tone: "warn" },
  threat_dismissed: { label: "Dismissed a threat finding", icon: "check", tone: "info" },
  threat_restored: { label: "Restored a threat finding", icon: "bug", tone: "info" },
  site_maintenance_update: { label: "Changed maintenance mode", icon: "layers", tone: "warn" },
  site_announcement_update: { label: "Changed the site banner", icon: "layers", tone: "info" },
  site_features_update: { label: "Switched a site feature", icon: "layers", tone: "warn" },
  site_firewall_update: { label: "Changed the firewall policy", icon: "shield", tone: "warn" },
  lead_update: { label: "Updated a lead", icon: "inbox", tone: "info" },
  lead_resend_notification: { label: "Resent a lead notification", icon: "mail", tone: "info" },
  agency_update: { label: "Changed an agency's settings", icon: "building", tone: "warn" },
  agency_suspend: { label: "Suspended an agency", icon: "ban", tone: "bad" },
  agency_unsuspend: { label: "Reactivated an agency", icon: "check", tone: "good" },
  agency_remove_member: { label: "Removed a member from an agency", icon: "users", tone: "warn" },
};

function describe(action) {
  return (
    ACTIONS[action] || {
      label: action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      icon: "info",
      tone: "info",
    }
  );
}

// Plain-language "what it was done to".
function target(entry) {
  const t = entry.targetEmail || entry.metadata?.targetRef || entry.metadata?.username || entry.metadata?.ip || entry.metadata?.value || entry.metadata?.name;
  return t ? String(t) : null;
}

function Details({ entry }) {
  const meta = { ...entry.metadata };
  delete meta.targetRef;
  const rows = Object.entries(meta).filter(([, v]) => v !== null && v !== undefined && v !== "" && typeof v !== "object");

  return (
    <div className="tl-details">
      <dl className="kv" style={{ gridTemplateColumns: "110px 1fr" }}>
        {entry.ip && (
          <>
            <dt>From IP</dt>
            <dd className="mono">{entry.ip}</dd>
          </>
        )}
        {entry.targetType && (
          <>
            <dt>Target type</dt>
            <dd>{entry.targetType}</dd>
          </>
        )}
        {rows.map(([k, v]) => (
          <span key={k} style={{ display: "contents" }}>
            <dt>{k}</dt>
            <dd>{String(v)}</dd>
          </span>
        ))}
        {entry.userAgent && (
          <>
            <dt>Browser</dt>
            <dd className="faint" style={{ fontSize: 11.5 }}>{entry.userAgent}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function AuditView() {
  // Deep links such as /admin/audit?action=admin_login_failed (from the overview)
  // start with that filter applied.
  const initial = useSearchParams();
  const [action, setAction] = useState(initial.get("action") || "");
  const [admin, setAdmin] = useState(initial.get("admin") || "");
  const [targetType, setTargetType] = useState(initial.get("targetType") || "");
  const [targetId, setTargetId] = useState(initial.get("target") || "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters = new URLSearchParams();
  if (action) filters.set("action", action);
  if (admin) filters.set("admin", admin);
  if (targetType) filters.set("targetType", targetType);
  if (targetId) filters.set("target", targetId);
  if (from) filters.set("from", from);
  if (to) filters.set("to", to);
  if (search) filters.set("search", search);
  const params = new URLSearchParams(filters);
  params.set("page", String(page));
  const filtered = [...filters.keys()].length > 0;

  function clearFilters() {
    setAction("");
    setAdmin("");
    setTargetType("");
    setTargetId("");
    setFrom("");
    setTo("");
    setSearchInput("");
    setSearch("");
    setPage(1);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const response = await fetch(`/api/admin/audit?${filters}&export=1`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Export failed.");
      downloadCsv(
        `helixon-audit-${new Date().toISOString().slice(0, 10)}.csv`,
        (body.entries || []).map((e) => ({
          at: e.at,
          admin: e.admin,
          action: e.action,
          description: describe(e.action).label,
          target: target(e) || "",
          target_type: e.targetType || "",
          target_id: e.targetId || e.metadata?.targetRef || "",
          from_ip: e.ip || "",
          details: JSON.stringify(e.metadata || {}),
        })),
      );
      if (body.total > body.entries.length) toast.warn(`Exported the newest ${body.entries.length.toLocaleString()} of ${body.total.toLocaleString()} entries.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  const { data, error, loading, reload } = useAdminData(`/api/admin/audit?${params}`);
  const entries = data?.entries || [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Audit log" description="A record of every privileged action and every admin sign-in attempt: who did it, to what, from where, and when. Entries can't be edited from here.">
        <button className="btn small" onClick={exportCsv} disabled={exporting || !data?.total}>
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
        <button className="btn small" onClick={reload} disabled={loading}>
          <Icon name="refresh" /> Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="section-head" style={{ marginBottom: 16 }}>
        <div className="actions">
          <select
            className="search-input"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by action"
          >
            <option value="">All actions</option>
            {(data?.actions || []).map((a) => (
              <option key={a} value={a}>
                {describe(a).label}
              </option>
            ))}
          </select>
          <select
            className="search-input"
            value={admin}
            onChange={(e) => {
              setAdmin(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by admin"
          >
            <option value="">All admins</option>
            {(data?.admins || []).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            className="search-input"
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by what was changed"
          >
            <option value="">Everything</option>
            {(data?.targetTypes || []).map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
          <label className="date-filter">
            From
            <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" />
          </label>
          <label className="date-filter">
            To
            <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" />
          </label>
          <input className="search-input" placeholder="Search email, username, IP, reason..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search the audit log" />
          {targetId && (
            <button className="pill info" onClick={() => { setTargetId(""); setPage(1); }} aria-label="Clear record filter">
              One record only ✕
            </button>
          )}
          {filtered && <button className="btn small ghost" onClick={clearFilters}>Clear filters</button>}
        </div>
        {data && <span className="muted">{data.total.toLocaleString()} {data.total === 1 ? "entry" : "entries"}</span>}
      </div>

      <Panel>
        {loading && entries.length === 0 ? (
          <div style={{ display: "grid", gap: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={38} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState icon="scroll" title="No matching entries">
            Try clearing a filter.
          </EmptyState>
        ) : (
          <div className="timeline">
            {entries.map((entry) => {
              const info = describe(entry.action);
              const who = target(entry);
              const expanded = open === entry.id;
              return (
                <div className="tl-row" key={entry.id}>
                  <span className={`tl-dot ${info.tone}`}>
                    <Icon name={info.icon} />
                  </span>
                  <div>
                    <div className="tl-head">
                      <span className="tl-title">{info.label}</span>
                      {who && <span className="mono muted">{who}</span>}
                    </div>
                    <div className="tl-meta">
                      by <b style={{ color: "var(--text)" }}>{entry.admin}</b> &middot;{" "}
                      <span title={formatDateTime(entry.at)}>{timeAgo(entry.at)}</span>
                      {entry.ip && <> &middot; {entry.ip}</>}
                      {" "}
                      <button className="panel-link" style={{ marginLeft: 6 }} onClick={() => setOpen(expanded ? null : entry.id)}>
                        {expanded ? "Hide details" : "Details"}
                      </button>
                    </div>
                    {expanded && <Details entry={entry} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pages > 1 && (
          <div className="table-foot" style={{ margin: "14px -18px -18px", borderRadius: "0 0 15px 15px" }}>
            <span>
              Page {page} of {pages}
            </span>
            <span className="actions">
              <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <Icon name="chevronLeft" /> Newer
              </button>
              <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Older <Icon name="chevronRight" />
              </button>
            </span>
          </div>
        )}
      </Panel>
    </>
  );
}

export default function AuditPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <AuditView />
    </Suspense>
  );
}
