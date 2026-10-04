"use client";

import { useMemo, useState } from "react";
import { PageHeader, Panel, ServiceStatus, Switch } from "../_shared/ui";
import { useAdminHealth } from "../_shared/hooks";
import { formatDateTime, timeAgo, useAdminData } from "../_shared/data";
import { csrfHeaders } from "../_shared/csrf";
import { toast } from "../_shared/toast";
import { HEALTH_CHECKS, OVERALL_LABEL, gradeHealth } from "@/lib/ops/health-grade";

const TONE = { ok: "var(--ok)", degraded: "var(--warn)", critical: "var(--critical)" };

// The overall status comes graded from the API (lib/ops/health-grade.js,
// which also honours muted checks); graded here only as a fallback.
function overallStatus(health) {
  if (!health) return { tone: "var(--muted)", label: "Loading…", grade: null };
  const grade = health.grade || gradeHealth(health, health.muted);
  return { tone: TONE[grade.overall], label: OVERALL_LABEL[grade.overall], grade };
}

// One tick per recorded run, oldest on the left.
function HistoryStrip({ history }) {
  const runs = [...(history || [])].reverse();
  if (!runs.length) return <div className="faint" style={{ fontSize: 13.5 }}>No runs recorded yet.</div>;
  const incidents = (history || []).filter((h) => h.overall !== "ok").slice(0, 6);
  return (
    <>
      <div className="health-strip" role="img" aria-label={`Last ${runs.length} checks: ${incidents.length ? `${incidents.length} with problems` : "all healthy"}`}>
        {runs.map((h) => (
          <span
            key={h.id}
            className={`health-tick ${h.overall}`}
            title={`${formatDateTime(h.created_at)} - ${OVERALL_LABEL[h.overall] || h.overall}${h.failing?.length ? ` (${h.failing.join(", ")})` : ""}`}
          />
        ))}
      </div>
      <div className="faint" style={{ fontSize: 13, marginTop: 6 }}>
        {runs.length} runs since {formatDateTime(runs[0].created_at)}. Recorded when an admin opens this page (or the mobile console), at most every 5 minutes unless something changes.
      </div>
      {incidents.length > 0 && (
        <div className="mini-list" style={{ marginTop: 10 }}>
          {incidents.map((h) => (
            <div className="mini-row" key={h.id}>
              <span style={{ minWidth: 0 }}>
                <span className={`pill ${h.overall === "critical" ? "bad" : "warn"}`} style={{ marginRight: 8 }}>{h.overall}</span>
                {(h.failing || []).map((k) => HEALTH_CHECKS.find((c) => c.key === k)?.label || k).join(", ") || "-"}
              </span>
              <span className="faint" style={{ fontSize: 13 }}>{timeAgo(h.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// Which checks count toward the overall status. Muting keeps a check on
// the page but stops it turning the banner amber/red.
function MutePanel({ health, onSaved }) {
  const [saving, setSaving] = useState(false);
  const muted = new Set(health?.muted || []);

  async function toggle(key, counts) {
    const next = new Set(muted);
    if (counts) next.delete(key);
    else next.add(key);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/health", {
        method: "PATCH",
        headers: csrfHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ muted: [...next] }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Couldn't save that.");
      toast.success(counts ? "Check counts toward the status again" : "Check muted");
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="What counts toward the status" sub="Switch a check off to keep it visible without it turning the status amber or red - for a provider you've stopped using, say.">
      <div className="switch-list">
        {HEALTH_CHECKS.map((c) => (
          <Switch
            key={c.key}
            id={`health-${c.key}`}
            label={`${c.label}${c.critical ? " (critical)" : ""}`}
            description={health?.grade?.mutedFailing?.includes(c.key) ? "Muted - and currently failing." : muted.has(c.key) ? "Muted." : undefined}
            checked={!muted.has(c.key)}
            disabled={!health || saving}
            onChange={(on) => toggle(c.key, on)}
          />
        ))}
      </div>
    </Panel>
  );
}

const ROLE_LABEL = { professional: "Professional roles", executive: "Executive roles", frontline: "Frontline roles" };

// Scoring calibration: labels from recruiters' feedback bands and pipeline
// outcomes, checked against the score weights (see /api/admin/scoring).
function ScoringPanel() {
  const { data, error } = useAdminData("/api/admin/scoring");
  const t = data?.totals;
  return (
    <Panel
      title="Scoring calibration"
      sub="How the CV score weights hold up against recruiters' own calls - the band they pick after a thumbs down, and candidates who reached interview or were rejected for a skills gap."
      className="section"
    >
      {error ? (
        <div className="notice error" style={{ marginTop: 12 }}>{error}</div>
      ) : !data ? (
        <div className="skeleton" style={{ height: 120, marginTop: 12 }} />
      ) : (
        <>
          <div className="stat-list" style={{ marginTop: 10 }}>
            <div className="stat-list-row"><span className="muted">Analyses</span><b>{t.scores.toLocaleString()}</b></div>
            <div className="stat-list-row"><span className="muted">Labelled by recruiters or outcomes</span><b>{t.labelled.toLocaleString()} of {data.minLabels} needed per role type</b></div>
            <div className="stat-list-row"><span className="muted">Scored with the current rules (v{data.rubricVersion})</span><b>{t.currentRubric.toLocaleString()}</b></div>
            <div className="stat-list-row">
              <span className="muted">Run-to-run spread of the AI judgement</span>
              <b>{data.variance.meanJudgementSpread === null ? "Not measured - needs CV_FIT_JUDGE_SAMPLES above 1, or npm run eval:cv -- --repeat 3" : `${data.variance.meanJudgementSpread} points (${data.variance.samples} analyses)`}</b>
            </div>
          </div>
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table compact">
              <thead>
                <tr><th>Role type</th><th className="num">Labels</th><th>Ranking quality (AUC)</th><th>Suggested weights</th></tr>
              </thead>
              <tbody>
                {data.roles.map((r) => (
                  <tr key={r.roleType}>
                    <td>{ROLE_LABEL[r.roleType] || r.roleType}</td>
                    <td className="num">{r.labels} <span className="faint">({r.positives} / {r.negatives})</span></td>
                    <td>{r.currentAuc === null ? <span className="faint">-</span> : `now ${r.currentAuc.toFixed(2)}${r.fittedAuc !== null ? ` · fitted ${r.fittedAuc.toFixed(2)}` : ""}`}</td>
                    <td>
                      {r.ready ? (
                        <span className="mono" style={{ fontSize: 13 }}>{Object.entries(r.suggested).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>
                      ) : (
                        <span className="faint" style={{ fontSize: 13 }}>{r.reason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footer-note">Suggestions never apply themselves. Copy ready weights into lib/cv-analysis/config.js, raise the rubric version, and check with npm run eval:labelled.</p>
        </>
      )}
    </Panel>
  );
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

  const status = overallStatus(health);
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="legend-dot" style={{ background: status.tone, width: 10, height: 10 }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: status.tone }}>{status.label}</span>
          {status.grade?.failing?.length > 0 && (
            <span className="muted">
              {status.grade.failing.map((k) => HEALTH_CHECKS.find((c) => c.key === k)?.label || k).join(", ")}
            </span>
          )}
          {status.grade?.mutedFailing?.length > 0 && (
            <span className="faint" style={{ fontSize: 13.5 }}>
              Muted but failing: {status.grade.mutedFailing.map((k) => HEALTH_CHECKS.find((c) => c.key === k)?.label || k).join(", ")}
            </span>
          )}
        </div>
      </Panel>

      <div className="split section">
        <Panel title="History" sub="The overall status each time the checks ran.">
          {health?.history === null ? (
            <div className="faint" style={{ fontSize: 13.5 }}>History needs the latest database migration (admin_granular_controls).</div>
          ) : (
            <HistoryStrip history={health?.history} />
          )}
        </Panel>
        <MutePanel health={health} onSaved={reload} />
      </div>

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

      <ScoringPanel />

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
