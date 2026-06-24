"use client";

import { useState, useEffect } from "react";

const AGENCY_ID = "YOUR-SEED-AGENCY-ID"; // replace with real auth later

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  // Reload data whenever the period selector changes
  useEffect(() => {
    load();
  }, [days]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/analytics?agencyId=${AGENCY_ID}&days=${days}`);
    const json = await res.json();
    if (json.ok) setData(json.analytics);
    setLoading(false);
  }

  // Export the time series data as a CSV file
  function exportCSV() {
    if (!data?.time_series) return;
    const rows = [
      "Date,Analyses,Avg Score",
      ...data.time_series.map((r) => `${r.date},${r.count},${r.avg}`),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    a.download = `helixon-${days}days.csv`;
    a.click();
  }

  // Build the array of metric cards from the API response
  const metrics = data
    ? [
        { label: "Analyses (period)", value: data.totals.period },
        { label: "All time analyses", value: data.totals.all_time },
        { label: "Candidates", value: data.totals.candidates },
        {
          label: "Accuracy rate",
          value: data.accuracy.rate !== null ? `${data.accuracy.rate}%` : "No feedback",
        },
        { label: "Strong matches", value: data.recommendations["Strong match"] },
        { label: "Worth reviewing", value: data.recommendations["Worth reviewing"] },
        { label: "Summaries", value: data.totals.summaries },
        { label: "Emails drafted", value: data.totals.emails },
      ]
    : [];

  return (
    <main className="min-h-screen bg-stone-50">
      {/* Nav */}
      <nav className="bg-white border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <a href="/" className="font-bold text-stone-900">Helixon</a>
        <a href="/" className="text-sm text-stone-500 hover:text-stone-800">
          Back to scoring
        </a>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header row with period selector and export */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-stone-900">Dashboard</h1>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="text-sm border border-stone-300 rounded-lg px-3 py-2"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button
              onClick={exportCSV}
              className="text-sm border border-stone-300 text-stone-600 px-3 py-2 rounded-lg hover:bg-stone-50"
            >
              Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-stone-400">Loading...</p>
        ) : data && (
          <>
            {/* ── Metric cards (2x4 grid) ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {metrics.map(({ label, value }) => (
                <div key={label} className="bg-white rounded-xl border border-stone-200 p-5">
                  <div className="text-2xl font-bold text-stone-900">{value ?? 0}</div>
                  <div className="text-xs text-stone-400 mt-1">{label}</div>
                </div>
              ))}
            </div>

            {/* ── Bar chart — analyses over time ── */}
            {data.time_series.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
                <h2 className="font-semibold text-stone-800 mb-4">Analyses over time</h2>
                {/* Bars are proportional to the highest day's count */}
                <div className="flex items-end gap-1 h-28">
                  {data.time_series.map((day, i) => {
                    const max = Math.max(...data.time_series.map((d) => d.count), 1);
                    const heightPct = Math.max((day.count / max) * 100, 2);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div
                          className="w-full bg-emerald-500 rounded-sm"
                          style={{ height: `${heightPct}%` }}
                          title={`${day.date}: ${day.count} analyses`}
                        />
                      </div>
                    );
                  })}
                </div>
                {/* Date labels at each end */}
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-stone-400">
                    {data.time_series[0]?.date}
                  </span>
                  <span className="text-xs text-stone-400">
                    {data.time_series[data.time_series.length - 1]?.date}
                  </span>
                </div>
              </div>
            )}

            {/* ── Top roles table ── */}
            {data.top_roles.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 p-6">
                <h2 className="font-semibold text-stone-800 mb-4">Most screened roles</h2>
                <div className="space-y-3">
                  {data.top_roles.map((role, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-stone-400 w-5">{i + 1}</span>
                        <span className="text-sm font-medium text-stone-800">
                          {role.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-stone-400">{role.count} CVs</span>
                        <span
                          className={`text-sm font-semibold ${
                            role.avg >= 70
                              ? "text-emerald-700"
                              : role.avg >= 50
                              ? "text-amber-600"
                              : "text-red-600"
                          }`}
                        >
                          avg {role.avg}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}