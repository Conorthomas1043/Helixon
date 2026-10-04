"use client";
// /admin/leads - demo requests as a sales pipeline: status, owner and
// notes per lead, resending a notification email that failed, and CSV
// export. Changes are saved (and audited) through PATCH /api/admin/leads.

import { useEffect, useMemo, useState } from "react";

import { PageHeader, KpiCard, Panel, BarList, Drawer, Avatar } from "../_shared/ui";
import { DataTable } from "../_shared/datatable";
import { useAdminData, formatDateTime, formatNumber, timeAgo } from "../_shared/data";
import { Icon } from "../_shared/icons";
import { csrfHeaders } from "../_shared/csrf";
import { toast } from "../_shared/toast";
import { confirmAction } from "../_shared/modal";
import { downloadCsv } from "@/lib/csv";

const RANGES = [
  ["all", "All time"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["90d", "90 days"],
];

const STATUSES = [
  { key: "new", label: "New", tone: "info" },
  { key: "contacted", label: "Contacted", tone: "warn" },
  { key: "qualified", label: "Qualified", tone: "warn" },
  { key: "won", label: "Won", tone: "good" },
  { key: "lost", label: "Lost", tone: "bad" },
  { key: "spam", label: "Spam", tone: "" },
];
const STATUS = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.new;
  return <span className={`pill ${s.tone}`}>{s.label}</span>;
}

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Couldn't copy - your browser blocked clipboard access.");
  }
}

async function patchLead(body) {
  const response = await fetch("/api/admin/leads", {
    method: "PATCH",
    headers: csrfHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "That change didn't save.");
  return data;
}

function LeadDrawer({ lead, me, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState({});
  const draft = drafts[lead?.id] || {};
  const owner = draft.owner ?? (lead?.owner || "");
  const notes = draft.notes ?? (lead?.notes || "");
  const setDraft = (patch) => setDrafts((d) => ({ ...d, [lead.id]: { ...d[lead.id], ...patch } }));

  async function save(body, success) {
    setBusy(true);
    try {
      await patchLead({ id: lead.id, ...body });
      toast.success(success);
      setDrafts((d) => ({ ...d, [lead.id]: undefined }));
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const dirty = lead && (owner !== (lead.owner || "") || notes !== (lead.notes || ""));

  async function invite() {
    const ok = await confirmAction(
      `Email ${lead.email} an invitation to create a Helixon account? The link lasts 14 days. They won't have a plan until they subscribe or you grant demo access from Users.`,
      { title: "Invite to sign up" },
    );
    if (ok) save({ action: "invite" }, `Invitation sent to ${lead.email}`);
  }

  return (
    <Drawer open={Boolean(lead)} onClose={onClose} title={lead?.name || "Lead"} subtitle={lead ? `${lead.company || "No company given"} · ${timeAgo(lead.createdAt)}` : ""}>
      {lead && (
        <>

          <section className="drawer-section">
            <h3>Status</h3>
            <div className="segmented" role="radiogroup" aria-label="Lead status" style={{ flexWrap: "wrap" }}>
              {STATUSES.map((s) => (
                <button
                  key={s.key}
                  role="radio"
                  aria-checked={lead.status === s.key}
                  className={lead.status === s.key ? "active" : ""}
                  disabled={busy}
                  onClick={() => lead.status !== s.key && save({ status: s.key }, `Marked ${s.label.toLowerCase()}`)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {lead.contactedAt && <p className="faint" style={{ fontSize: 13, marginTop: 8 }}>First contacted {formatDateTime(lead.contactedAt)}</p>}
          </section>

          <section className="drawer-section">
            <h3>Owner and notes</h3>
            <div className="stack" style={{ gap: 10 }}>
              <div className="inline-form">
                <input className="search-input no-icon" placeholder="Who's handling it" value={owner} onChange={(e) => setDraft({ owner: e.target.value })} aria-label="Owner" />
                {me && owner !== me && (
                  <button type="button" className="btn small ghost" onClick={() => setDraft({ owner: me })}>Assign to me</button>
                )}
              </div>
              <div className="field">
                <textarea rows={4} maxLength={4000} placeholder="Call notes, next steps…" value={notes} onChange={(e) => setDraft({ notes: e.target.value })} aria-label="Notes" />
              </div>
              {dirty && (
                <div className="actions">
                  <button className="btn small primary" disabled={busy} onClick={() => save({ owner, notes }, "Lead saved")}>Save</button>
                  <button className="btn small ghost" onClick={() => setDrafts((d) => ({ ...d, [lead.id]: undefined }))}>Discard</button>
                </div>
              )}
            </div>
          </section>

          <section className="drawer-section">
            <h3>Contact</h3>
            <dl className="kv">
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${lead.email}`} style={{ color: "var(--accent-strong)" }}>
                  {lead.email}
                </a>
              </dd>
              <dt>Company</dt>
              <dd>{lead.company || <span className="faint">-</span>}</dd>
              <dt>Received</dt>
              <dd>{formatDateTime(lead.createdAt)}</dd>
              <dt>Team notified</dt>
              <dd>
                {lead.emailSent === false ? (
                  <span className="actions" style={{ gap: 8 }}>
                    <span className="pill bad">Notification email failed</span>
                    <button className="btn small" disabled={busy} onClick={() => save({ action: "resend_notification" }, "Notification sent to sales")}>Resend</button>
                  </span>
                ) : (
                  <span className="pill good">Emailed</span>
                )}
              </dd>
            </dl>
          </section>

          <section className="drawer-section">
            <h3>What they&apos;re hoping to solve</h3>
            <div className="notice" style={{ whiteSpace: "pre-wrap" }}>
              {lead.message || <span className="faint">They didn&apos;t leave a message.</span>}
            </div>
          </section>

          <section className="drawer-section">
            <h3>Where they came from</h3>
            <dl className="kv">
              <dt>Source</dt>
              <dd>{lead.source}</dd>
              {lead.medium && (
                <>
                  <dt>Medium</dt>
                  <dd>{lead.medium}</dd>
                </>
              )}
              {lead.campaign && (
                <>
                  <dt>Campaign</dt>
                  <dd>{lead.campaign}</dd>
                </>
              )}
            </dl>
          </section>

          <div className="actions">
            <a
              className="btn primary"
              href={`mailto:${lead.email}?subject=${encodeURIComponent("Your Helixon demo request")}`}
              onClick={() => lead.status === "new" && save({ status: "contacted" }, "Marked contacted")}
            >
              <Icon name="mail" /> Reply
            </a>
            <button className="btn" onClick={() => copy(lead.email, "Email")}>
              <Icon name="copy" /> Copy email
            </button>
            {lead.status !== "spam" && (
              <button className="btn" disabled={busy} onClick={() => invite()}>
                <Icon name="userPlus" /> Invite to sign up
              </button>
            )}
            {lead.status !== "spam" && (
              <button className="btn ghost" disabled={busy} onClick={() => save({ status: "spam" }, "Marked as spam")}>
                Mark spam
              </button>
            )}
          </div>
        </>
      )}
    </Drawer>
  );
}

export default function LeadsPage() {
  const [range, setRange] = useState("all");
  const [status, setStatus] = useState("open");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params = new URLSearchParams();
  if (range !== "all") params.set("range", range);
  if (search) params.set("search", search);
  const query = params.toString();

  const { data, error, loading, reload } = useAdminData(`/api/admin/leads${query ? `?${query}` : ""}`);
  const summary = data?.summary;
  const all = useMemo(() => data?.leads || [], [data]);
  const leads = useMemo(
    () =>
      all.filter((l) => {
        if (status === "open") return !["won", "lost", "spam"].includes(l.status);
        if (status === "all") return l.status !== "spam";
        return l.status === status;
      }),
    [all, status],
  );
  const selected = all.find((l) => l.id === selectedId) || null;
  const byStatus = summary?.byStatus || {};
  const openCount = (byStatus.new || 0) + (byStatus.contacted || 0) + (byStatus.qualified || 0);

  function exportCsv() {
    downloadCsv(
      `helixon-leads-${new Date().toISOString().slice(0, 10)}.csv`,
      leads.map((l) => ({
        received: l.createdAt,
        name: l.name,
        email: l.email,
        company: l.company || "",
        status: l.status,
        owner: l.owner || "",
        source: l.source,
        medium: l.medium || "",
        campaign: l.campaign || "",
        message: l.message || "",
        notes: l.notes || "",
      })),
    );
  }

  const columns = [
    {
      key: "name",
      label: "Lead",
      sortable: true,
      render: (l) => (
        <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <Avatar name={l.name} />
          <span style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontWeight: 600 }}>{l.name}</div>
            <div className="faint truncate">{l.company || l.email}</div>
          </span>
        </span>
      ),
    },
    { key: "status", label: "Status", sortable: true, sortValue: (l) => STATUSES.findIndex((s) => s.key === l.status), render: (l) => <StatusPill status={l.status} /> },
    { key: "owner", label: "Owner", sortable: true, render: (l) => (l.owner ? l.owner : <span className="faint">Unassigned</span>) },
    { key: "source", label: "Source", sortable: true, render: (l) => <span className="pill info bare">{l.source}</span> },
    { key: "createdAt", label: "Received", sortable: true, defaultDir: "desc", render: (l) => <span title={formatDateTime(l.createdAt)} style={{ whiteSpace: "nowrap" }}>{timeAgo(l.createdAt)}</span> },
    { key: "emailSent", label: "Notified", render: (l) => (l.emailSent === false ? <span className="pill bad">Failed</span> : <span className="pill good">Sent</span>) },
  ];

  const statusTabs = [
    ["open", "Open", openCount],
    ...STATUSES.map((s) => [s.key, s.label, byStatus[s.key] || 0]),
    ["all", "All", summary?.total || 0],
  ];

  return (
    <>
      <PageHeader title="Leads" description="Demo requests as a pipeline: who's handling each one, where it's up to, and where they found you.">
        <div className="segmented" role="group" aria-label="Range">
          {RANGES.map(([value, label]) => (
            <button key={value} className={range === value ? "active" : ""} aria-pressed={range === value} onClick={() => setRange(value)}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn small" onClick={exportCsv} disabled={!leads.length}>Export CSV</button>
        <button className="btn small" onClick={reload} disabled={loading}>
          <Icon name="refresh" /> Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

      {summary && summary.notEmailed > 0 && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <b>{summary.notEmailed}</b> {summary.notEmailed === 1 ? "lead was" : "leads were"} saved but the notification email to your team failed. Open them and use Resend, or follow up directly.
        </div>
      )}

      <div className="kpi-grid cols-5">
        <KpiCard label="Open leads" value={summary ? formatNumber(openCount) : "-"} icon="inbox" foot="New, contacted or qualified" />
        <KpiCard label="Not contacted" value={summary ? formatNumber(summary.untouched) : "-"} icon="alert" tone={summary?.untouched ? "var(--warn)" : undefined} />
        <KpiCard label="Last 7 days" value={summary ? formatNumber(summary.last7d) : "-"} icon="trending" tone="var(--ok)" />
        <KpiCard label="Won" value={summary ? formatNumber(byStatus.won || 0) : "-"} icon="check" tone="var(--ok)" foot={summary?.winRate !== null && summary?.winRate !== undefined ? `${summary.winRate}% of decided leads` : "None decided yet"} />
        <KpiCard label="Leads" value={summary ? formatNumber(summary.total) : "-"} icon="users" foot={range === "all" ? "All time, excluding spam" : `Last ${range}, excluding spam`} />
      </div>

      <div className="split" style={{ marginBottom: 22 }}>
        <div>
          <div className="toolbar">
            <input className="search-input" placeholder="Search name, email, company, notes..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search leads" />
            <div className="segmented" role="group" aria-label="Filter by status" style={{ flexWrap: "wrap" }}>
              {statusTabs.map(([key, label, count]) => (
                <button key={key} className={status === key ? "active" : ""} aria-pressed={status === key} onClick={() => setStatus(key)}>
                  {label} <span style={{ opacity: 0.6 }}>{count}</span>
                </button>
              ))}
            </div>
          </div>
          <DataTable
            columns={columns}
            rows={leads}
            loading={loading}
            onRowClick={(l) => setSelectedId(l.id)}
            pageSize={15}
            defaultSort={{ key: "createdAt", dir: "desc" }}
            empty={{ icon: "inbox", title: search ? "No leads match that search" : "No leads here", body: search ? "Try different words." : "Try another status or range." }}
          />
        </div>

        <Panel title="Top sources" sub="Where leads found you (excluding spam)">
          <BarList items={summary?.topSources || []} emptyLabel="No leads yet." />
        </Panel>
      </div>

      <LeadDrawer lead={selected} me={data?.admin?.username} onClose={() => setSelectedId(null)} onChanged={reload} />
    </>
  );
}
