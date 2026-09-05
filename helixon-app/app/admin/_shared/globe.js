"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
const SOURCE_ID = "helixon-traffic-points";
const AUTO_ROTATE_DEG_PER_SEC = 3.2;
const IDLE_SPIN_DELAY_MS = 2500;

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

/**
 * Build a GeoJSON FeatureCollection from traffic points. `count` and `hot`
 * drive circle radius/color in the style layer below, so nothing else in
 * this file needs to branch on them.
 */
function pointsToGeoJSON(points) {
  return {
    type: "FeatureCollection",
    features: (points || []).map((point) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.lon, point.lat],
      },
      properties: {
        count: Number(point.count || 1),
        hot: !!point.hot,
        label: point.label || "",
      },
    })),
  };
}

function addTrafficLayers(map) {
  if (map.getSource(SOURCE_ID)) return;

  map.addSource(SOURCE_ID, {
    type: "geojson",
    data: pointsToGeoJSON([]),
  });

  // Soft glow behind each point.
  map.addLayer({
    id: `${SOURCE_ID}-glow`,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-color": ["case", ["get", "hot"], "#d9636b", "#4fa8c9"],
      "circle-opacity": 0.18,
      "circle-blur": 0.6,
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["get", "count"],
        1,
        10,
        50,
        26,
      ],
    },
  });

  // Solid core dot, sized on a log-ish curve so hotspots stand out without
  // swamping the map.
  map.addLayer({
    id: `${SOURCE_ID}-core`,
    type: "circle",
    source: SOURCE_ID,
    paint: {
      "circle-color": ["case", ["get", "hot"], "#d9636b", "#4fa8c9"],
      "circle-stroke-color": "#0b0f14",
      "circle-stroke-width": 1,
      "circle-opacity": 0.92,
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["get", "count"],
        1,
        3.5,
        50,
        11,
      ],
    },
  });
}

function GlobeInner({ points }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const spinFrameRef = useRef(null);
  const lastInteractionRef = useRef(0);
  const userInteractingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [tokenMissing] = useState(!MAPBOX_TOKEN);

  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (tokenMissing || !containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      projection: "globe",
      center: [0, 20],
      zoom: 1.4,
      attributionControl: false,
      dragRotate: true,
      touchZoomRotate: true,
    });

    mapRef.current = map;

    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    map.scrollZoom.setWheelZoomRate(1 / 300);

    map.on("style.load", () => {
      map.setFog({
        color: "rgb(20, 27, 36)",
        "high-color": "rgb(36, 92, 115)",
        "horizon-blend": 0.03,
        "space-color": "rgb(11, 15, 20)",
        "star-intensity": 0.25,
      });

      addTrafficLayers(map);
      setReady(true);
    });

    function markInteracting() {
      userInteractingRef.current = true;
      lastInteractionRef.current = Date.now();
    }

    map.on("dragstart", markInteracting);
    map.on("zoomstart", markInteracting);
    map.on("rotatestart", markInteracting);
    map.on("dragend", () => {
      userInteractingRef.current = false;
    });

    function spin(timestamp, previousTimestamp) {
      spinFrameRef.current = requestAnimationFrame((t) => spin(t, timestamp));

      if (reduceMotion || userInteractingRef.current) return;
      if (Date.now() - lastInteractionRef.current < IDLE_SPIN_DELAY_MS) return;
      if (!previousTimestamp) return;

      const deltaSeconds = (timestamp - previousTimestamp) / 1000;
      const center = map.getCenter();
      center.lng -= AUTO_ROTATE_DEG_PER_SEC * deltaSeconds;
      map.setCenter(center);
    }

    spinFrameRef.current = requestAnimationFrame(spin);

    return () => {
      if (spinFrameRef.current) cancelAnimationFrame(spinFrameRef.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenMissing]);

  // Push updated points into the live source without rebuilding the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const source = map.getSource(SOURCE_ID);
    if (source) {
      source.setData(pointsToGeoJSON(points));
    }
  }, [points, ready]);

  if (tokenMissing) {
    return (
      <div className="globe-canvas globe-canvas-fallback">
        <div className="empty" style={{ padding: 24 }}>
          Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the live map.
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="globe-canvas" />;
}

export function Globe({ points }) {
  return (
    <div className="globe-canvas-wrap">
      <GlobeInner points={points} />
    </div>
  );
}

export function useGlobePoints(rawGlobe) {
  return useMemo(() => {
    const raw = (rawGlobe || []).slice(0, 200);

    return raw
      .filter(
        (item) =>
          Number.isFinite(Number(item.lat)) &&
          Number.isFinite(Number(item.lon)),
      )
      .map((item, index) => ({
        ...item,
        count: Number(item.count || 1),
        phase: index * 0.33,
        hot: Number(item.count || 0) >= 10,
      }));
  }, [rawGlobe]);
}
