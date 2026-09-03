"use client";

import { useEffect, useState } from "react";

export default function SalesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/admin/ops").then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Request failed"); return b; }).then(setData).catch(e => setError(e.message)); }, []);
  if (error) return <main style={{ padding: 24 }}><h1>Sales</h1><p>{error}</p></main>;
  if (!data) return <main style={{ padding: 24 }}><h1>Sales</h1><p>Loading…</p></main>;
  return <main style={{ padding: 24 }}><h1>Sales / Commercial</h1><p>Revenue is shown only where real subscription rows provide a usable amount.</p><pre>{JSON.stringify(data.sales, null, 2)}</pre></main>;
}
