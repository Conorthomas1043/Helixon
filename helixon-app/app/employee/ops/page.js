"use client";
import { useEffect, useState } from "react";

export default function EmployeeOpsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = window.__HELIXON_ACCESS_TOKEN__ || localStorage.getItem("helixon_access_token");
    if (!token) { setError("Connect this page to the existing employee Supabase session before using live operations data."); return; }
    fetch("/api/employee/ops", { headers: { Authorization: `Bearer ${token}` } }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Request failed"); return b; }).then(setData).catch(e => setError(e.message));
  }, []);

  if (error) return <main style={{ padding: 24 }}><h1>Employee Operations</h1><p>{error}</p></main>;
  if (!data) return <main style={{ padding: 24 }}><h1>Employee Operations</h1><p>Loading…</p></main>;

  return <main style={{ padding: 24 }}><h1>Employee Operations</h1><p>Live company, sales and acquisition data for {data.employee.email}.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>{Object.entries(data.kpis).map(([k,v]) => <div key={k} style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}><div>{k}</div><strong style={{ fontSize: 28 }}>{v}</strong></div>)}</div><h2>Sales</h2><pre>{JSON.stringify(data.sales, null, 2)}</pre><h2>SEO</h2><pre>{JSON.stringify(data.seo, null, 2)}</pre></main>;
}
