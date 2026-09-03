"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const COUNTRY_DATA_URL = "/data/countries.geojson";
const ADMIN1_DATA_URL = "/data/admin1.geojson";

const EARTH_RADIUS = 2;
const COUNTRY_RADIUS = EARTH_RADIUS + 0.014;
const ADMIN1_RADIUS = EARTH_RADIUS + 0.018;
const TRAFFIC_RADIUS = EARTH_RADIUS + 0.06;

function latLonToVector(lat, lon, radius = 2.02) {
  const phi = THREE.MathUtils.degToRad(lat);
  const theta = THREE.MathUtils.degToRad(lon + 90);

  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.cos(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.sin(theta),
  );
}

/**
 * Append a GeoJSON coordinate ring directly into the destination array.
 *
 * GeoJSON coordinates are [longitude, latitude].
 * This avoids spreading large Natural Earth 10m rings.
 */
function appendRingPositions(target, ring, radius) {
  if (!Array.isArray(ring) || ring.length < 2) {
    return;
  }

  for (let i = 0; i < ring.length - 1; i += 1) {
    const a = ring[i];
    const b = ring[i + 1];

    if (!Array.isArray(a) || !Array.isArray(b)) {
      continue;
    }

    const lonA = Number(a[0]);
    const latA = Number(a[1]);
    const lonB = Number(b[0]);
    const latB = Number(b[1]);

    if (
      !Number.isFinite(lonA) ||
      !Number.isFinite(latA) ||
      !Number.isFinite(lonB) ||
      !Number.isFinite(latB)
    ) {
      continue;
    }

    const start = latLonToVector(latA, lonA, radius);
    const end = latLonToVector(latB, lonB, radius);

    target.push(
      start.x,
      start.y,
      start.z,
      end.x,
      end.y,
      end.z,
    );
  }
}
/**
 * Extract Polygon/MultiPolygon rings.
 */
function getFeatureRings(feature) {
  const geometry = feature?.geometry;

  if (!geometry?.coordinates) {
    return [];
  }

  if (geometry.type === "Polygon") {
    return geometry.coordinates;
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flat();
  }

  return [];
}

/**
 * Build one BufferGeometry for a complete GeoJSON dataset.
 *
 * Combining the boundaries into one geometry is substantially cheaper than
 * creating thousands of individual React/Three objects.
 */
function buildBoundaryGeometry(data, radius) {
  const positions = [];

  for (const feature of data?.features || []) {
    const rings = getFeatureRings(feature);

    for (const ring of rings) {
      appendRingPositions(positions, ring, radius);
    }
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );

  geometry.computeBoundingSphere();

  return geometry;
}

function GlobeBoundaryLayer({
  data,
  radius,
  opacity,
  color = "#79b7cd",
}) {
  const geometry = useMemo(() => {
    if (!data) {
      return null;
    }

    return buildBoundaryGeometry(data, radius);
  }, [data, radius]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) {
    return null;
  }

  return (
    <lineSegments geometry={geometry} renderOrder={5}>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

function GlobePoint({ point }) {
  const dotRef = useRef(null);

  useFrame(({ clock }) => {
    if (!dotRef.current) {
      return;
    }

    const pulse =
      1 +
      Math.sin(clock.getElapsedTime() * 3 + (point.phase || 0)) * 0.16;

    dotRef.current.scale.setScalar(pulse);
  });

  const position = latLonToVector(
    point.lat,
    point.lon,
    TRAFFIC_RADIUS,
  );

  const size = Math.max(
    0.025,
    Math.min(
      0.085,
      0.018 + Math.log2((point.count || 1) + 1) * 0.01,
    ),
  );

  const color = point.hot ? "#d9636b" : "#4fa8c9";
  const glow = point.hot ? "#d9636b" : "#7cc4e0";

  return (
    <group position={position}>
      <mesh ref={dotRef}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial
          color={color}
          toneMapped={false}
        />
      </mesh>

      <mesh scale={2.8}>
        <sphereGeometry args={[size, 12, 12]} />
        <meshBasicMaterial
          color={glow}
          transparent
          opacity={0.12}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function GlobeGridLine({ points }) {
  const geometry = useMemo(() => {
    const nextGeometry = new THREE.BufferGeometry();

    nextGeometry.setFromPoints(points);

    return nextGeometry;
  }, [points]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial
        color="#2a3542"
        transparent
        opacity={0.18}
      />
    </line>
  );
}

function GlobeScene({
  points,
  zoomDistance,
  onZoomDistanceChange,
}) {
  const globeRef = useRef(null);
  const controlsRef = useRef(null);

  const [hovered, setHovered] = useState(false);
  const [countries, setCountries] = useState(null);
  const [admin1, setAdmin1] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [admin1Loading, setAdmin1Loading] = useState(false);

  const admin1RequestedRef = useRef(false);

  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window
        .matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    [],
  );

  /**
   * Countries load immediately because this is the main globe layer.
   */
  useEffect(() => {
    let cancelled = false;

    async function loadCountries() {
      try {
        const response = await fetch(COUNTRY_DATA_URL, {
          cache: "force-cache",
        });

        if (!response.ok) {
          throw new Error(
            `countries.geojson returned HTTP ${response.status}`,
          );
        }

        const data = await response.json();

        if (!data || data.type !== "FeatureCollection") {
          throw new Error(
            "countries.geojson is not a valid GeoJSON FeatureCollection",
          );
        }

        if (!cancelled) {
          setCountries(data);
        }
      } catch (error) {
        console.error(
          "Helixon globe country data failed:",
          error,
        );

        if (!cancelled) {
          setGeoError(error);
        }
      }
    }

    loadCountries();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Admin-1 is much larger. Don't download/process it until the user
   * actually zooms in.
   */
  useEffect(() => {
    if (
      zoomDistance >= 6.25 ||
      admin1 ||
      admin1RequestedRef.current
    ) {
      return;
    }

    admin1RequestedRef.current = true;
    setAdmin1Loading(true);

    let cancelled = false;

    async function loadAdmin1() {
      try {
        const response = await fetch(ADMIN1_DATA_URL, {
          cache: "force-cache",
        });

        if (!response.ok) {
          throw new Error(
            `admin1.geojson returned HTTP ${response.status}`,
          );
        }

        const data = await response.json();

        if (!data || data.type !== "FeatureCollection") {
          throw new Error(
            "admin1.geojson is not a valid GeoJSON FeatureCollection",
          );
        }

        if (!cancelled) {
          setAdmin1(data);
        }
      } catch (error) {
        console.error(
          "Helixon globe Admin-1 data failed:",
          error,
        );

        if (!cancelled) {
          setGeoError(error);
        }
      } finally {
        if (!cancelled) {
          setAdmin1Loading(false);
        }
      }
    }

    loadAdmin1();

    return () => {
      cancelled = true;
    };
  }, [zoomDistance, admin1]);

  const latitudeLines = useMemo(() => {
    const lines = [];

    for (let lat = -60; lat <= 60; lat += 30) {
      const linePoints = [];

      for (let lon = -180; lon <= 180; lon += 4) {
        linePoints.push(
          latLonToVector(lat, lon, 2.005),
        );
      }

      lines.push(
        <GlobeGridLine
          key={`lat-${lat}`}
          points={linePoints}
        />,
      );
    }

    return lines;
  }, []);

  const longitudeLines = useMemo(() => {
    const lines = [];

    for (let lon = -150; lon <= 150; lon += 30) {
      const linePoints = [];

      for (let lat = -90; lat <= 90; lat += 4) {
        linePoints.push(
          latLonToVector(lat, lon, 2.005),
        );
      }

      lines.push(
        <GlobeGridLine
          key={`lon-${lon}`}
          points={linePoints}
        />,
      );
    }

    return lines;
  }, []);

  useFrame((_, delta) => {
    if (!globeRef.current || hovered || reduceMotion) {
      return;
    }

    globeRef.current.rotation.y += delta * 0.055;
  });

  function handleControlsChange() {
    const camera = controlsRef.current?.object;

    if (!camera) {
      return;
    }

    onZoomDistanceChange(camera.position.length());
  }

  const showAdmin1 = zoomDistance < 6.25;

  return (
    <>
      <group
        ref={globeRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        {/* Core Earth */}
        <mesh>
          <sphereGeometry args={[2, 128, 128]} />

          <meshStandardMaterial
            color="#141b24"
            roughness={0.9}
            metalness={0.05}
          />
        </mesh>

        {/* Very subtle atmospheric/wire detail */}
        <mesh scale={1.018}>
          <sphereGeometry args={[2, 96, 96]} />

          <meshBasicMaterial
            color="#4fa8c9"
            transparent
            opacity={0.04}
            side={THREE.BackSide}
            wireframe
            toneMapped={false}
          />
        </mesh>

        {/* Country borders */}
        {countries && (
          <GlobeBoundaryLayer
            data={countries}
            radius={COUNTRY_RADIUS}
            opacity={0.78}
            color="#6eb6d0"
          />
        )}

        {/* State / province borders */}
        <group visible={showAdmin1}>
          {admin1 && (
            <GlobeBoundaryLayer
              data={admin1}
              radius={ADMIN1_RADIUS}
              opacity={0.30}
              color="#508499"
            />
          )}
        </group>

        {latitudeLines}
        {longitudeLines}

        {(points || []).map((point, index) => (
          <GlobePoint
            key={`${point.label || "point"}-${index}`}
            point={point}
          />
        ))}

        <ambientLight intensity={0.35} />

        <pointLight
          position={[4, 3, 5]}
          intensity={8}
          distance={11}
          color="#4fa8c9"
        />

        <pointLight
          position={[-4, -2, -3]}
          intensity={2}
          distance={9}
          color="#e4e9ee"
        />
      </group>

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom
        minDistance={4.5}
        maxDistance={9}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
        onChange={handleControlsChange}
      />
    </>
  );
}

export function Globe({ points }) {
  const [height, setHeight] = useState(400);
  const [zoomDistance, setZoomDistance] = useState(6.6);

  useEffect(() => {
    function resize() {
      setHeight(window.innerWidth < 640 ? 300 : 400);
    }

    resize();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="globe-canvas">
      <Canvas
        dpr={[1, 2]}
        camera={{
          position: [0, 0, 6.6],
          fov: 42,
        }}
        style={{
          width: "100%",
          height,
        }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <color
          attach="background"
          args={["#0b0f14"]}
        />

        <Suspense fallback={null}>
          <GlobeScene
            points={points}
            zoomDistance={zoomDistance}
            onZoomDistanceChange={setZoomDistance}
          />
        </Suspense>
      </Canvas>
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




