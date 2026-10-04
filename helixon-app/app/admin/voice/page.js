"use client";
// /admin/voice - what customers are telling Helixon (GET /api/admin/voice).
// The point is to be read by a person each week, so it leads with counts
// and keeps the actual words one click away (docs/ux-research-audit.md, R8).

import { useState } from "react";
import { PageHeader, KpiCard, Panel, BarList, EmptyState } from "../_shared/ui";
import { useAdminData, formatDateTime, formatNumber } from "../_shared/data";
import { Icon } from "../_shared/icons";

const RANGES = [
  ["30d", "30 days"],
  ["90d", "90 days"],
  ["365d", "12 months"],
];

const TOPIC_LABELS = {
  price: "Price & plans",
  trial: "Trial & demo",
  data_privacy: "Data & privacy",
  scoring: "How scoring works",
  team: "Teams & seats",
  integrations: "Integrations",
  file_types: "Files & upload",
  cancel: "Contract & cancelling",
  other: "Other",
};

const CANCEL_LABELS = {
  price: "Costs too much",
  not_using: "Not using it enough",
  missing_feature: "Missing something",
  scoring: "Scores don't match judgement",
  switching: "Moving to another tool",
  temporary: "Pausing hiring",
  other: "Something else",
};

function Quotes({ rows, empty, meta }) {
  if (!rows?.length) return <div className="empty">{empty}</div>;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
      {rows.map((r, i) => (
        <li key={i} style={{ borderLeft: "2px solid var(--border-strong, rgba(127,127,127,0.3))", paddingLeft: 10 }}>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>&ldquo;{r.body || r.comment || r.message}&rdquo;</div>
          <div style={{ fontSize: 12.5, opacity: 0.65, marginTop: 2 }}>
            {[meta ? meta(r) : null, r.agency || r.company, formatDateTime(r.created_at)].filter(Boolean).join(" · ")}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function VoiceOfCustomerPage() {
  const [range, setRange] = useState("90d");
  const { data, error, loading, reload } = useAdminData(`/api/admin/voice?range=${range}`);
  const s = data?.scores;
  const agreement = s?.total ? Math.round((s.up / s.total) * 100) : null;

  return (
    <>
      <PageHeader title="Voice of customer" description="Score disagreements, survey answers, cancellation reasons, visitor questions and what demo leads want to solve.">
        <div className="segmented" role="group" aria-label="Range">
          {RANGES.map(([value, label]) => (
            <button key={value} className={range === value ? "active" : ""} aria-pressed={range === value} onClick={() => setRange(value)}>
              {label}
            </button>
          ))}
        </div>
        <button className="btn small" onClick={reload} disabled={loading}>
          <Icon name="refresh" /> Refresh
        </button>
      </PageHeader>

      {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}
      {data && !data.signalsAvailable && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          Survey answers, cancellation reasons, visitor questions and research opt-ins need the <code>20261004090000_research_signals</code> migration. Score feedback and demo requests are shown below.
        </div>
      )}

      <div className="kpi-grid cols-4">
        <KpiCard label="Scores agreed with" value={agreement == null ? "-" : `${agreement}%`} icon="check" foot={s ? `${formatNumber(s.total)} ratings` : ""} />
        <KpiCard label="UMUX-Lite" value={data?.pulse?.umuxLite == null ? "-" : data.pulse.umuxLite} icon="trending" foot={data ? `${formatNumber(data.pulse.responses)} responses · 0-100, higher is better` : ""} />
        <KpiCard label="Cancellation reasons" value={data ? formatNumber(data.cancellations.reasons.reduce((n, r) => n + r.count, 0)) : "-"} icon="alert" />
        <KpiCard label="Research opt-ins" value={data ? formatNumber(data.optIns.length) : "-"} icon="users" foot="People happy to be invited" />
      </div>

      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16 }}>
          <Panel title="Why recruiters disagree with a score" sub="Thumbs-down reasons">
            <BarList items={s.reasons} emptyLabel="No disagreements in this period." />
          </Panel>
          <Panel title="In their words" sub="Written disagreement comments">
            <Quotes rows={s.recent} empty="No written comments." />
          </Panel>
          <Panel title="What visitors ask before buying" sub="Chat assistant questions, by topic (consented visitors only)">
            <BarList items={data.questions.topics.map((t) => ({ ...t, label: TOPIC_LABELS[t.name] || t.name }))} emptyLabel="No questions recorded." />
          </Panel>
          <Panel title="Recent questions" sub="Contact details removed">
            <Quotes rows={data.questions.recent} empty="No questions recorded." meta={(r) => TOPIC_LABELS[r.label] || r.label} />
          </Panel>
          <Panel title="Why agencies cancel">
            <BarList items={data.cancellations.reasons.map((t) => ({ ...t, label: CANCEL_LABELS[t.name] || t.name }))} emptyLabel="No cancellations in this period." />
            <div style={{ marginTop: 12 }}>
              <Quotes rows={data.cancellations.recent} empty="" meta={(r) => CANCEL_LABELS[r.label] || r.label} />
            </div>
          </Panel>
          <Panel title="The one thing to improve" sub="Pulse survey comments">
            <Quotes rows={data.pulse.comments} empty="No survey comments yet." meta={(r) => (r.meta?.umuxLite != null ? `UMUX-Lite ${r.meta.umuxLite}` : null)} />
          </Panel>
          <Panel title="What demo leads want to solve">
            <Quotes rows={data.demoProblems} empty="No demo messages in this period." />
          </Panel>
          <Panel title="Happy to take part in research" sub="Recruit interview and usability participants from here">
            {data.optIns.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6, fontSize: 14 }}>
                {data.optIns.map((o, i) => (
                  <li key={i}>
                    <b>{o.person}</b>
                    {o.agency ? ` · ${o.agency}` : ""} <span style={{ opacity: 0.6 }}>· via {o.source} · {formatDateTime(o.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="users" title="Nobody yet">People can opt in from Settings, the demo form or when cancelling.</EmptyState>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
