"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { PageHeader, KpiCard, Drawer, Progress, Avatar, Skeleton } from "../_shared/ui";
import { DataTable } from "../_shared/datatable";
import { useAdminData, formatDate, formatDateTime, formatNumber, timeAgo } from "../_shared/data";
import { Icon } from "../_shared/icons";
import { csrfHeaders } from "../_shared/csrf";
import { confirmAction, promptText } from "../_shared/modal";
import { toast } from "../_shared/toast";
import { downloadCsv } from "@/lib/csv";

const PLAN_LABEL = { individual: "Individual", agency: "Agency", solo: "Individual" };

function PlanPill({ plan, status, demo }) {
  if (!status) return <span className="pill warn">No plan</span>;
  const label = PLAN_LABEL[plan] || plan || "Plan";
  if (status === "active") return <span className={`pill ${demo ? "info" : "good"}`}>{label}{demo ? " · demo" : ""}</span>;
  return <span className="pill bad">{label} &middot; {status}</span>;
}

const FILTERS = [
  ["all", "All", () => true],
  ["paying", "Paying", (a) => a.subscriptionStatus === "active" && !a.demo],
  ["demo", "Demo", (a) => a.demo && a.subscriptionStatus === "active"],
  ["noplan", "No plan", (a) => !a.subscriptionStatus],
  ["inactive", "Inactive 30d", (a) => !a.active30d],
  ["capped", "Capped", (a) => Boolean(a.screeningCap)],
  ["suspended", "Suspended", (a) => a.suspended],
];

const HISTORY_LABELS = {
  agency_update: "Settings changed",
  agency_suspend: "Suspended",
  agency_unsuspend: "Reactivated",
  agency_remove_member: "Member removed",
};

function historyDetail(h) {
  const m = h.metadata || {};
  if (m.to) return `Renamed to ${m.to}`;
  if ("screeningCap" in m) return m.screeningCap ? `Monthly cap set to ${m.screeningCap}` : "Monthly cap removed";
  if (m.member) return m.member;
  if (m.reason) return m.reason;
  return "";
}

async function patchAgency(body) {
  const response = await fetch("/api/admin/agencies", {
    method: "PATCH",
    headers: csrfHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "That change didn't save.");
  return data;
}

function Section({ title, children, action }) {
  return (
    <section className="drawer-section">
      <div className="section-head" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function AgencyDrawer({ id, onClose, onChanged }) {
  const { data, error, loading, reload } = useAdminData(id ? `/api/admin/agencies?id=${encodeURIComponent(id)}` : null, {
    enabled: Boolean(id),
  });
  const [busy, setBusy] = useState(false);
  const [capDraft, setCapDraft] = useState(null);

  const agency = data?.agency?.id === id ? data.agency : null;
  const sub = agency ? data.subscription : null;

  async function run(body, success) {
    setBusy(true);
    try {
      await patchAgency({ id, ...body });
      toast.success(success);
      setCapDraft(null);
      reload();
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    const name = await promptText("Agency name:", { defaultValue: agency.name || "" });
    if (name?.trim() && name.trim() !== agency.name) run({ action: "rename", name: name.trim() }, "Agency renamed");
  }

  async function suspend() {
    const reason = await promptText(`Why are you suspending ${agency.name}? Every member is locked out of the app until you reactivate it.`, { defaultValue: "" });
    if (reason !== null && reason !== undefined) run({ action: "suspend", reason: reason.trim() }, "Agency suspended");
  }

  async function removeMember(member) {
    if (await confirmAction(`Remove ${member.name} from ${agency.name}? They keep their account but lose access to this workspace.`, { title: "Remove member", danger: true })) {
      run({ action: "remove_member", profileId: member.id }, `${member.name} removed`);
    }
  }

  const cap = capDraft ?? (agency?.screeningCap ? String(agency.screeningCap) : "");

  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={agency?.name || "Agency"} subtitle={agency ? `Created ${formatDate(agency.createdAt)}` : "Loading..."}>
      {error && <div className="notice error">{error}</div>}
      {loading && !agency && (
        <>
          <Skeleton height={16} width="60%" />
          <Skeleton height={16} width="80%" />
          <Skeleton height={16} width="45%" />
        </>
      )}

      {agency && (
        <>
          {agency.suspendedAt && (
            <div className="notice error">
              Suspended {timeAgo(agency.suspendedAt)}{agency.suspendedReason ? ` - ${agency.suspendedReason}` : ""}. Members can&rsquo;t use the app.
            </div>
          )}

          <div className="actions">
            <button className="btn small" onClick={rename} disabled={busy}><Icon name="building" size={13} /> Rename</button>
            {agency.suspendedAt ? (
              <button className="btn small primary" onClick={() => run({ action: "unsuspend" }, "Agency reactivated")} disabled={busy}>Reactivate</button>
            ) : (
              <button className="btn small danger" onClick={suspend} disabled={busy}><Icon name="ban" size={13} /> Suspend</button>
            )}
            <Link className="btn small ghost" href={`/admin/audit?target=${agency.id}`}>Audit log</Link>
          </div>

          <Section title="Plan">
            <dl className="kv">
              <dt>Subscription</dt>
              <dd>{sub ? <PlanPill plan={sub.plan} status={sub.status} demo={sub.demo} /> : <span className="muted">None on file</span>}</dd>
              {sub?.since && (
                <>
                  <dt>Customer since</dt>
                  <dd>{formatDate(sub.since)}</dd>
                </>
              )}
              {sub?.stripeCustomerId && (
                <>
                  <dt>Stripe</dt>
                  <dd><Link className="panel-link" style={{ marginLeft: 0 }} href="/admin/billing">Open in Billing</Link> <span className="mono faint">{sub.stripeCustomerId}</span></dd>
                </>
              )}
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

          <Section title="Screening limit">
            <p className="faint" style={{ margin: "0 0 8px", fontSize: 13.5 }}>
              {formatNumber(agency.screeningsThisMonth)} CVs screened this month{agency.screeningCap ? ` of ${formatNumber(agency.screeningCap)}` : ""}. With a cap, screening stops for the rest of the month once it&rsquo;s reached.
            </p>
            {agency.screeningCap ? <Progress value={agency.screeningsThisMonth} max={agency.screeningCap} /> : null}
            <form
              className="inline-form"
              style={{ marginTop: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                run({ action: "set_cap", cap: cap.trim() ? Number(cap) : null }, cap.trim() ? `Monthly cap set to ${cap.trim()}` : "Cap removed");
              }}
            >
              <input className="search-input no-icon" type="number" min={1} max={100000} placeholder="No cap" value={cap} onChange={(e) => setCapDraft(e.target.value)} aria-label="Monthly screening cap" style={{ maxWidth: 160 }} />
              <button className="btn small" disabled={busy || cap === (agency.screeningCap ? String(agency.screeningCap) : "")}>Save cap</button>
              {agency.screeningCap && (
                <button type="button" className="btn small ghost" disabled={busy} onClick={() => run({ action: "set_cap", cap: null }, "Cap removed")}>Remove cap</button>
              )}
            </form>
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
                      <span style={{ minWidth: 0 }}>
                        <span className="truncate" style={{ display: "block" }}>{m.name}</span>
                        <span className="faint" style={{ fontSize: 13 }}>Joined {formatDate(m.joinedAt)}</span>
                      </span>
                    </span>
                    <span className="actions" style={{ gap: 6 }}>
                      {m.clerkUserId && <Link className="btn small ghost" href={`/admin/users?q=${encodeURIComponent(m.clerkUserId)}`}>User</Link>}
                      <button className="btn small" onClick={() => removeMember(m)} disabled={busy}>Remove</button>
                    </span>
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

          <Section title="History">
            {(data.history || []).length === 0 ? (
              <div className="faint" style={{ fontSize: 13.5 }}>No admin changes recorded.</div>
            ) : (
              <div className="mini-list">
                {data.history.map((h) => (
                  <div className="mini-row" key={h.id}>
                    <div style={{ minWidth: 0 }}>
                      <div>{HISTORY_LABELS[h.action] || h.action}{historyDetail(h) ? ` - ${historyDetail(h)}` : ""}</div>
                      <div className="faint" style={{ fontSize: 13 }}>by {h.admin} · {formatDateTime(h.at)}</div>
                    </div>
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
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, error, loading, reload } = useAdminData(`/api/admin/agencies${search ? `?search=${encodeURIComponent(search)}` : ""}`);
  const summary = data?.summary;
  const all = useMemo(() => data?.agencies || [], [data]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([key, , test]) => [key, all.filter(test).length])), [all]);
  const rows = useMemo(() => all.filter(FILTERS.find(([key]) => key === filter)[2]), [all, filter]);

  function exportCsv() {
    downloadCsv(
      `helixon-agencies-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((a) => ({
        name: a.name,
        plan: a.plan || "",
        subscription: a.subscriptionStatus || "",
        demo: a.demo ? "yes" : "",
        suspended: a.suspended ? "yes" : "",
        members: a.members,
        jobs: a.jobs,
        candidates: a.candidates,
        screenings_this_month: a.screeningsThisMonth,
        monthly_cap: a.screeningCap || "",
        last_active: a.lastActivityAt || "",
        created: a.createdAt,
        id: a.id,
      })),
    );
  }

  const columns = [
    {
      key: "name",
      label: "Agency",
      sortable: true,
      render: (a) => (
        <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <Avatar name={a.name} />
          <span style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontWeight: 600 }}>
              {a.name}
              {a.suspended && <span className="pill bad" style={{ marginLeft: 6 }}>Suspended</span>}
            </div>
            <div className="faint mono">{a.id.slice(0, 8)}</div>
          </span>
        </span>
      ),
    },
    { key: "plan", label: "Plan", sortable: true, sortValue: (a) => a.subscriptionStatus || "zzz", render: (a) => <PlanPill plan={a.plan} status={a.subscriptionStatus} demo={a.demo} /> },
    { key: "members", label: "Members", sortable: true, align: "right", defaultDir: "desc" },
    { key: "jobs", label: "Jobs", sortable: true, align: "right", defaultDir: "desc" },
    { key: "candidates", label: "Candidates", sortable: true, align: "right", defaultDir: "desc", render: (a) => formatNumber(a.candidates) },
    {
      key: "screeningsThisMonth",
      label: "This month",
      sortable: true,
      defaultDir: "desc",
      render: (a) =>
        a.screeningCap ? (
          <span style={{ display: "grid", gap: 4, minWidth: 96 }}>
            <span className="muted">
              {formatNumber(a.screeningsThisMonth)} / {formatNumber(a.screeningCap)}
            </span>
            <Progress value={a.screeningsThisMonth} max={a.screeningCap} />
          </span>
        ) : (
          <span className="muted">{formatNumber(a.screeningsThisMonth)}</span>
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
      <PageHeader title="Agencies" description="Every customer workspace: plan, team, usage and activity. Open one to rename it, cap its screenings, suspend it or manage its members.">
        <button className="btn small" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
        <button className="btn small" onClick={reload} disabled={loading}>
          <Icon name="refresh" /> Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="kpi-grid cols-6">
        <KpiCard label="Agencies" value={summary ? formatNumber(summary.agencies) : "-"} icon="building" />
        <KpiCard label="Paying" value={summary ? formatNumber(summary.paying) : "-"} icon="card" tone="var(--ok)" foot="Stripe subscription" />
        <KpiCard label="Demo access" value={summary ? formatNumber(summary.demo) : "-"} icon="sparkles" tone="var(--info)" foot="Free, granted by an admin" />
        <KpiCard label="Active (30 days)" value={summary ? formatNumber(summary.active30d) : "-"} icon="traffic" foot="Created a job or candidate" />
        <KpiCard label="No plan" value={summary ? formatNumber(summary.withoutPlan) : "-"} icon="alert" tone="var(--warn)" foot="Signed up, not subscribed" />
        <KpiCard label="Suspended" value={summary ? formatNumber(summary.suspended) : "-"} icon="ban" tone={summary?.suspended ? "var(--critical)" : undefined} />
      </div>

      <div className="toolbar section">
        <input className="search-input" placeholder="Search agencies..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} aria-label="Search agencies" />
        <div className="segmented" role="group" aria-label="Filter agencies">
          {FILTERS.map(([key, label]) => (
            <button key={key} className={filter === key ? "active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label} <span style={{ opacity: 0.6 }}>{counts[key] ?? 0}</span>
            </button>
          ))}
        </div>
        {data?.truncated && <span className="pill warn">Counts capped at 20,000 rows</span>}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        onRowClick={(a) => setSelected(a.id)}
        defaultSort={{ key: "createdAt", dir: "desc" }}
        empty={{ icon: "building", title: search || filter !== "all" ? "No agencies match" : "No agencies yet", body: search || filter !== "all" ? "Try a different search or filter." : "They appear here as customers sign up." }}
      />

      <AgencyDrawer id={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </>
  );
}
