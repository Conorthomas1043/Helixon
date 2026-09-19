"use client";

import { useEffect, useState } from "react";

import { PageHeader, KpiCard, Panel, Drawer, Progress, Avatar, Skeleton } from "../_shared/ui";
import { DataTable } from "../_shared/datatable";
import { useAdminData, formatDate, formatNumber, timeAgo } from "../_shared/data";
import { Icon } from "../_shared/icons";

const PLAN_LABEL = { individual: "Individual", agency: "Agency", solo: "Individual" };

function PlanPill({ plan, status }) {
  if (!status) return <span className="pill warn">No plan</span>;
  const label = PLAN_LABEL[plan] || plan || "Plan";
  if (status === "active") return <span className="pill good">{label}</span>;
  return <span className="pill bad">{label} &middot; {status}</span>;
}

function Section({ title, children }) {
  return (
    <section className="drawer-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function AgencyDrawer({ id, onClose }) {
  const { data, error, loading } = useAdminData(id ? `/api/admin/agencies?id=${encodeURIComponent(id)}` : null, {
    enabled: Boolean(id),
  });

  const agency = data?.agency;
  const sub = data?.subscription;

  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={agency?.name || "Agency"} subtitle={agency ? `Created ${formatDate(agency.createdAt)}` : "Loading..."}>
      {error && <div className="notice error">{error}</div>}
      {loading && !data && (
        <>
          <Skeleton height={16} width="60%" />
          <Skeleton height={16} width="80%" />
          <Skeleton height={16} width="45%" />
        </>
      )}

      {agency && (
        <>
          <Section title="Plan">
            <dl className="kv">
              <dt>Subscription</dt>
              <dd>{sub ? <PlanPill plan={sub.plan} status={sub.status} /> : <span className="muted">None on file</span>}</dd>
              {sub?.since && (
                <>
                  <dt>Customer since</dt>
                  <dd>{formatDate(sub.since)}</dd>
                </>
              )}
              {sub?.stripeCustomerId && (
                <>
                  <dt>Stripe customer</dt>
                  <dd className="mono">{sub.stripeCustomerId}</dd>
                </>
              )}
              <dt>Analyses used</dt>
              <dd>
                {formatNumber(agency.analysesUsed)}
                {agency.analysesLimit ? ` of ${formatNumber(agency.analysesLimit)}` : " (no cap)"}
              </dd>
              <dt>Team workspace</dt>
              <dd>{agency.hasTeamWorkspace ? "Yes (Agency plan)" : "No"}</dd>
              {agency.intakeEmail && (
                <>
                  <dt>Contact email</dt>
                  <dd>{agency.intakeEmail}</dd>
                </>
              )}
            </dl>
          </Section>

          <Section title={`Members (${data.members.length})`}>
            {data.members.length === 0 ? (
              <div className="muted">No one is linked to this agency.</div>
            ) : (
              <div className="mini-list">
                {data.members.map((m) => (
                  <div className="mini-row" key={m.id}>
                    <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <Avatar name={m.name} size={28} />
                      <span className="truncate">{m.name}</span>
                    </span>
                    <span className="faint">Joined {formatDate(m.joinedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Recent jobs">
            {data.recentJobs.length === 0 ? (
              <div className="muted">No jobs yet.</div>
            ) : (
              <div className="mini-list">
                {data.recentJobs.map((j) => (
                  <div className="mini-row" key={j.id}>
                    <span className="truncate">
                      {j.title} {j.client && <span className="faint">&middot; {j.client}</span>}
                    </span>
                    <span className={`pill ${j.status === "open" ? "good" : ""}`}>{j.status || "open"}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Recent candidates">
            {data.recentCandidates.length === 0 ? (
              <div className="muted">No candidates yet.</div>
            ) : (
              <div className="mini-list">
                {data.recentCandidates.map((c) => (
                  <div className="mini-row" key={c.id}>
                    <span className="truncate">
                      {c.name} {c.title && <span className="faint">&middot; {c.title}</span>}
                    </span>
                    <span className="mono">{c.score ?? "-"}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </Drawer>
  );
}

export default function AgenciesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, error, loading, reload } = useAdminData(`/api/admin/agencies${search ? `?search=${encodeURIComponent(search)}` : ""}`);
  const summary = data?.summary;
  const rows = data?.agencies || [];

  const columns = [
    {
      key: "name",
      label: "Agency",
      sortable: true,
      render: (a) => (
        <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <Avatar name={a.name} />
          <span style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontWeight: 600 }}>{a.name}</div>
            <div className="faint mono">{a.id.slice(0, 8)}</div>
          </span>
        </span>
      ),
    },
    { key: "plan", label: "Plan", sortable: true, sortValue: (a) => a.subscriptionStatus || "zzz", render: (a) => <PlanPill plan={a.plan} status={a.subscriptionStatus} /> },
    { key: "members", label: "Members", sortable: true, align: "right", defaultDir: "desc" },
    { key: "jobs", label: "Jobs", sortable: true, align: "right", defaultDir: "desc" },
    { key: "candidates", label: "Candidates", sortable: true, align: "right", defaultDir: "desc", render: (a) => formatNumber(a.candidates) },
    {
      key: "analysesUsed",
      label: "Analyses",
      sortable: true,
      defaultDir: "desc",
      render: (a) =>
        a.analysesLimit ? (
          <span style={{ display: "grid", gap: 4, minWidth: 96 }}>
            <span className="muted">
              {formatNumber(a.analysesUsed)} / {formatNumber(a.analysesLimit)}
            </span>
            <Progress value={a.analysesUsed} max={a.analysesLimit} />
          </span>
        ) : (
          <span className="muted">{formatNumber(a.analysesUsed)}</span>
        ),
    },
    {
      key: "lastActivityAt",
      label: "Last active",
      sortable: true,
      defaultDir: "desc",
      render: (a) => (a.lastActivityAt ? <span title={a.lastActivityAt}>{timeAgo(a.lastActivityAt)}</span> : <span className="faint">never</span>),
    },
    { key: "createdAt", label: "Created", sortable: true, defaultDir: "desc", render: (a) => <span className="muted">{formatDate(a.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader title="Agencies" description="Every customer workspace: plan, team size, how much they use Helixon, and when they were last active.">
        <button className="btn small" onClick={reload} disabled={loading}>
          <Icon name="refresh" /> Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="kpi-grid cols-5">
        <KpiCard label="Agencies" value={summary ? formatNumber(summary.agencies) : "-"} icon="building" />
        <KpiCard label="Paying" value={summary ? formatNumber(summary.paying) : "-"} icon="card" tone="var(--ok)" foot="Active subscription" />
        <KpiCard label="Active (30 days)" value={summary ? formatNumber(summary.active30d) : "-"} icon="traffic" tone="var(--info)" foot="Created a job or candidate" />
        <KpiCard label="Candidates screened" value={summary ? formatNumber(summary.candidates) : "-"} icon="users" />
        <KpiCard label="No plan" value={summary ? formatNumber(summary.withoutPlan) : "-"} icon="alert" tone="var(--warn)" foot="Signed up, not subscribed" />
      </div>

      <div className="section-head">
        <input className="search-input" placeholder="Search agencies..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search agencies" />
        {data?.truncated && <span className="pill warn">Counts capped at 20,000 rows</span>}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onRowClick={(a) => setSelected(a.id)}
        defaultSort={{ key: "createdAt", dir: "desc" }}
        empty={{ icon: "building", title: search ? "No agencies match that search" : "No agencies yet", body: search ? "Try a different name." : "They appear here as customers sign up." }}
      />

      <p className="footer-note">Click a row for its team, subscription and recent activity.</p>

      <AgencyDrawer id={selected} onClose={() => setSelected(null)} />
    </>
  );
}
