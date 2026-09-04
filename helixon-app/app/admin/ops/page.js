"use client";

import { useEffect, useState } from "react";

function Section({ title, children }) {
  return <section style={{ marginTop: 24, padding: 18, border: "1px solid rgba(255,255,255,.08)", borderRadius: 14, background: "rgba(20,27,36,.72)" }}><h2 style={{ marginTop: 0 }}>{title}</h2>{children}</section>;
}

function Table({ headers, rows }) {
  return <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{headers.map((h) => <th key={h} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid rgba(255,255,255,.08)" }}>{h}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,.05)" }}>{String(v ?? "-")}</td>)}</tr>)}</tbody></table></div>;
}

export default function OpsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/ops")
      .then(async (r) => { const body = await r.json(); if (!r.ok) throw new Error(body.error || "Request failed"); return body; })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <main style={{ padding: 24 }}><h1>Operations</h1><p>{error}</p></main>;
  if (!data) return <main style={{ padding: 24 }}><h1>Operations</h1><p>Loading live operational data…</p></main>;

  const kpis = Object.entries(data.kpis || {});
  return <main style={{ padding: 24, color: "#e4e9ee", background: "#0b0f14", minHeight: "100vh" }}>
    <h1>Helixon Operations</h1>
    <p style={{ color: "#91a0ad" }}>Deep security, SOC, SEO and commercial telemetry from real application data.</p>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
      {kpis.map(([key, value]) => <div key={key} style={{ padding: 14, border: "1px solid rgba(255,255,255,.08)", borderRadius: 12 }}><div style={{ color: "#91a0ad", fontSize: 12 }}>{key}</div><strong style={{ fontSize: 24 }}>{value}</strong></div>)}
    </div>
    <Section title="SOC - IP investigations"><Table headers={["IP","Max risk","Requests","Blocked","Countries","Signals"]} rows={(data.ipInvestigations || []).slice(0,50).map((x) => [x.ip,x.maxScore,x.requests,x.blocked,x.countries.join(", "),x.signals.join(", ")])} /></Section>
    <Section title="SEO / acquisition"><Table headers={["Channel","Hits"]} rows={(data.seo.channels || []).map((x) => [x.channel,x.count])} /><h3>Campaigns</h3><Table headers={["Campaign","Count"]} rows={(data.seo.campaigns || []).map((x) => [x.campaign,x.count])} /><h3>Top referrers</h3><Table headers={["Referrer","Count"]} rows={(data.seo.referrers || []).map((x) => [x.referrer,x.count])} /></Section>
    <Section title="Sales / commercial"><Table headers={["Metric","Value"]} rows={[["Leads",data.sales.leads],["Trials",data.sales.trials],["Active subscriptions",data.sales.activeSubscriptions],["MRR",data.sales.revenueSourceAvailable ? data.sales.mrr : "Not available from current subscription rows"]]} /><h3>Agencies by plan</h3><Table headers={["Plan","Count"]} rows={(data.sales.agenciesByPlan || []).map((x) => [x.plan,x.count])} /></Section>
    <Section title="Threat events"><Table headers={["Time","IP","Method","Path","Risk","Signals","Blocked"]} rows={(data.threats || []).slice(0,100).map((x) => [x.created_at,x.ip,x.method,x.path,x.threat.score,x.threat.signals.join(", "),x.blocked ? "yes" : "no"])} /></Section>
    <Section title="Admin audit feed"><Table headers={["Time","Action","Actor","Target"]} rows={(data.audit || []).slice(0,100).map((x) => [x.created_at,x.action || x.event || x.type,x.user_email || x.email || x.user_id,x.target_id || x.resource_id || "-"])} /></Section>
  </main>;
}
