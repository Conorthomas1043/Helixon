"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { PageHeader, RangeControl, KpiCard, Panel, BarList, StatList } from "../_shared/ui";
import { Globe, useGlobePoints } from "../_shared/globe";
import { RequestTable } from "../_shared/table";
import { useAdminStats, useAdminTraffic, useAdminOps, useAdminServices } from "../_shared/hooks";

function formatCurrency(amount, currency = "GBP") {
  const n = Number(amount || 0);
  if (!Number.isFinite(n) || n <= 0) return "-";
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: (currency || "GBP").toUpperCase(),
    maximumFractionDigits: 0,
  });
}

function ServiceStatus({ label, snapshot, ok, note }) {
  const tone = !snapshot?.configured
    ? "var(--muted)"
    : snapshot?.error
      ? "var(--critical)"
      : ok
        ? "var(--ok)"
        : "var(--warn)";

  const text = !snapshot?.configured
    ? "Not configured"
    : snapshot?.error
      ? snapshot.error
      : note || "Connected";

  return (
    <div className="bar-row" style={{ alignItems: "center" }}>
      <span className="bar-row-label" style={{ minWidth: 90 }}>
        {label}
      </span>
      <span className="mono" style={{ color: tone, fontSize: 13 }}>
        <span className="legend-dot" style={{ background: tone, marginRight: 6 }} />
        {text}
      </span>
    </div>
  );
}

export default function CommandPage() {
  const [range, setRange] = useState("24h");

  const { stats, error: statsError, reload: reloadStats } = useAdminStats(range);
  const {
    traffic,
    error: trafficError,
    busy,
    block,
    unblock,
    reload: reloadTraffic,
  } = useAdminTraffic(range);
  const { ops, error: opsError, reload: reloadOps } = useAdminOps();
  const { services, error: servicesError, reload: reloadServices } = useAdminServices();

  const trafficRows = traffic?.rows || [];
  const blocked = traffic?.blockedIps || [];
  const totals = stats?.totals || {};
  const kpis = ops?.kpis || {};
  const sales = ops?.sales || {};
  const seo = ops?.seo || {};

  const stripe = services?.stripe;
  const clerk = services?.clerk;
  const redis = services?.redis;
  const resend = services?.resend;
  const sentry = services?.sentry;

  // Prefer the live Stripe/Clerk numbers over the mirrored Supabase ones -
  // the subscriptions table never gets an amount field written to it, and
  // Supabase Auth stopped being the identity source once the app moved to
  // Clerk (see lib/customer-auth.js), so its user list is stale.
  const mrr = stripe?.configured && !stripe.error ? stripe.mrr : sales.mrr;
  const mrrCurrency = stripe?.currency || "gbp";
  const mrrIsLive = stripe?.configured && !stripe.error;

  const userCount = clerk?.configured && !clerk.error ? clerk.totalUsers : totals.users;
  const userCountIsLive = clerk?.configured && !clerk.error;

  const blockedSet = useMemo(() => new Set(blocked.map((entry) => entry.ip)), [blocked]);
  const globePoints = useGlobePoints(traffic?.globe);

  const geolocatedEvents = (traffic?.globe || []).reduce(
    (sum, item) => sum + Number(item.count || 0),
    0,
  );

  const error = statsError || trafficError;

  function refresh() {
    reloadStats();
    reloadTraffic();
    reloadOps();
    reloadServices();
  }

  return (
    <>
      <PageHeader
        title="Command"
        description="Live snapshot of traffic, product usage, revenue, and security - sourced directly from Stripe, Clerk, Redis, Resend, and Sentry wherever a live source beats the database mirror."
      >
        <RangeControl range={range} setRange={setRange} />
        <button className="btn small" onClick={refresh} disabled={busy}>
          Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}
      {opsError && <div className="notice error section">{opsError}</div>}
      {servicesError && <div className="notice error section">{servicesError}</div>}

      {/* Live service connectivity - the actual APIs, not their Supabase
          mirrors. Anything showing "Not configured" is missing an env var
          (STRIPE_SECRET_KEY, CLERK_SECRET_KEY, REDIS_URL / UPSTASH_REDIS_REDIS_URL,
          RESEND_API_KEY, SENTRY_AUTH_TOKEN). */}
      <Panel title="Live services" sub="Direct API connections, not Supabase mirrors" className="section">
        <div className="grid-3">
          <ServiceStatus label="Stripe" snapshot={stripe} ok note={stripe?.configured ? `${stripe.totalSubscriptions ?? 0} subscriptions seen` : undefined} />
          <ServiceStatus label="Clerk" snapshot={clerk} ok note={clerk?.configured ? `${clerk.totalUsers ?? 0} users` : undefined} />
          <ServiceStatus label="Redis" snapshot={redis} ok={redis?.connected} note={redis?.connected ? `${redis.latencyMs}ms ping` : redis?.configured ? "Configured, unreachable" : undefined} />
          <ServiceStatus label="Resend" snapshot={resend} ok={resend?.allVerified} note={resend?.configured ? `${resend.domains?.length ?? 0} domain(s)` : undefined} />
          <ServiceStatus label="Sentry" snapshot={sentry} ok={sentry?.configured && !sentry?.unresolvedLast24h} note={sentry?.configured ? `${sentry.unresolvedLast24h ?? 0} unresolved (24h)` : "Add SENTRY_AUTH_TOKEN to enable"} />
          <ServiceStatus label="Supabase" snapshot={{ configured: true }} ok note="Product data (candidates, jobs, agencies)" />
        </div>
      </Panel>

      <div className="kpi-grid">
        <KpiCard label="Requests" value={totals.requests ?? trafficRows.length} />

        <KpiCard
          label="Blocked"
          value={totals.blockedRequests ?? trafficRows.filter((row) => row.blocked).length}
          tone="var(--critical)"
        />

        <KpiCard label="Users" value={userCount ?? "-"} foot={userCountIsLive ? "Live via Clerk" : "Supabase (stale - see note)"} />
        <KpiCard label="Employees" value={totals.employees ?? "-"} tone="var(--ok)" />
      </div>

      <div className="kpi-grid cols-6">
        <KpiCard label="Agencies" value={totals.agencies ?? "-"} />
        <KpiCard label="Candidates" value={totals.candidates ?? "-"} />
        <KpiCard label="Jobs" value={totals.jobs ?? "-"} />
        <KpiCard label="Analyses run" value={totals.analyses ?? "-"} />
        <KpiCard label="Demo requests" value={totals.demoRequests ?? "-"} />
        <KpiCard
          label="Failed logins"
          value={totals.failedAuthAttempts ?? "-"}
          tone={totals.failedAuthAttempts ? "var(--warn)" : undefined}
        />
      </div>

      <div className="grid-3 section">
        <Panel
          title="Revenue & sales"
          sub={mrrIsLive ? "Live from Stripe" : sales.revenueSourceAvailable ? "From active subscription rows" : "No usable revenue source yet"}
          action={
            <Link className="panel-link" href="/admin/billing">
              Billing
            </Link>
          }
        >
          <div className="kpi-grid cols-2" style={{ marginBottom: 10 }}>
            <KpiCard label="MRR" value={formatCurrency(mrr, mrrCurrency)} tone="var(--ok)" />
            <KpiCard label="Active subs" value={stripe?.byStatus?.active ?? sales.activeSubscriptions ?? "-"} />
          </div>
          <StatList
            rows={(stripe?.byPlan || sales.agenciesByPlan || []).map((row) => ({
              label: row.plan,
              value: row.count,
            }))}
          />
        </Panel>

        <Panel
          title="Acquisition"
          sub="Channel mix across demos and tracked traffic"
          action={
            <Link className="panel-link" href="/admin/seo">
              SEO
            </Link>
          }
        >
          <BarList items={(seo.channels || []).map((c) => ({ name: c.channel, count: c.count }))} limit={6} />
        </Panel>

        <Panel
          title="Security posture"
          sub={`${kpis.threats ?? 0} scored threats, ${kpis.auditEvents ?? 0} audit events, ${sentry?.unresolvedLast24h ?? "-"} Sentry issues (24h)`}
          action={
            <Link className="panel-link" href="/admin/security">
              Security
            </Link>
          }
        >
          <div className="notice">
            Raw response bodies are <b>not</b> stored. Request metadata,
            blocking state, and safe analytics stay available for triage
            without retaining CVs, tokens, credentials, or generated
            documents.
          </div>
        </Panel>
      </div>

      <div className="split section">
        <div className="panel globe-panel">
          <div className="globe-overlay">
            <div className="panel-title">Live geo traffic</div>
            <div className="panel-sub">Drag to rotate, scroll to zoom.</div>
            <div className="panel-sub">{geolocatedEvents} geolocated events plotted.</div>
          </div>

          <div className="globe-legend">
            <span className="legend-item">
              <span className="legend-dot legend-ok" /> Traffic
            </span>

            <span className="legend-item">
              <span className="legend-dot legend-critical" /> Hotspot
            </span>
          </div>

          <Globe points={globePoints} />
        </div>

        <div className="panel">
          <div className="section">
            <div className="section-head">
              <div className="panel-title">Blocked IPs</div>
              <Link className="panel-link" href="/admin/security">
                Manage
              </Link>
            </div>

            {blocked.length === 0 ? (
              <div className="empty">
                No blocked IPs - anything blocked from Traffic shows up here.
              </div>
            ) : (
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="table">
                  <tbody>
                    {blocked.slice(0, 6).map((item) => (
                      <tr key={item.ip}>
                        <td className="mono">{item.ip}</td>
                        <td className="muted">{item.reason || "Admin block"}</td>
                        <td>
                          <button className="btn small" onClick={() => unblock(item.ip)}>
                            Unblock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="section">
            <div className="section-head">
              <div className="panel-title">Jump to a section</div>
            </div>
            <div className="bar-list">
              {[
                ["/admin/traffic", "Traffic log"],
                ["/admin/pentester", "Pentester"],
                ["/admin/security/investigate", "Investigate"],
                ["/admin/users", "Users"],
                ["/admin/employees", "Employees"],
                ["/admin/billing", "Billing"],
              ].map(([href, label]) => (
                <Link key={href} className="panel-link" href={href} style={{ display: "block", padding: "6px 0" }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-3 section">
        <Panel title="Top paths">
          <BarList items={stats?.traffic?.topPaths || []} limit={6} />
        </Panel>

        <Panel title="Top countries">
          <BarList items={stats?.traffic?.countries || []} limit={6} />
        </Panel>

        <Panel title="Referrers">
          <BarList items={stats?.traffic?.referrers || []} limit={6} />
        </Panel>
      </div>

      <section className="section">
        <div className="section-head">
          <div className="panel-title">Recent requests</div>
          <Link className="btn small" href="/admin/traffic">
            View traffic log
          </Link>
        </div>

        <RequestTable rows={trafficRows.slice(0, 20)} blockedSet={blockedSet} onBlock={block} />
      </section>
    </>
  );
}
