"use client";

import { useEffect, useState } from "react";

import { PageHeader, KpiCard, Panel, BarList, Drawer, Avatar } from "../_shared/ui";
import { DataTable } from "../_shared/datatable";
import { useAdminData, formatDateTime, formatNumber, timeAgo } from "../_shared/data";
import { Icon } from "../_shared/icons";
import { toast } from "../_shared/toast";

const RANGES = [
  ["all", "All time"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["90d", "90 days"],
];

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Couldn't copy - your browser blocked clipboard access.");
  }
}

function LeadDrawer({ lead, onClose }) {
  return (
    <Drawer open={Boolean(lead)} onClose={onClose} title={lead?.name || "Lead"} subtitle={lead ? `${lead.company || "No company given"} · ${timeAgo(lead.createdAt)}` : ""}>
      {lead && (
        <>
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
              <dd>{lead.emailSent === false ? <span className="pill bad">Notification email failed</span> : <span className="pill good">Emailed</span>}</dd>
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
            <a className="btn primary" href={`mailto:${lead.email}?subject=${encodeURIComponent("Your Helixon demo request")}`}>
              <Icon name="mail" /> Reply
            </a>
            <button className="btn" onClick={() => copy(lead.email, "Email")}>
              <Icon name="copy" /> Copy email
            </button>
          </div>
        </>
      )}
    </Drawer>
  );
}

export default function LeadsPage() {
  const [range, setRange] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

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
  const leads = data?.leads || [];

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
            <div className="faint truncate">{l.company || "No company"}</div>
          </span>
        </span>
      ),
    },
    { key: "email", label: "Email", sortable: true, render: (l) => <span className="muted">{l.email}</span> },
    {
      key: "message",
      label: "Message",
      render: (l) => (
        <span className="muted" style={{ display: "block", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {l.message || <span className="faint">-</span>}
        </span>
      ),
    },
    { key: "source", label: "Source", sortable: true, render: (l) => <span className="pill info bare">{l.source}</span> },
    { key: "createdAt", label: "Received", sortable: true, defaultDir: "desc", render: (l) => <span title={formatDateTime(l.createdAt)} style={{ whiteSpace: "nowrap" }}>{timeAgo(l.createdAt)}</span> },
    { key: "emailSent", label: "Notified", render: (l) => (l.emailSent === false ? <span className="pill bad">Failed</span> : <span className="pill good">Sent</span>) },
  ];

  return (
    <>
      <PageHeader title="Leads" description="People who asked for a demo, with the message they left and where they found you.">
        <div className="segmented">
          {RANGES.map(([value, label]) => (
            <button key={value} className={range === value ? "active" : ""} onClick={() => setRange(value)}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn small" onClick={reload} disabled={loading}>
          <Icon name="refresh" /> Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

      {summary && summary.notEmailed > 0 && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <b>{summary.notEmailed}</b> {summary.notEmailed === 1 ? "lead was" : "leads were"} saved but the notification email to your team failed, so nobody was told. Open them below and follow up.
        </div>
      )}

      <div className="kpi-grid cols-3">
        <KpiCard label="Leads" value={summary ? formatNumber(summary.total) : "-"} icon="inbox" foot={range === "all" ? "All time" : `Last ${range}`} />
        <KpiCard label="Last 7 days" value={summary ? formatNumber(summary.last7d) : "-"} icon="trending" tone="var(--ok)" />
        <KpiCard label="Last 30 days" value={summary ? formatNumber(summary.last30d) : "-"} icon="clock" tone="var(--info)" />
      </div>

      <div className="split" style={{ marginBottom: 22 }}>
        <div>
          <div className="section-head">
            <input className="search-input" placeholder="Search name, email, company, message..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search leads" />
          </div>
          <DataTable
            columns={columns}
            rows={leads}
            loading={loading}
            onRowClick={setSelected}
            pageSize={10}
            defaultSort={{ key: "createdAt", dir: "desc" }}
            empty={{ icon: "inbox", title: search ? "No leads match that search" : "No leads in this period", body: search ? "Try different words." : "Demo requests from the website appear here." }}
          />
        </div>

        <Panel title="Top sources" sub="Where leads found you">
          <BarList items={summary?.topSources || []} emptyLabel="No leads yet." />
        </Panel>
      </div>

      <LeadDrawer lead={selected} onClose={() => setSelected(null)} />
    </>
  );
}
