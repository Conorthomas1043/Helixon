"use client";

import { useEffect, useState } from "react";

export default function SeoPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/admin/ops").then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error || "Request failed"); return b; }).then(setData).catch(e => setError(e.message)); }, []);
  if (error) return <main style={{ padding: 24 }}><h1>SEO / Acquisition</h1><p>{error}</p></main>;
  if (!data) return <main style={{ padding: 24 }}><h1>SEO / Acquisition</h1><p>Loading…</p></main>;
  return <main style={{ padding: 24 }}><h1>SEO / Acquisition</h1><p>Derived from UTM, referrer and request telemetry; no synthetic traffic.</p><h2>Channels</h2><pre>{JSON.stringify(data.seo.channels, null, 2)}</pre><h2>Campaigns</h2><pre>{JSON.stringify(data.seo.campaigns, null, 2)}</pre><h2>Top referrers</h2><pre>{JSON.stringify(data.seo.referrers, null, 2)}</pre><h2>Top paths</h2><pre>{JSON.stringify(data.seo.topPaths, null, 2)}</pre><h2>Top countries</h2><pre>{JSON.stringify(data.seo.topCountries, null, 2)}</pre></main>;
}
