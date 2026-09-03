"use client";

export function PageHeader({ title, description, children }) {
  return (
    <div className="page-header">
      <div className="page-heading">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-controls">{children}</div>}
    </div>
  );
}

export function RangeControl({ range, setRange, options = ["24h", "7d", "30d"] }) {
  return (
    <div className="segmented">
      {options.map((item) => (
        <button
          key={item}
          className={range === item ? "active" : ""}
          onClick={() => setRange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

export function KpiCard({ label, value, tone, foot }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

export function Panel({ title, sub, action, children, className = "" }) {
  return (
    <div className={`panel ${className}`}>
      {(title || action) && (
        <div className="section-head" style={{ marginBottom: sub ? 2 : 10 }}>
          <div>
            {title && <div className="panel-title">{title}</div>}
            {sub && <div className="panel-sub">{sub}</div>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

/*
 * Simple horizontal bar list for "top N" breakdowns (paths, countries,
 * referrers, user agents, etc). Renders a track scaled against the
 * largest count in the set, capped so lists longer than `limit` still
 * feel readable.
 */
export function BarList({ items = [], limit = 8, emptyLabel = "No data yet." }) {
  const rows = items.slice(0, limit);
  const max = rows.reduce((m, item) => Math.max(m, item.count || 0), 0) || 1;

  if (rows.length === 0) {
    return <div className="empty">{emptyLabel}</div>;
  }

  return (
    <div className="bar-list">
      {rows.map((item) => (
        <div className="bar-row" key={item.name}>
          <span className="bar-row-label mono" title={item.name}>
            {item.name}
          </span>
          <span className="bar-value">{item.count.toLocaleString()}</span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatList({ rows = [] }) {
  return (
    <div className="stat-list">
      {rows.map((row) => (
        <div className="stat-list-row" key={row.label}>
          <span className="muted">{row.label}</span>
          <b style={row.tone ? { color: row.tone } : undefined}>{row.value}</b>
        </div>
      ))}
    </div>
  );
}
