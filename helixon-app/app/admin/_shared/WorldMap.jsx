"use client";
// app/admin/_shared/WorldMap.jsx
// Traffic map for the admin console: an SVG globe (drag to turn it) or a
// flat world map, with one point per place sized by request volume and
// coloured by how much of that traffic was blocked.
//
// Replaces the Mapbox GL globe, which needed NEXT_PUBLIC_MAPBOX_TOKEN (and
// showed a "set the token" message instead of a map without it), WebGL and
// a third-party tile service. This draws the country outlines from bundled
// Natural Earth data (world-atlas), so it works anywhere the console does.
//
// Points are real buttons: hover or focus shows the details, Enter/click
// calls onSelect(point) - the traffic page uses that to filter its log.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoDistance, geoEqualEarth, geoGraticule10, geoOrthographic, geoPath } from "d3-geo";
import { blockedShare, placeLabel } from "@/lib/admin/traffic";

const WIDTH = 900;
const HEIGHT = 480;
const SPIN_DEG_PER_SEC = 5;
const IDLE_BEFORE_SPIN_MS = 3000;

function pointColor(point) {
  const share = blockedShare(point);
  if (share >= 0.5) return "var(--critical)";
  if (share > 0) return "var(--warn)";
  return "var(--accent)";
}

function useCountries() {
  const [countries, setCountries] = useState(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([import("topojson-client"), import("world-atlas/countries-110m.json")])
      .then(([topo, world]) => {
        const data = world.default || world;
        if (!cancelled) setCountries(topo.feature(data, data.objects.countries).features);
      })
      .catch(() => { if (!cancelled) setCountries([]); });
    return () => { cancelled = true; };
  }, []);
  return countries;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    const t = setTimeout(update, 0);
    mq.addEventListener("change", update);
    return () => { clearTimeout(t); mq.removeEventListener("change", update); };
  }, []);
  return reduced;
}

export default function WorldMap({ points = [], onSelect, selectedKey, height = HEIGHT }) {
  const countries = useCountries();
  const reducedMotion = usePrefersReducedMotion();
  const [mode, setMode] = useState("globe");
  const [rotation, setRotation] = useState([-5, -30]); // [lambda, phi]; starts over Europe
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);
  const drag = useRef(null);
  const lastInteraction = useRef(0);
  const visible = useRef(true);

  const maxCount = useMemo(() => Math.max(1, ...points.map((p) => p.count)), [points]);
  const radius = (count) => 3 + Math.sqrt(count / maxCount) * 14;

  const projection = useMemo(() => {
    if (mode === "globe") {
      return geoOrthographic()
        .scale((height / 2 - 12) * zoom)
        .translate([WIDTH / 2, height / 2])
        .rotate([rotation[0], rotation[1]])
        .clipAngle(90);
    }
    return geoEqualEarth()
      .fitExtent([[12, 12], [WIDTH - 12, height - 12]], { type: "Sphere" })
      .scale(geoEqualEarth().fitExtent([[12, 12], [WIDTH - 12, height - 12]], { type: "Sphere" }).scale() * zoom);
  }, [mode, rotation, zoom, height]);

  const path = useMemo(() => geoPath(projection), [projection]);
  const graticule = useMemo(() => geoGraticule10(), []);

  // Slow spin while nobody is interacting, the map is on screen and the
  // visitor hasn't asked for reduced motion. Globe view only.
  useEffect(() => {
    if (mode !== "globe" || reducedMotion) return undefined;
    const el = svgRef.current;
    const io = el ? new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }) : null;
    if (io) io.observe(el);
    let frame;
    let prev;
    function tick(t) {
      frame = requestAnimationFrame(tick);
      const dt = prev ? (t - prev) / 1000 : 0;
      prev = t;
      if (!visible.current || document.hidden || drag.current || hovered) return;
      if (Date.now() - lastInteraction.current < IDLE_BEFORE_SPIN_MS) return;
      if (dt <= 0 || dt > 0.25) return;
      setRotation(([l, p]) => [l + SPIN_DEG_PER_SEC * dt, p]);
    }
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); io?.disconnect(); };
  }, [mode, reducedMotion, hovered]);

  function svgPoint(e) {
    const rect = svgRef.current.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * WIDTH, ((e.clientY - rect.top) / rect.height) * height];
  }

  function onPointerDown(e) {
    if (mode !== "globe" || e.target.closest("[data-point]")) return;
    svgRef.current.setPointerCapture(e.pointerId);
    drag.current = { start: svgPoint(e), rotation };
    lastInteraction.current = Date.now();
  }
  function onPointerMove(e) {
    if (!drag.current) return;
    const [x, y] = svgPoint(e);
    const k = 0.35 / zoom;
    const [l0, p0] = drag.current.rotation;
    setRotation([l0 + (x - drag.current.start[0]) * k, Math.max(-85, Math.min(85, p0 - (y - drag.current.start[1]) * k))]);
    lastInteraction.current = Date.now();
  }
  function onPointerUp() {
    drag.current = null;
    lastInteraction.current = Date.now();
  }

  function turn(dl, dp) {
    lastInteraction.current = Date.now();
    setRotation(([l, p]) => [l + dl, Math.max(-85, Math.min(85, p + dp))]);
  }

  // Event handlers only (click / Enter on a point).
  const focusOn = useCallback((point) => {
    if (mode === "globe") setRotation([-point.lon, -point.lat]);
    lastInteraction.current = Date.now();
  }, [mode]);

  // Globe: only draw points on the side facing the viewer.
  const center = [-rotation[0], -rotation[1]];
  const drawn = points
    .map((p, i) => ({ ...p, key: `${p.country}|${p.city}|${p.lat}|${p.lon}`, i }))
    .filter((p) => mode !== "globe" || geoDistance([p.lon, p.lat], center) < Math.PI / 2 - 0.02)
    .map((p) => ({ ...p, xy: projection([p.lon, p.lat]) }))
    .filter((p) => p.xy)
    .sort((a, b) => b.count - a.count); // big first, so small ones sit on top and stay clickable

  const tip = hovered && drawn.find((p) => p.key === hovered);

  return (
    <div className="worldmap">
      <div className="worldmap-toolbar">
        <div className="segmented" role="group" aria-label="Map view">
          <button type="button" className={mode === "globe" ? "active" : ""} aria-pressed={mode === "globe"} onClick={() => setMode("globe")}>Globe</button>
          <button type="button" className={mode === "flat" ? "active" : ""} aria-pressed={mode === "flat"} onClick={() => setMode("flat")}>Flat</button>
        </div>
        <div className="worldmap-zoom" role="group" aria-label="Zoom">
          <button type="button" className="icon-btn" onClick={() => setZoom((z) => Math.max(0.8, +(z - 0.25).toFixed(2)))} aria-label="Zoom out">−</button>
          <button type="button" className="icon-btn" onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} aria-label="Zoom in">+</button>
          {mode === "globe" && (
            <>
              <button type="button" className="icon-btn" onClick={() => turn(20, 0)} aria-label="Turn west">←</button>
              <button type="button" className="icon-btn" onClick={() => turn(-20, 0)} aria-label="Turn east">→</button>
            </>
          )}
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${height}`}
        className={`worldmap-svg ${mode === "globe" ? "is-globe" : ""}`}
        role="img"
        aria-label={`Traffic map, ${points.length} locations`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <radialGradient id="wm-ocean" cx="45%" cy="40%" r="65%">
            <stop offset="0%" stopColor="var(--map-ocean-hi)" />
            <stop offset="100%" stopColor="var(--map-ocean)" />
          </radialGradient>
        </defs>
        <path d={path({ type: "Sphere" })} fill={mode === "globe" ? "url(#wm-ocean)" : "var(--map-ocean)"} stroke="var(--border-strong)" />
        <path d={path(graticule)} fill="none" stroke="var(--map-grid)" strokeWidth="0.5" />
        {countries?.map((c, i) => (
          <path key={c.id || i} d={path(c)} fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.5" />
        ))}
        {drawn.map((p) => {
          const r = radius(p.count);
          const active = p.key === hovered || p.key === selectedKey;
          const label = `${placeLabel(p)}: ${p.count.toLocaleString()} requests, ${p.uniqueIps} unique IPs${p.blocked ? `, ${p.blocked} blocked` : ""}`;
          return (
            <g
              key={p.key}
              data-point
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={p.key === selectedKey}
              transform={`translate(${p.xy[0]},${p.xy[1]})`}
              className="worldmap-point"
              onMouseEnter={() => setHovered(p.key)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(p.key)}
              onBlur={() => setHovered(null)}
              onClick={() => { onSelect?.(p); focusOn(p); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect?.(p); focusOn(p); } }}
            >
              <circle r={r * 2} fill={pointColor(p)} opacity={0.14} />
              <circle r={r} fill={pointColor(p)} stroke={active ? "#fff" : "rgba(0,0,0,.55)"} strokeWidth={active ? 2 : 1} opacity={0.9} />
            </g>
          );
        })}
      </svg>

      {tip && (
        <div
          className="worldmap-tip"
          style={{ left: `${(tip.xy[0] / WIDTH) * 100}%`, top: `${(tip.xy[1] / height) * 100}%` }}
          role="status"
        >
          <strong>{placeLabel(tip)}</strong>
          <span>{tip.count.toLocaleString()} requests · {tip.uniqueIps.toLocaleString()} IPs</span>
          {tip.blocked > 0 && <span className="worldmap-tip-bad">{tip.blocked.toLocaleString()} blocked ({Math.round(blockedShare(tip) * 100)}%)</span>}
          {onSelect && <span className="worldmap-tip-hint">Click to filter the request log</span>}
        </div>
      )}

      {countries && points.length === 0 && <div className="worldmap-empty">No geolocated traffic in this range.</div>}
      {!countries && <div className="worldmap-empty">Loading map…</div>}
    </div>
  );
}
