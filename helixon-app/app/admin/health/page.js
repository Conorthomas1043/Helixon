"use client";

import { useMemo } from "react";
import { PageHeader, Panel, ServiceStatus } from "../_shared/ui";
import { useAdminHealth } from "../_shared/hooks";

// Every check this page can report on, and how to grade it "critical" vs
// "degraded" for the overall banner - core infrastructure and the AI
// providers the product runs on are critical; third-party business
// services and individual page checks are degraded (real problems, but the
// site as a whole still functions without them).
function overallStatus(health, pages) {
  if (!health) return { tone: "var(--muted)", label: "Loading…" };

  const critical = [health.database, health.aiProviders?.anthropic, health.aiProviders?.gemini];
  const criticalDown = critical.some((s) => s?.configured && (s.error || s.connected === false));

  const degradedServices = [health.stripe, health.clerk, health.redis, health.resend, health.sentry];
  const degraded = degradedServices.some((s) => s?.configured && s.error);
  const pagesFailing = (pages?.failing || 0) > 0;

  if (criticalDown) {
    return { tone: "var(--critical)", label: "Critical - core dependency down" };
  }
  if (degraded || pagesFailing) {
    return { tone: "var(--warn)", label: "Degraded - see details below" };
  }
  return { tone: "var(--ok)", label: "All systems operational" };
}

function PageCheckRow({ page }) {
  const tone = page.ok ? "var(--ok)" : "var(--critical)";
  return (
    <tr>
      <td className="mono">{page.path}</td>
      <td>
        <span className="mono" style={{ color: tone }}>
          <span className="legend-dot" style={{ background: tone, marginRight: 6 }} />
          {page.status ?? "—"}
        </span>
      </td>
      <td className="muted">{page.latencyMs != null ? `${page.latencyMs}ms` : page.error || "—"}</td>
    </tr>
  );
}

export default function HealthPage() {
  const { health, error, loading, reload } = useAdminHealth();

  const pages = health?.pages;
  const sortedPages = useMemo(() => {
    const rows = pages?.pages || [];
    // Failures first, so a broken page can't hide at the bottom of the list.
    return [...rows].sort((a, b) => Number(a.ok) - Number(b.ok));
  }, [pages]);

  const status = overallStatus(health, pages);
  const ai = health?.aiProviders;
  const database = health?.database;

  return (
    <>
      <PageHeader
        title="System health"
        description="Everything the site depends on, checked live: the database, the AI providers the product runs on, Stripe/Clerk/Redis/Resend/Sentry, and a curated set of public pages."
      >
        <button className="btn small" onClick={reload} disabled={loading}>
          Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error section">{error}</div>}

      <Panel className="section">
        <div className="bar-row" style={{ alignItems: "center" }}>
          <span
            className="legend-dot"
            style={{ background: status.tone, width: 10, height: 10, marginRight: 10 }}
          />
          <span style={{ fontSize: 15, fontWeight: 600, color: status.tone }}>{status.label}</span>
        </div>
      </Panel>

      <div className="grid-3 section">
        <Panel title="Core infrastructure" sub="If either of these is down, nothing else works">
          <div className="bar-list">
            <ServiceStatus
              label="Database"
              snapshot={database}
              ok={database?.connected}
              note={database?.connected ? `${database.latencyMs}ms query` : database?.configured ? "Configured, unreachable" : undefined}
            />
            <ServiceStatus
              label="Redis"
              snapshot={health?.redis}
              ok={health?.redis?.connected}
              note={
                health?.redis?.connected
                  ? `${health.redis.latencyMs}ms ping`
                  : health?.redis?.configured
                    ? "Configured, unreachable - rate limiting fails open"
                    : "Not configured - rate limiting fails open"
              }
            />
          </div>
        </Panel>

        <Panel title="AI providers" sub="What the CV-analysis pipeline and chat assistant run on">
          <div className="bar-list">
            <ServiceStatus
              label="Anthropic"
              snapshot={ai?.anthropic}
              ok={ai?.anthropic?.connected}
              note={
                ai?.anthropic?.connected
                  ? `${ai.anthropic.latencyMs}ms · CV analysis pipeline`
                  : ai?.anthropic?.configured
                    ? "Configured, unreachable"
                    : undefined
              }
            />
            <ServiceStatus
              label="Gemini"
              snapshot={ai?.gemini}
              ok={ai?.gemini?.connected}
              note={
                ai?.gemini?.connected
                  ? `${ai.gemini.latencyMs}ms · chat assistant`
                  : ai?.gemini?.configured
                    ? "Configured, unreachable"
                    : undefined
              }
            />
            <ServiceStatus
              label="Voyage"
              snapshot={ai?.voyage}
              ok={ai?.voyage?.configured}
              note={ai?.voyage?.configured ? "Configured · skill-embedding matching (not live-checked, avoids a billable call)" : undefined}
            />
          </div>
        </Panel>

        <Panel title="Business services" sub="Payments, identity, email, error tracking">
          <div className="bar-list">
            <ServiceStatus label="Stripe" snapshot={health?.stripe} ok note={health?.stripe?.configured ? `${health.stripe.totalSubscriptions ?? 0} subscriptions seen` : undefined} />
            <ServiceStatus label="Clerk" snapshot={health?.clerk} ok note={health?.clerk?.configured ? `${health.clerk.totalUsers ?? 0} users` : undefined} />
            <ServiceStatus label="Resend" snapshot={health?.resend} ok={health?.resend?.allVerified} note={health?.resend?.configured ? `${health.resend.domains?.length ?? 0} domain(s)` : undefined} />
            <ServiceStatus
              label="Sentry"
              snapshot={health?.sentry}
              ok={health?.sentry?.configured && !health?.sentry?.unresolvedLast24h}
              note={health?.sentry?.configured ? `${health.sentry.unresolvedLast24h ?? 0} unresolved (24h)` : "Add SENTRY_AUTH_TOKEN to enable"}
            />
          </div>
        </Panel>
      </div>

      {health?.sentry?.topIssues?.length > 0 && (
        <Panel title="Top unresolved Sentry issues (24h)" className="section">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Level</th>
                  <th>Events</th>
                </tr>
              </thead>
              <tbody>
                {health.sentry.topIssues.map((issue, i) => (
                  <tr key={i}>
                    <td>{issue.title}</td>
                    <td className="muted">{issue.level}</td>
                    <td className="mono">{issue.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel
        title="Public page checks"
        sub={pages ? `${pages.pages.length} pages checked against ${pages.origin} · ${pages.failing} failing` : undefined}
        className="section"
      >
        {!pages ? (
          <div className="empty">Loading…</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {sortedPages.map((page) => (
                  <PageCheckRow key={page.path} page={page} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
