"use client";

// Requests over time for the Traffic page: three small multiples on one
// time axis - all requests, blocked, and flagged (threat score 20+). Each
// row has its own scale, because blocked is usually a sliver of the total
// and would vanish on a shared one. Hovering (or the arrow keys) reads
// every row at that hour; clicking a bar filters the request log to it.
// The same numbers are available as a table.

import { useEffect, useMemo, useState } from "react";

const ROWS = [
  { key: "requests", label: "Requests", color: "var(--accent)", height: 92 },
  { key: "blocked", label: "Blocked", color: "var(--critical)", height: 46 },
  { key: "flagged", label: "Flagged", color: "var(--warn)", height: 46 },
];
const STEP_MS = { hour: 3600e3, day: 86400e3 };
const RIGHT_GUTTER = 38; // the scale labels
const ROW_LABEL = 18; // the row title above each plot
const ROW_GAP = 12;
const AXIS = 22;
// Where each row's plot sits, top to bottom.
const ROW_BOXES = ROWS.reduce((boxes, row) => {
  const plotTop = (boxes.length ? boxes[boxes.length - 1].base + ROW_GAP : 0) + ROW_LABEL;
  return [...boxes, { ...row, plotTop, base: plotTop + row.height }];
}, []);
const HEIGHT = ROW_BOXES[ROW_BOXES.length - 1].base + ROW_GAP + AXIS;

// The smallest 1/2/5 x 10^n at or above `value`, so the scale reads cleanly.
function niceMax(value) {
  if (value <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((m) => m * power >= value);
  return step * power;
}

const compact = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(n));

// The database only returns buckets that had traffic; the axis needs all of them.
function fillBuckets(timeline, since) {
  const bucket = timeline?.bucket === "day" ? "day" : "hour";
  const step = STEP_MS[bucket];
  const byTime = new Map((timeline?.points || []).map((p) => [Math.floor(Date.parse(p.at) / step) * step, p]));
  const start = Math.floor(Date.parse(since || new Date(Date.now() - 86400e3).toISOString()) / step) * step;
  const end = Math.floor(Date.now() / step) * step;
  const out = [];
  for (let t = start; t <= end && out.length < 1000; t += step) {
    const p = byTime.get(t);
    out.push({ at: t, end: t + step, requests: p?.requests || 0, blocked: p?.blocked || 0, flagged: p?.flagged || 0 });
  }
  return { bucket, step, points: out };
}

function bucketLabel(point, bucket) {
  if (bucket === "day") {
    return new Date(point.at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  }
  const start = new Date(point.at);
  const time = (d) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${start.toLocaleDateString(undefined, { day: "numeric", month: "short" })}, ${time(start)} – ${time(new Date(point.end))}`;
}

// Which buckets get an axis label: evenly spaced, at least ~60px apart.
function axisTicks(points, bucket, stepPx) {
  if (bucket === "day") {
    const every = [1, 2, 3, 7, 14].find((d) => d * stepPx >= 60) || 14;
    return points
      .map((p, i) => ({ i, label: new Date(p.at).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" }) }))
      .filter(({ i }) => (points.length - 1 - i) % every === 0);
  }
  const every = [1, 2, 3, 6, 12, 24, 48, 72, 168].find((h) => h * stepPx >= 60) || 168;
  return points
    .map((p, i) => ({ i, date: new Date(p.at) }))
    .filter(({ date }) => (every < 24 ? date.getHours() % every === 0 : date.getHours() === 0 && Math.floor(date.getTime() / 86400e3) % (every / 24) === 0))
    .map(({ i, date }) => ({
      i,
      label:
        every < 24
          ? date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
          : date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
    }));
}

// A column with a 4px rounded top and a square foot on the baseline.
function columnPath(x, y, width, base) {
  const r = Math.min(4, width / 2, base - y);
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${base}Z`;
}

export default function TrafficTimeline({ timeline, since, busy, selected, onSelect }) {
  const [view, setView] = useState("chart");
  const [node, setNode] = useState(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(null);

  // Draw at the real pixel width so bars and text stay crisp.
  useEffect(() => {
    if (!node) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  const { bucket, points } = useMemo(() => fillBuckets(timeline, since), [timeline, since]);
  const totals = useMemo(
    () => Object.fromEntries(ROWS.map((row) => [row.key, points.reduce((sum, p) => sum + p[row.key], 0)])),
    [points],
  );
  const empty = !points.length || totals.requests === 0;

  const plotWidth = Math.max(0, width - RIGHT_GUTTER);
  const stepPx = points.length ? plotWidth / points.length : 0;
  const barWidth = Math.max(1, Math.min(24, stepPx - 2));
  const selectedIndex = selected ? points.findIndex((p) => p.at === Date.parse(selected.from)) : -1;
  const current = active !== null && points[active] ? points[active] : null;
  const unit = bucket === "day" ? "day" : "hour";

  function indexAt(clientX, target) {
    const box = target.getBoundingClientRect();
    return Math.max(0, Math.min(points.length - 1, Math.floor((clientX - box.left) / (stepPx || 1))));
  }

  function choose(index) {
    const p = points[index];
    if (!p || !onSelect) return;
    onSelect(selectedIndex === index ? null : { from: new Date(p.at).toISOString(), to: new Date(p.end).toISOString(), label: bucketLabel(p, bucket) });
  }

  function onKeyDown(e) {
    if (!points.length) return;
    const last = points.length - 1;
    const move = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (move) {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(last, (a ?? last + (move > 0 ? -1 : 1)) + move)));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : last);
    } else if ((e.key === "Enter" || e.key === " ") && active !== null) {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      setActive(null);
    }
  }

  const layout = ROW_BOXES.map((row) => ({ ...row, max: niceMax(Math.max(...points.map((p) => p[row.key]), 0)) }));
  const ticks = stepPx ? axisTicks(points, bucket, stepPx) : [];
  // The tooltip sits beside the hovered column, never over it.
  const tipX = current ? (active + 0.5) * stepPx : 0;
  const tipStyle = tipX < plotWidth / 2 ? { left: tipX + stepPx / 2 + 10 } : { left: tipX - stepPx / 2 - 10, transform: "translateX(-100%)" };

  return (
    <div className="panel section">
      <div className="section-head" style={{ marginBottom: 12 }}>
        <div>
          <div className="panel-title">Requests over time</div>
          <div className="panel-sub">
            One bar per {unit}. Blocked and flagged have their own scales. Click a bar to see those requests in the log.
          </div>
        </div>
        <div className="segmented" role="group" aria-label="Show as">
          <button className={view === "chart" ? "active" : ""} aria-pressed={view === "chart"} onClick={() => setView("chart")}>Chart</button>
          <button className={view === "table" ? "active" : ""} aria-pressed={view === "table"} onClick={() => setView("table")}>Table</button>
        </div>
      </div>

      {view === "table" ? (
        <div className="table-wrap" style={{ maxHeight: 320 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{bucket === "day" ? "Day (UTC)" : "Hour"}</th>
                <th className="num">Requests</th>
                <th className="num">Blocked</th>
                <th className="num">Flagged</th>
              </tr>
            </thead>
            <tbody>
              {points.filter((p) => p.requests > 0).length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty">No requests in this range.</td>
                </tr>
              ) : (
                [...points]
                  .reverse()
                  .filter((p) => p.requests > 0)
                  .map((p) => (
                    <tr key={p.at}>
                      <td className="mono">{bucketLabel(p, bucket)}</td>
                      <td className="num">{p.requests.toLocaleString()}</td>
                      <td className="num">{p.blocked.toLocaleString()}</td>
                      <td className="num">{p.flagged.toLocaleString()}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          ref={setNode}
          className="viz"
          style={{ height: HEIGHT, opacity: busy ? 0.55 : 1 }}
          tabIndex={0}
          role="group"
          aria-label={`Requests per ${unit}. Use the left and right arrow keys to move between ${unit}s, and Enter to show that ${unit}'s requests in the log.`}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          {/* undefined: still loading; null: the timeline function isn't in the database yet. */}
          {timeline === null ? (
            <div className="viz-empty">The timeline needs the latest database migration (request_inspector).</div>
          ) : timeline && empty ? (
            <div className="viz-empty">No requests in this range.</div>
          ) : null}

          {width > 0 && timeline && !empty && (
            <svg width={width} height={HEIGHT} role="presentation">
              {selectedIndex >= 0 && <rect x={selectedIndex * stepPx} y={0} width={stepPx} height={HEIGHT - AXIS} className="viz-band selected" />}
              {current && <rect x={active * stepPx} y={0} width={stepPx} height={HEIGHT - AXIS} className="viz-band" />}

              {layout.map((row) => (
                <g key={row.key}>
                  <text x={0} y={row.plotTop - 6} className="viz-title">
                    {row.label}
                    <tspan className="viz-muted" dx={8}>
                      {totals[row.key].toLocaleString()} in range
                    </tspan>
                  </text>
                  <line x1={0} x2={plotWidth} y1={row.plotTop + 0.5} y2={row.plotTop + 0.5} className="viz-grid" />
                  <text x={width} y={row.plotTop + 4} textAnchor="end" className="viz-tick">
                    {compact(row.max)}
                  </text>
                  <line x1={0} x2={plotWidth} y1={row.base + 0.5} y2={row.base + 0.5} className="viz-axis" />
                  <text x={width} y={row.base + 4} textAnchor="end" className="viz-tick">
                    0
                  </text>
                  {points.map((p, i) => {
                    const value = p[row.key];
                    if (!value) return null;
                    // Anything logged stays visible, however small next to the peak.
                    const h = Math.max(1.5, (value / row.max) * row.height);
                    const dim = selectedIndex >= 0 && selectedIndex !== i;
                    return (
                      <path
                        key={p.at}
                        d={columnPath(i * stepPx + (stepPx - barWidth) / 2, row.base - h, barWidth, row.base)}
                        fill={row.color}
                        opacity={dim ? 0.35 : active === i ? 1 : 0.88}
                      />
                    );
                  })}
                </g>
              ))}

              {ticks.map(({ i, label }) => {
                const x = (i + 0.5) * stepPx;
                if (x < 16 || x > plotWidth - 16) return null;
                return (
                  <text key={`t-${i}`} x={x} y={HEIGHT - 6} textAnchor="middle" className="viz-tick">
                    {label}
                  </text>
                );
              })}

              {/* One hit area for the whole plot: the column under the pointer is the target. */}
              <rect
                x={0}
                y={0}
                width={plotWidth}
                height={HEIGHT - AXIS}
                fill="transparent"
                style={{ cursor: onSelect ? "pointer" : "default" }}
                onPointerMove={(e) => setActive(indexAt(e.clientX, e.currentTarget))}
                onPointerLeave={() => setActive(null)}
                onClick={(e) => choose(indexAt(e.clientX, e.currentTarget))}
              />
            </svg>
          )}

          {current && (
            <div className="viz-tip" style={tipStyle} aria-hidden="true">
              <div className="viz-tip-head">{bucketLabel(current, bucket)}</div>
              {ROWS.map((row) => (
                <div className="viz-tip-row" key={row.key}>
                  <span className="viz-key" style={{ background: row.color }} />
                  <b>{current[row.key].toLocaleString()}</b>
                  <span>{row.label.toLowerCase()}</span>
                </div>
              ))}
              {onSelect && <div className="viz-tip-hint">{selectedIndex === active ? "Click to clear the filter" : "Click to see these requests"}</div>}
            </div>
          )}
          <div className="sr-only" aria-live="polite">
            {current ? `${bucketLabel(current, bucket)}: ${current.requests} requests, ${current.blocked} blocked, ${current.flagged} flagged.` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
