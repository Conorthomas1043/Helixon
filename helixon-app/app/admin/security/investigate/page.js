"use client";

import { useEffect, useState } from "react";

export default function SecurityInvestigatePage() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/admin/ops").then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Request failed"); return b; }).then(setData).catch(e => setError(e.message)); }, []);
  if (error) return <main style={{ padding: 24 }}><h1>Security Investigation</h1><p>{error}</p></main>;
  if (!data) return <main style={{ padding: 24 }}><h1>Security Investigation</h1><p>Loading…</p></main>;
  const q = query.trim().toLowerCase();
  const rows = (data.requests || []).filter(x => !q || `${x.ip} ${x.path} ${x.user_agent} ${x.country}`.toLowerCase().includes(q)).slice(0, 200);
  return <main style={{ padding: 24 }}><h1>Security Investigation</h1><input value={query} onChange={e => setQuery(e.target.value)} placeholder="IP, path, country or user-agent" style={{ width: "100%", maxWidth: 620, padding: 10 }} /><div style={{ overflowX: "auto", marginTop: 18 }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{["Time","IP","Country","Method","Path","UA","Risk","Signals","Blocked"].map(h=><th key={h} style={{ textAlign: "left", padding: 8 }}>{h}</th>)}</tr></thead><tbody>{rows.map((x,i)=><tr key={i}>{[x.created_at,x.ip,x.country,x.method,x.path,x.user_agent,x.threat.score,x.threat.signals.join(", "),x.blocked ? "yes":"no"].map((v,j)=><td key={j} style={{ padding: 8 }}>{String(v ?? "—")}</td>)}</tr>)}</tbody></table></div></main>;
}
