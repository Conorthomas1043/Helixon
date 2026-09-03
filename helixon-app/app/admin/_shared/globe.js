"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function latLonToVector(lat, lon, radius = 2.02) {
  const phi = THREE.MathUtils.degToRad(lat);
  const theta = THREE.MathUtils.degToRad(lon + 90);

  return new THREE.Vector3(
    radius * Math.cos(phi) * Math.cos(theta),
    radius * Math.sin(phi),
    radius * Math.cos(phi) * Math.sin(theta),
  );
}

function GlobePoint({ point }) {
  const dotRef = useRef(null);

  useFrame(({ clock }) => {
    if (!dotRef.current) return;

    const pulse =
      1 + Math.sin(clock.getElapsedTime() * 3 + (point.phase || 0)) * 0.16;

    dotRef.current.scale.setScalar(pulse);
  });

  const position = latLonToVector(point.lat, point.lon, 2.06);

  const size = Math.max(
    0.025,
    Math.min(0.085, 0.018 + Math.log2((point.count || 1) + 1) * 0.01),
  );

  const color = point.hot ? "#d9636b" : "#4fa8c9";
  const glow = point.hot ? "#d9636b" : "#7cc4e0";

  return (
    <group position={position}>
      <mesh ref={dotRef}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={color} toneMapped={false} />
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
    const geometry = new THREE.BufferGeometry();
    geometry.setFromPoints(points);
    return geometry;
  }, [points]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#2a3542" transparent opacity={0.18} />
    </line>
  );
}

function GlobeScene({ points }) {
  const globeRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const latitudeLines = useMemo(() => {
    const lines = [];

    for (let lat = -60; lat <= 60; lat += 30) {
      const linePoints = [];

      for (let lon = -180; lon <= 180; lon += 4) {
        linePoints.push(latLonToVector(lat, lon, 2.005));
      }

      lines.push(<GlobeGridLine key={`lat-${lat}`} points={linePoints} />);
    }

    return lines;
  }, []);

  const longitudeLines = useMemo(() => {
    const lines = [];

    for (let lon = -150; lon <= 150; lon += 30) {
      const linePoints = [];

      for (let lat = -90; lat <= 90; lat += 4) {
        linePoints.push(latLonToVector(lat, lon, 2.005));
      }

      lines.push(<GlobeGridLine key={`lon-${lon}`} points={linePoints} />);
    }

    return lines;
  }, []);

  useFrame((_, delta) => {
    if (!globeRef.current || hovered || reduceMotion) {
      return;
    }

    globeRef.current.rotation.y += delta * 0.055;
  });

  return (
    <group
      ref={globeRef}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh>
        <sphereGeometry args={[2, 96, 96]} />
        <meshStandardMaterial color="#141b24" roughness={0.9} metalness={0.05} />
      </mesh>

      <mesh scale={1.018}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshBasicMaterial
          color="#4fa8c9"
          transparent
          opacity={0.04}
          side={THREE.BackSide}
          wireframe
          toneMapped={false}
        />
      </mesh>

      {latitudeLines}
      {longitudeLines}

      {(points || []).map((point, index) => (
        <GlobePoint key={`${point.label || "point"}-${index}`} point={point} />
      ))}

      <ambientLight intensity={0.35} />
      <pointLight position={[4, 3, 5]} intensity={8} distance={11} color="#4fa8c9" />
      <pointLight position={[-4, -2, -3]} intensity={2} distance={9} color="#e4e9ee" />
    </group>
  );
}

export function Globe({ points }) {
  const [height, setHeight] = useState(400);

  useEffect(() => {
    function resize() {
      setHeight(window.innerWidth < 640 ? 300 : 400);
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  return (
    <div className="globe-canvas">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0, 6.6], fov: 42 }}
        style={{ width: "100%", height }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#0b0f14"]} />

        <Suspense fallback={null}>
          <GlobeScene points={points} />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={4.5}
          maxDistance={9}
          rotateSpeed={0.55}
          zoomSpeed={0.7}
        />
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
          Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)),
      )
      .map((item, index) => ({
        ...item,
        count: Number(item.count || 1),
        phase: index * 0.33,
        hot: Number(item.count || 0) >= 10,
      }));
  }, [rawGlobe]);
}
