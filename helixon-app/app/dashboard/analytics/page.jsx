"use client";
import { useMemo, useState } from "react";
import DashboardNav from "@/components/DashboardNav";
import { useDashboardData } from "@/lib/DashboardDataContext";
import { downloadCsv } from "@/lib/csv";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";

const COLORS = { forest: "#0b6e4f", mint: "#bfe3d0", amber: "#c9922e", red: "#c0392b", faint: "#8aaa9a" };

function Panel({ title, sub, children, empty }) {
  return (
    <div className="rounded-[16px] p-5 mb-6" style={{ background: "white", border: "1px solid var(--border)" }}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ color: "#13201b" }}>{title}</h3>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: "#5a7a6a" }}>{sub}</p>}
      </div>
      {empty ? (
        <div className="rounded-[10px] py-10 text-center" style={{ background: "var(--mist)" }}>
          <p className="text-[11px]" style={{ color: "#8aaa9a" }}>No data for this range/filter.</p>
        </div>
      ) : children}
    </div>
  );
}

function weekKey(dateIso) {
  const d = new Date(dateIso);
  const day = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const { data, error } = useDashboardData();
  const [range, setRange] = useState("90");

  const scoped = useMemo(() => {
    if (!data) return [];
    const cutoff = Date.now() - Number(range) * 86400000;
    return data.recentAnalyses.filter((a) => new Date(a.createdAt).getTime() >= cutoff);
  }, [data, range]);

  const scoreOverTime = useMemo(() => {
    const buckets = {};
    scoped.forEach((a) => {
      if (a.score === null) return;
      const wk = weekKey(a.createdAt);
      if (!buckets[wk]) buckets[wk] = { week: wk, sum: 0, count: 0 };
      buckets[wk].sum += a.score;
      buckets[wk].count += 1;
    });
    return Object.values(buckets)
      .sort((a, b) => a.week.localeCompare(b.week))
      .map((b) => ({ week: b.week.slice(5), avgScore: Math.round(b.sum / b.count), volume: b.count }));
  }, [scoped]);

  const scoreDistribution = useMemo(() => {
    const bands = [
      { label: "0–19", min: 0, max: 19 }, { label: "20–39", min: 20, max: 39 },
      { label: "40–59", min: 40, max: 59 }, { label: "60–79", min: 60, max: 79 },
      { label: "80–100", min: 80, max: 100 },
    ];
    return bands.map((b) => ({
      band: b.label,
      count: scoped.filter((a) => a.score !== null && a.score >= b.min && a.score <= b.max).length,
    }));
  }, [scoped]);

  const skillsDemand = useMemo(() => {
    const counts = {};
    scoped.forEach((a) => a.candidate.skills.forEach((s) => { counts[s] = (counts[s] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([skill, count]) => ({ skill, count }));
  }, [scoped]);

  const volumeByStage = useMemo(() => {
    const counts = {};
    scoped.forEach((a) => { counts[a.stage] = (counts[a.stage] || 0) + 1; });
    return counts;
  }, [scoped]);

  const recruiterStats = useMemo(() => {
    if (!data) return [];
    return data.recruiters.map((r) => {
      const items = scoped.filter((a) => a.recruiterId === r.id);
      const completed = items.filter((a) => a.status === "completed");
      const placed = items.filter((a) => a.stage === "placed");
      const rejected = items.filter((a) => a.stage === "rejected");
      const avgScore = completed.length ? Math.round(completed.reduce((s, a) => s + a.score, 0) / completed.length) : 0;
      const placementTimes = placed.map((a) => a.daysToPlacement).filter(Boolean);
      const avgTimeToPlacement = placementTimes.length ? Math.round(placementTimes.reduce((s, v) => s + v, 0) / placementTimes.length) : null;
      const conversionRate = items.length ? Math.round((placed.length / items.length) * 100) : 0;
      return { ...r, total: items.length, placed: placed.length, rejected: rejected.length, avgScore, avgTimeToPlacement, conversionRate };
    }).sort((a, b) => b.placed - a.placed);
  }, [data, scoped]);

  const funnelStages = ["new", "screened", "shortlisted", "submitted_to_client", "interviewing", "offer", "placed"];
  const funnelData = funnelStages.map((s) => ({ stage: s, count: scoped.filter((a) => funnelStages.indexOf(a.stage) >= funnelStages.indexOf(s)).length }));

  function exportScorecardCsv() {
    downloadCsv("recruiter-scorecard.csv", recruiterStats.map((r) => ({
      recruiter: r.name, total: r.total, placed: r.placed, rejected: r.rejected,
      conversionRate: `${r.conversionRate}%`, avgScore: r.avgScore, avgDaysToPlacement: r.avgTimeToPlacement ?? "",
    })));
  }

  if (error) {
    return (
      <main className="min-h-screen" style={{ background: "var(--mist)" }}>
        <DashboardNav />
        <p className="max-w-[1200px] mx-auto px-6 pt-10 text-xs" style={{ color: "#b91c1c" }}>{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen" style={{ background: "var(--mist)" }}>
      <DashboardNav email={data?.email} />

      <section className="max-w-[1200px] mx-auto px-6 pt-10 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#8aaa9a" }}>Analytics</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight" style={{ color: "#13201b", fontFamily: "var(--font-display)" }}>
              Recruiter performance & candidate quality
            </h1>
          </div>
          <div className="flex gap-2">
            <select value={range} onChange={(e) => setRange(e.target.value)} className="text-xs px-3 py-2.5 rounded-[10px]" style={{ border: "1px solid var(--border)", background: "white", color: "#13201b" }}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <button onClick={exportScorecardCsv} disabled={!data} className="text-xs font-semibold px-3 py-2.5 rounded-[10px]" style={{ border: "1px solid var(--border)", color: "#13201b", background: "white" }}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="rounded-[10px] p-3 mt-4" style={{ background: "#fff8e6", border: "1px solid #f5e0a3" }}>
          <p className="text-[11px]" style={{ color: "#8a6a1f" }}>
            <strong>Data note:</strong> per-dimension sub-scores (skills/experience/education/seniority match) are placeholder values derived from the overall score with random variance — they are not yet backed by real scoring logic. "Avg days to placement" only counts candidates who have already been placed, so it skews optimistic as your active pipeline grows. Treat both as illustrative until a real scoring model and full-pipeline timing are built.
          </p>
        </div>
      </section>

      {!data ? (
        <div className="max-w-[1200px] mx-auto px-6"><p className="text-xs" style={{ color: "#5a7a6a" }}>Loading…</p></div>
      ) : (
        <section className="max-w-[1200px] mx-auto px-6 pb-24 pt-4">

          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#8aaa9a" }}>Recruiter performance</h2>

          <Panel title="Placements by recruiter" sub="Total analyses run vs. candidates successfully placed, this period" empty={recruiterStats.every((r) => r.total === 0)}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={recruiterStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total" name="Total analyses" fill={COLORS.mint} radius={[6, 6, 0, 0]} />
                <Bar dataKey="placed" name="Placed" fill={COLORS.forest} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="Recruiter scorecard" sub="Conversion rate = placements ÷ total candidates screened">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: "#8aaa9a" }}>
                    <th className="text-left font-semibold uppercase tracking-wider text-[10px] pb-2">Recruiter</th>
                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] pb-2">Total</th>
                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] pb-2">Placed</th>
                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] pb-2">Rejected</th>
                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] pb-2">Conversion</th>
                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] pb-2">Avg score</th>
                    <th className="text-right font-semibold uppercase tracking-wider text-[10px] pb-2">Avg days to placement</th>
                  </tr>
                </thead>
                <tbody>
                  {recruiterStats.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="py-2.5 font-semibold" style={{ color: "#13201b" }}>{r.name}</td>
                      <td className="py-2.5 text-right" style={{ color: "#13201b" }}>{r.total}</td>
                      <td className="py-2.5 text-right" style={{ color: "var(--forest)" }}>{r.placed}</td>
                      <td className="py-2.5 text-right" style={{ color: "#c0392b" }}>{r.rejected}</td>
                      <td className="py-2.5 text-right" style={{ color: "#13201b" }}>{r.total === 0 ? "—" : `${r.conversionRate}%`}</td>
                      <td className="py-2.5 text-right" style={{ color: "#13201b" }}>{r.avgScore || "—"}</td>
                      <td className="py-2.5 text-right" style={{ color: "#13201b" }}>{r.avgTimeToPlacement ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Pipeline funnel" sub="How many candidates have reached at least this stage, this period" empty={funnelData.every((f) => f.count === 0)}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={130} />
                <Tooltip />
                <Bar dataKey="count" fill={COLORS.forest} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <h2 className="text-xs font-semibold uppercase tracking-widest mb-3 mt-8" style={{ color: "#8aaa9a" }}>Candidate quality trends</h2>

          <Panel title="Average match score over time" sub="Weekly average, with analysis volume" empty={scoreOverTime.length === 0}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={scoreOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="avgScore" name="Avg score" stroke={COLORS.forest} strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="volume" name="Analyses run" stroke={COLORS.amber} strokeWidth={2} dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Panel title="Score distribution" sub="Candidates by match-score band, this period" empty={scoreDistribution.every((d) => d.count === 0)}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="band" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {scoreDistribution.map((d, i) => (
                      <Cell key={i} fill={["#c0392b", "#c0392b", "#c9922e", "#c9922e", "#0b6e4f"][i]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel title="Most in-demand skills" sub="Top skills across candidates analysed this period" empty={skillsDemand.length === 0}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={skillsDemand} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="skill" tick={{ fontSize: 11 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" fill={COLORS.forest} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          </div>

          <Panel title="Stage snapshot" sub="Where every candidate stands right now, this period" empty={Object.keys(volumeByStage).length === 0}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(volumeByStage).map(([stage, count]) => (
                <div key={stage} className="rounded-[10px] p-3 text-center" style={{ background: "var(--mist)" }}>
                  <p className="text-lg font-semibold" style={{ fontFamily: "var(--font-mono)", color: "#13201b" }}>{count}</p>
                  <p className="text-[10px] capitalize" style={{ color: "#5a7a6a" }}>{stage.replace(/_/g, " ")}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>
      )}
    </main>
  );
}