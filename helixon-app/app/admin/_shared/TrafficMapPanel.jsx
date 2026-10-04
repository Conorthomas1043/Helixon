"use client";
// app/admin/_shared/TrafficMapPanel.jsx
// The traffic map with its legend and a ranked "top places" list beside it
// (which doubles as the non-visual way to read the map). Selecting a place
// - on the map or in the list - calls onSelect(point).

import dynamic from "next/dynamic";
import { blockedShare, placeLabel } from "@/lib/admin/traffic";

// Client-only: the map measures the SVG and loads the world outlines lazily.
const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: 420, margin: 12, borderRadius: 12 }} />,
});

export function pointKey(p) {
  return `${p.country}|${p.city}|${p.lat}|${p.lon}`;
}

export default function TrafficMapPanel({ points = [], summary, partial, onSelect, selectedKey, title = "Where traffic comes from", sub }) {
  const top = points.slice(0, 8);
  const max = Math.max(1, ...top.map((p) => p.count));
  const plotted = points.reduce((n, p) => n + p.count, 0);

  return (
    <section className="panel map-panel" aria-labelledby="traffic-map-title">
      <div className="map-panel-head">
        <div>
          <div className="panel-title" id="traffic-map-title">{title}</div>
          <div className="panel-sub">
            {sub ||
              (summary
                ? `${plotted.toLocaleString()} requests from ${points.length} places${summary.countries ? ` in ${summary.countries} countries` : ""}${summary.requests > summary.geolocated ? ` · ${(summary.requests - summary.geolocated).toLocaleString()} without a location` : ""}`
                : "Loading…")}
            {partial && " · showing the newest requests only"}
          </div>
        </div>
        <div className="legend" aria-label="Legend">
          <span className="legend-item"><span className="legend-dot legend-ok" /> Allowed</span>
          <span className="legend-item"><span className="legend-dot legend-warn" /> Some blocked</span>
          <span className="legend-item"><span className="legend-dot legend-critical" /> Mostly blocked</span>
        </div>
      </div>

      <div className="map-layout">
        <WorldMap points={points} onSelect={onSelect} selectedKey={selectedKey} />
        <div className="map-side">
          <h3>Top places</h3>
          {top.length === 0 ? (
            <div className="faint" style={{ fontSize: 13.5 }}>Nothing geolocated in this range.</div>
          ) : (
            top.map((p) => {
              const key = pointKey(p);
              const share = blockedShare(p);
              return (
                <button
                  key={key}
                  type="button"
                  className={`place-row ${selectedKey === key ? "active" : ""}`}
                  aria-pressed={selectedKey === key}
                  onClick={() => onSelect?.(p)}
                >
                  <span className="place-name">
                    <span className={`legend-dot ${share >= 0.5 ? "legend-critical" : share > 0 ? "legend-warn" : "legend-ok"}`} aria-hidden="true" />
                    {placeLabel(p)}
                  </span>
                  <span className="place-count">{p.count.toLocaleString()}</span>
                  <span className="bar-track" aria-hidden="true">
                    <span className="bar-fill" style={{ width: `${(p.count / max) * 100}%`, display: "block" }} />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
