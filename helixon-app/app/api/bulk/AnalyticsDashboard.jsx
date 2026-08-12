"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// Renders the `analytics` object returned by /api/bulk above the candidate
// list. Drop it in right after your "RESULTS · N CANDIDATES" header:
//
//   <AnalyticsDashboard analytics={data.analytics} />
//
// Needs recharts: npm install recharts

const RECOMMENDATION_COLOR = {
  "Strong match": "#15803d", // green-700
  "Worth reviewing": "#b45309", // amber-700
  "Likely not a fit": "#b91c1c", // red-700
  "Could not read": "#6b7280", // gray-500
};

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-gray-400">{sub}</div> : null}
    </div>
  );
}

function RecommendationBreakdown({ breakdown, total }) {
  const entries = Object.entries(breakdown || {});
  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm font-medium text-gray-700">Recommendation breakdown</div>
      <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
        {entries.map(([label, count]) => (
          <div
            key={label}
            style={{
              width: `${(count / total) * 100}%`,
              backgroundColor: RECOMMENDATION_COLOR[label] || "#6b7280",
            }}
            title={`${label}: ${count}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {entries.map(([label, count]) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: RECOMMENDATION_COLOR[label] || "#6b7280" }}
            />
            {label} · {count}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreDistribution({ distribution }) {
  if (!distribution?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm font-medium text-gray-700">Score distribution</div>
      <div className="mt-3 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distribution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "#f3f4f6" }}
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {distribution.map((entry, i) => (
                <Cell
                  key={entry.label}
                  fill={i >= 3 ? "#16a34a" : i === 2 ? "#d97706" : "#dc2626"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TagList({ title, items, countKey, labelKey, emptyText }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-sm font-medium text-gray-700">{title}</div>
      {items?.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item[labelKey]}
              className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
            >
              {item[labelKey]}
              <span className="text-gray-400">×{item[countKey]}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 text-xs text-gray-400">{emptyText}</div>
      )}
    </div>
  );
}

export default function AnalyticsDashboard({ analytics }) {
  if (!analytics) return null;

  const {
    total_candidates,
    scored_candidates,
    average_score,
    median_score,
    recommendation_breakdown,
    score_distribution,
    top_skills,
    common_gaps,
  } = analytics;

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Candidates" value={total_candidates} />
        <StatCard
          label="Avg score"
          value={`${average_score}/100`}
          sub={scored_candidates < total_candidates ? `${scored_candidates} scored` : undefined}
        />
        <StatCard label="Median score" value={`${median_score}/100`} />
        <StatCard
          label="Strong matches"
          value={recommendation_breakdown?.["Strong match"] || 0}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <RecommendationBreakdown breakdown={recommendation_breakdown} total={scored_candidates} />
        <ScoreDistribution distribution={score_distribution} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TagList
          title="Most common skills in this pool"
          items={top_skills}
          countKey="count"
          labelKey="skill"
          emptyText="No skills extracted yet."
        />
        <TagList
          title="Most common gaps vs. the job spec"
          items={common_gaps}
          countKey="count"
          labelKey="gap"
          emptyText="No consistent gaps found — good sign."
        />
      </div>
    </div>
  );
}
