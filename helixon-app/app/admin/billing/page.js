"use client";
// /admin/billing - revenue from paying Stripe subscriptions, every
// subscription with who it belongs to and a link into Stripe, and what
// changed in the selected range. Demo access (granted from Users, no
// Stripe subscription) is shown but never counted as revenue.

import { useMemo, useState } from "react";

import { PageHeader, KpiCard, Panel, StatList } from "../_shared/ui";
import { Icon } from "../_shared/icons";
import { DataTable } from "../_shared/datatable";
import { useAdminData, formatDate, timeAgo } from "../_shared/data";
import { downloadCsv } from "@/lib/csv";

const RANGES = [
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["90d", "90 days"],
  ["365d", "1 year"],
];

const STATUS_PILL = { active: "good", trialing: "info", past_due: "warn", canceled: "bad", unpaid: "bad", incomplete: "warn" };
const STATUS_TONE = { active: "var(--ok)", trialing: "var(--info)", past_due: "var(--warn)", canceled: "var(--critical)" };

const FILTERS = [
  ["all", "All"],
  ["paying", "Paying"],
  ["past_due", "Past due"],
  ["canceled", "Cancelled"],
  ["demo", "Demo access"],
];

const gbp = (n) => `£${Number(n || 0).toLocaleString("en-GB")}`;

export default function BillingPage() {
  const [range, setRange] = useState("30d");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useAdminData(`/api/admin/billing?range=${range}`);

  const summary = data?.summary;
  const all = useMemo(() => data?.subscriptions || [], [data]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((s) => {
      if (filter === "paying" && (s.demo || !["active", "trialing", "past_due"].includes(s.status))) return false;
      if (filter === "past_due" && s.status !== "past_due") return false;
      if (filter === "canceled" && s.status !== "canceled") return false;
      if (filter === "demo" && !s.demo) return false;
      if (!q) return true;
      return [s.customer, s.agencyName, s.stripeCustomerId, s.stripeSubscriptionId].some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [all, filter, search]);

  const stripe = data?.stripeDashboard || "https://dashboard.stripe.com";

  const columns = [
    {
      key: "customer", sortable: true,
      label: "Customer",
      sortValue: (s) => (s.agencyName || s.customer || "").toLowerCase(),
      render: (s) => (
        <div style={{ minWidth: 0 }}>
          <div className="truncate" style={{ fontWeight: 600 }}>{s.agencyName || s.customer}</div>
          <div className="faint truncate" style={{ fontSize: 13 }}>{s.agencyName ? s.customer : ""}</div>
        </div>
      ),
    },
    { key: "planLabel", sortable: true, label: "Plan", render: (s) => s.planLabel || s.plan || "-" },
    {
      key: "status", sortable: true,
      label: "Status",
      render: (s) =>
        s.demo ? (
          <span className={`pill ${s.status === "active" ? "info" : ""} bare`} title={s.demoExpiresAt ? `Ends ${new Date(s.demoExpiresAt).toLocaleString()}` : "No end date"}>
            {s.status === "active" ? "Demo access" : "Demo ended"}
            {s.status === "active" && s.demoExpiresAt ? ` · ends ${formatDate(s.demoExpiresAt)}` : ""}
          </span>
        ) : (
          <span className={`pill ${STATUS_PILL[s.status] || ""}`}>{String(s.status).replace(/_/g, " ")}</span>
        ),
    },
    { key: "monthly", sortable: true, label: "Monthly", align: "right", render: (s) => (s.monthly ? gbp(s.monthly) : <span className="faint">-</span>) },
    { key: "createdAt", sortable: true, label: "Started", defaultDir: "desc", render: (s) => <span className="muted">{formatDate(s.createdAt)}</span> },
    { key: "updatedAt", sortable: true, label: "Last change", defaultDir: "desc", render: (s) => <span className="muted" title={s.updatedAt}>{timeAgo(s.updatedAt)}</span> },
    {
      key: "stripe",
      label: "",
      render: (s) =>
        s.stripeSubscriptionId || s.stripeCustomerId ? (
          <a
            className="btn small ghost"
            href={s.stripeSubscriptionId ? `${stripe}/subscriptions/${s.stripeSubscriptionId}` : `${stripe}/customers/${s.stripeCustomerId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="external" size={13} /> Stripe
          </a>
        ) : null,
    },
  ];

  function exportCsv() {
    downloadCsv(
      `helixon-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((s) => ({
        agency: s.agencyName || "",
        customer: s.customer,
        plan: s.planLabel || s.plan || "",
        status: s.demo ? (s.status === "active" ? "demo" : "demo ended") : s.status,
        demo_ends: s.demoExpiresAt || "",
        monthly_gbp: s.monthly,
        started: s.createdAt || "",
        last_change: s.updatedAt || "",
        stripe_customer: s.stripeCustomerId || "",
        stripe_subscription: s.stripeSubscriptionId || "",
      })),
    );
  }

  return (
    <>
      <PageHeader title="Billing" description="Revenue from paying subscriptions, who's on which plan, and what changed. Demo access is listed but never counted as revenue.">
        <div className="segmented" role="group" aria-label="Range">
          {RANGES.map(([key, label]) => (
            <button key={key} className={range === key ? "active" : ""} aria-pressed={range === key} onClick={() => setRange(key)}>{label}</button>
          ))}
        </div>
        <button className="btn small" onClick={reload} disabled={loading}><Icon name="refresh" size={13} /> Refresh</button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}

      <div className="kpi-grid cols-6">
        <KpiCard label="Monthly revenue" icon="card" value={summary ? gbp(summary.mrr) : "-"} tone="var(--ok)" foot={summary ? `${gbp(summary.arr)} a year` : undefined} />
        <KpiCard label="Paying" icon="users" value={summary?.paying ?? "-"} />
        <KpiCard label="New" icon="trending" value={summary?.newInRange ?? "-"} tone="var(--info)" foot={`Last ${RANGES.find(([k]) => k === range)[1]}`} />
        <KpiCard label="Cancelled" icon="ban" value={summary?.cancelledInRange ?? "-"} tone={summary?.cancelledInRange ? "var(--critical)" : undefined} foot={`Last ${RANGES.find(([k]) => k === range)[1]}`} />
        <KpiCard label="Past due" icon="alert" value={summary?.pastDue ?? "-"} tone={summary?.pastDue ? "var(--warn)" : undefined} foot="Payment failing" />
        <KpiCard label="Demo access" icon="sparkles" value={summary?.demo ?? "-"} foot="Free, not revenue" />
      </div>

      <div className="split section">
        <Panel title="Stripe subscriptions by status">
          <StatList rows={Object.entries(summary?.byStatus || {}).map(([status, count]) => ({ label: status.replace(/_/g, " "), value: count, tone: STATUS_TONE[status] }))} />
        </Panel>
        <Panel title="Paying subscriptions by plan">
          <StatList rows={Object.entries(summary?.byPlan || {}).map(([plan, count]) => ({ label: plan, value: count }))} />
        </Panel>
      </div>

      <section className="section">
        <div className="toolbar">
          <input className="search-input no-icon" placeholder="Search customer, agency or Stripe id" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search subscriptions" />
          <div className="segmented" role="group" aria-label="Filter">
            {FILTERS.map(([key, label]) => (
              <button key={key} className={filter === key ? "active" : ""} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
            ))}
          </div>
          <button className="btn small" style={{ marginLeft: "auto" }} onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          defaultSort={{ key: "createdAt", dir: "desc" }}
          empty={{ icon: "card", title: "No subscriptions match", body: "Try another filter." }}
        />
      </section>
    </>
  );
}
