"use client";

import { useEffect } from "react";
import { Icon } from "./icons";

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

// A headline number. Optional extras:
//   icon   - name from ./icons, shown in a tinted chip
//   delta  - { value: 12, suffix: "%" } change vs the previous period (green up, red down)
//   spark  - array of numbers, drawn as a small trend line under the value
//   tone   - CSS colour that tints the value, icon and top accent line
export function KpiCard({ label, value, tone, foot, icon, delta, spark }) {
  const style = tone ? { "--kpi-tone": tone } : undefined;
  return (
    <div className="kpi-card" style={style}>
      <div className="kpi-top">
        <div className="kpi-label">{label}</div>
        {icon && (
          <span className="kpi-icon">
            <Icon name={icon} />
          </span>
        )}
      </div>
      <div className="kpi-value" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {spark && spark.length > 1 && (
        <div className="kpi-spark">
          <Sparkline data={spark} tone={tone} />
        </div>
      )}
      {(foot || delta) && (
        <div className="kpi-foot">
          {delta && <Delta {...delta} />}
          {foot && <span>{foot}</span>}
        </div>
      )}
    </div>
  );
}

export function Delta({ value, suffix = "%", goodWhen = "up" }) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  // "Up" isn't always good (e.g. blocked requests); goodWhen flips the colouring.
  const good = direction === "flat" ? null : (direction === "up") === (goodWhen === "up");
  const tone = direction === "flat" ? "flat" : good ? "up" : "down";
  return (
    <span className={`delta ${tone}`}>
      {direction === "up" && <Icon name="arrowUp" size={11} strokeWidth={2.6} />}
      {direction === "down" && <Icon name="arrowDown" size={11} strokeWidth={2.6} />}
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

// Small dependency-free trend line with a soft area fill.
export function Sparkline({ data = [], tone = "var(--accent)", height = 34 }) {
  const width = 120;
  const values = data.map((n) => Number(n) || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => [i * step, height - 3 - ((v - min) / span) * (height - 8)]);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={tone} opacity="0.12" />
      <path d={line} fill="none" stroke={tone} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Skeleton({ width = "100%", height = 14, style }) {
  return <span className="skeleton" style={{ width, height, ...style }} aria-hidden="true" />;
}

export function EmptyState({ icon = "inbox", title, children }) {
  return (
    <div className="empty-state">
      <span className="icon">
        <Icon name={icon} />
      </span>
      <b>{title}</b>
      {children && <span>{children}</span>}
    </div>
  );
}

export function Progress({ value = 0, max = 100, warnAt = 0.8, badAt = 0.95 }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const tone = ratio >= badAt ? "bad" : ratio >= warnAt ? "warn" : "";
  return (
    <div className={`progress ${tone}`} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${Math.max(2, ratio * 100)}%` }} />
    </div>
  );
}

export function Avatar({ name = "", size = 30 }) {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }} aria-hidden="true">
      {letters || "?"}
    </span>
  );
}

// Right-hand slide-over for record details. Closes on Escape or a click outside.
export function Drawer({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}

// A single live/configured/error status line for one external dependency -
// used by the Command page's "Live services" panel and /admin/health.
// `snapshot` is one of the { configured, connected|error, ... } shapes
// lib/ops/live-services.js and lib/ops/health-checks.js return; `ok` is the
// caller's own judgement of "healthy" for whatever that service's shape
// means (e.g. Redis: connected; Resend: every domain verified).
export function ServiceStatus({ label, snapshot, ok, note }) {
  const state = !snapshot?.configured ? "off" : snapshot?.error ? "bad" : ok ? "good" : "warn";
  const text = !snapshot?.configured
    ? "Not configured"
    : snapshot?.error
      ? snapshot.error
      : note || "Connected";

  return (
    <div className={`service service-${state}`}>
      <span className="service-dot" aria-hidden="true" />
      <span className="service-text">
        <span className="service-label">{label}</span>
        <span className="service-note" title={text}>{text}</span>
      </span>
    </div>
  );
}

// Accessible on/off switch (a checkbox styled as a toggle). `description`
// sits under the label; `disabled` greys it out and blocks changes.
export function Switch({ checked, onChange, label, description, disabled, id }) {
  const inputId = id || `sw-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <label className={`switch-row ${disabled ? "is-disabled" : ""}`} htmlFor={inputId}>
      <span className="switch-text">
        <span className="switch-label">{label}</span>
        {description && <span className="switch-desc">{description}</span>}
      </span>
      <input
        id={inputId}
        type="checkbox"
        role="switch"
        className="switch-input"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="switch-track" aria-hidden="true"><span className="switch-thumb" /></span>
    </label>
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
// `onSelect(item)` makes each row a button (e.g. filter the log to it);
// `active` highlights the row whose name matches; `note(item)` adds a
// short muted note after the count.
export function BarList({ items = [], limit = 8, emptyLabel = "No data yet.", onSelect, active, note }) {
  const rows = items.slice(0, limit);
  const max = rows.reduce((m, item) => Math.max(m, item.count || 0), 0) || 1;

  if (rows.length === 0) {
    return <div className="empty">{emptyLabel}</div>;
  }

  return (
    <div className="bar-list">
      {rows.map((item) => {
        const inner = (
          <>
            <span className="bar-row-label mono" title={item.name}>
              {item.label || item.name}
            </span>
            <span className="bar-value">
              {item.count.toLocaleString()}
              {note?.(item) ? <span className="faint" style={{ marginLeft: 6, fontSize: 11 }}>{note(item)}</span> : null}
            </span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} />
            </div>
          </>
        );
        return onSelect ? (
          <button
            type="button"
            className="bar-row"
            key={item.name}
            onClick={() => onSelect(item)}
            aria-pressed={active === item.name}
            title={`Filter the log to ${item.name}`}
            style={{ width: "100%", textAlign: "left", background: active === item.name ? "var(--surface-2, rgba(127,127,127,0.12))" : "transparent", border: 0, padding: 0, cursor: "pointer", font: "inherit", color: "inherit" }}
          >
            {inner}
          </button>
        ) : (
          <div className="bar-row" key={item.name}>
            {inner}
          </div>
        );
      })}
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
