"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const NAV_ITEMS = [
  { id: "Command", label: "Command" },
  { id: "Traffic", label: "Traffic" },
  { id: "Users", label: "Users" },
  { id: "Employees", label: "Employees" },
  { id: "Billing", label: "Billing" },
];

const roles = [
  "super_admin",
  "admin",
  "sales",
  "support",
  "operations",
  "viewer",
  "employee",
];

const css = `
:root{
  color-scheme:dark;
  --bg:#0b0f14;
  --surface:#121821;
  --surface-raised:#182029;
  --border:#232b36;
  --border-soft:#1a212b;
  --text:#e4e9ee;
  --text-muted:#7c8a98;
  --text-faint:#4d5a67;
  --accent:#4fa8c9;
  --accent-soft:#152730;
  --accent-strong:#7cc4e0;
  --warn:#d8a657;
  --warn-soft:#241d10;
  --critical:#d9636b;
  --critical-soft:#241417;
  --ok:#5fae82;
  --ok-soft:#12241a;
  --radius-sm:6px;
  --radius-md:10px;
  --radius-lg:14px;
  --font-ui:-apple-system,BlinkMacSystemFont,"Segoe UI","Inter","Helvetica Neue",Arial,sans-serif;
  --font-mono:ui-monospace,"SFMono-Regular","IBM Plex Mono",Menlo,Consolas,"Liberation Mono",monospace;
}

*{box-sizing:border-box}

body{
  margin:0;
  font-family:var(--font-ui);
  background:var(--bg);
  color:var(--text);
  -webkit-font-smoothing:antialiased
}

button,input,select{font:inherit}

:focus-visible{
  outline:2px solid var(--accent);
  outline-offset:2px
}

.admin-shell{
  min-height:100vh;
  display:flex;
  background:var(--bg)
}

.sidebar{
  width:220px;
  flex-shrink:0;
  border-right:1px solid var(--border);
  background:var(--surface);
  display:flex;
  flex-direction:column;
  position:sticky;
  top:0;
  height:100vh
}

.brand-row{
  display:flex;
  align-items:center;
  gap:10px;
  padding:18px 18px 14px;
  border-bottom:1px solid var(--border)
}

.brand-mark{
  width:26px;
  height:26px;
  border-radius:7px;
  background:var(--accent-soft);
  border:1px solid var(--accent);
  color:var(--accent-strong);
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:700;
  font-size:13px;
  flex-shrink:0
}

.brand-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.brand-name{font-weight:600;font-size:14px;letter-spacing:.01em}
.brand-sub{font-size:11px;color:var(--text-muted)}

.status-row{
  display:flex;
  align-items:center;
  gap:7px;
  padding:12px 18px;
  border-bottom:1px solid var(--border);
  font-size:12px;
  color:var(--text-muted)
}

.status-dot{width:7px;height:7px;border-radius:99px;background:var(--ok);flex-shrink:0}

.side-nav{padding:10px;display:flex;flex-direction:column;gap:2px}

.side-link{
  display:flex;
  align-items:center;
  gap:9px;
  border:1px solid transparent;
  background:transparent;
  color:var(--text-muted);
  padding:9px 10px;
  border-radius:8px;
  cursor:pointer;
  font-size:13px;
  text-align:left
}

.side-link:hover{background:var(--surface-raised);color:var(--text)}

.side-link.active{
  background:var(--accent-soft);
  color:var(--accent-strong);
  border-color:rgba(79,168,201,.35)
}

.side-link-dot{width:5px;height:5px;border-radius:99px;background:currentColor;opacity:.55;flex-shrink:0}
.side-link.active .side-link-dot{opacity:1}

.sidebar-footer{margin-top:auto;padding:12px;border-top:1px solid var(--border)}

.logout{
  width:100%;
  border:1px solid var(--border);
  background:var(--surface-raised);
  color:var(--text-muted);
  padding:9px 10px;
  border-radius:8px;
  cursor:pointer;
  font-size:12px
}

.logout:hover{color:var(--text)}

.main-col{flex:1;min-width:0;display:flex;flex-direction:column}

.topbar{
  position:sticky;
  top:0;
  z-index:10;
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:10px;
  padding:12px 24px;
  border-bottom:1px solid var(--border);
  background:rgba(11,15,20,.9);
  backdrop-filter:blur(10px)
}

.topbar-time{color:var(--text-faint);font-size:12px;margin-right:auto}

.content{padding:26px 28px 40px;min-width:0}

.page-header{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:16px;
  flex-wrap:wrap;
  margin-bottom:22px
}

.page-heading h1{font-size:22px;font-weight:650;margin:0 0 5px;letter-spacing:-.01em}
.page-heading p{margin:0;color:var(--text-muted);font-size:13px;max-width:52ch}

.page-controls{display:flex;align-items:center;gap:8px;flex-wrap:wrap}

.btn{
  border:1px solid var(--border);
  background:var(--surface);
  color:var(--text);
  padding:9px 13px;
  border-radius:8px;
  cursor:pointer;
  font-size:13px
}

.btn:hover{background:var(--surface-raised)}
.btn.primary{border-color:var(--accent);color:var(--accent-strong);background:var(--accent-soft)}
.btn.danger{border-color:rgba(217,99,107,.5);color:var(--critical);background:var(--critical-soft)}
.btn.small{padding:6px 10px;font-size:12px}
.btn:disabled{opacity:.5;cursor:not-allowed}

.segmented{display:flex;border:1px solid var(--border);border-radius:8px;overflow:hidden}

.segmented button{
  border:0;
  background:var(--surface);
  color:var(--text-muted);
  padding:8px 12px;
  font-size:12px;
  cursor:pointer;
  border-right:1px solid var(--border)
}

.segmented button:last-child{border-right:0}
.segmented button.active{background:var(--accent-soft);color:var(--accent-strong)}

.kpi-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:22px}

.kpi-card{border:1px solid var(--border);background:var(--surface);border-radius:var(--radius-md);padding:16px}
.kpi-label{color:var(--text-muted);font-size:12px}
.kpi-value{font-size:26px;font-weight:650;margin-top:8px;font-variant-numeric:tabular-nums}

.panel{border:1px solid var(--border);background:var(--surface);border-radius:var(--radius-lg);padding:16px}
.panel-title{font-size:13px;font-weight:600;color:var(--text)}
.panel-sub{color:var(--text-muted);font-size:12px;margin-top:3px}

.section{margin-top:20px}
.section-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:10px}

.split{display:grid;grid-template-columns:1.35fr 1fr;gap:14px}

.globe-panel{min-height:440px;position:relative;overflow:hidden;padding:0}
.globe-overlay{position:absolute;left:18px;top:18px;z-index:2;pointer-events:none}
.globe-overlay .panel-title{color:var(--text)}

.globe-legend{
  position:absolute;
  right:18px;
  top:18px;
  z-index:2;
  display:flex;
  gap:12px;
  align-items:center;
  font-size:11px;
  color:var(--text-muted);
  pointer-events:none
}

.legend-item{display:flex;align-items:center;gap:5px}
.legend-dot{width:7px;height:7px;border-radius:50%}
.legend-ok{background:var(--ok)}
.legend-critical{background:var(--critical)}

.globe-canvas{width:100%;height:400px;display:block}

.table-wrap{overflow:auto;border:1px solid var(--border);border-radius:var(--radius-md);background:var(--surface)}
.table{width:100%;border-collapse:collapse;font-size:12.5px}

.table th,.table td{
  padding:11px 14px;
  border-bottom:1px solid var(--border-soft);
  text-align:left;
  vertical-align:top
}

.table th{color:var(--text-muted);font-weight:500;font-size:11.5px;position:sticky;top:0;background:var(--surface)}
.table tr:last-child td{border-bottom:0}
.table tr:hover td{background:var(--surface-raised)}

.mono{font-family:var(--font-mono);font-size:12px}
.muted{color:var(--text-muted)}
.mono-wrap{white-space:pre-wrap;word-break:break-word}

.pill{
  display:inline-flex;
  align-items:center;
  gap:5px;
  padding:3px 8px;
  border-radius:999px;
  border:1px solid var(--border);
  font-size:11px
}

.pill::before{content:"";width:5px;height:5px;border-radius:99px;background:currentColor}
.pill.bad{border-color:rgba(217,99,107,.4);color:var(--critical);background:var(--critical-soft)}
.pill.good{border-color:rgba(95,174,130,.4);color:var(--ok);background:var(--ok-soft)}
.pill.warn{border-color:rgba(216,166,87,.4);color:var(--warn);background:var(--warn-soft)}

.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.field{display:grid;gap:6px}
.field label{color:var(--text-muted);font-size:12px}

.field input,.field select{
  width:100%;
  padding:10px 11px;
  border:1px solid var(--border);
  border-radius:8px;
  background:var(--bg);
  color:var(--text)
}

.field input:focus,.field select:focus{border-color:var(--accent)}

.actions{display:flex;gap:7px;flex-wrap:wrap}
.empty{padding:34px 20px;text-align:center;color:var(--text-muted);font-size:13px}

.notice{
  border:1px solid var(--border);
  background:var(--surface-raised);
  padding:13px 14px;
  border-radius:10px;
  color:var(--text-muted);
  font-size:12.5px;
  line-height:1.5
}

.notice b{color:var(--text);font-weight:600}
.notice.error{border-color:rgba(217,99,107,.4);color:var(--critical);background:var(--critical-soft)}

.footer-note{margin-top:14px;color:var(--text-faint);font-size:11.5px;line-height:1.5}

@media(max-width:1000px){
  .kpi-grid{grid-template-columns:repeat(2,1fr)}
  .admin-shell{flex-direction:column}
  .sidebar{width:100%;height:auto;position:sticky;flex-direction:row;align-items:center;overflow-x:auto}
  .brand-row,.status-row,.sidebar-footer{display:none}
  .side-nav{flex-direction:row;padding:10px}
  .split{grid-template-columns:1fr}
}

@media(max-width:640px){
  .content{padding:16px}
  .kpi-grid,.form-grid{grid-template-columns:1fr}
  .topbar-time{display:none}
  .globe-canvas{height:300px}
  .globe-panel{min-height:340px}
  .page-header{align-items:flex-start}
}
`;

function PageHeader({ title, description, children }) {
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

function RangeControl({ range, setRange }) {
  return (
    <div className="segmented">
      {["24h", "7d", "30d"].map((item) => (
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

function KpiCard({ label, value, tone }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
    </div>
  );
}

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
      1 +
      Math.sin(clock.getElapsedTime() * 3 + (point.phase || 0)) * 0.16;

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

function Globe({ points }) {
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

function RequestTable({ rows, blockedSet, onBlock }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Source</th>
            <th>Request</th>
            <th>Location</th>
            <th>State</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan="6" className="empty">
                No request logs for this range — try a wider window.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id}>
                <td className="mono">
                  {row.ts ? new Date(row.ts).toLocaleString() : "—"}
                </td>

                <td>
                  <span className="mono">{row.ip || "—"}</span>
                  <div className="muted mono-wrap">{row.user_agent || ""}</div>
                </td>

                <td>
                  <b>{row.method || "GET"}</b>{" "}
                  <span className="mono">{row.path || "/"}</span>
                  <div className="muted">{row.referer || ""}</div>
                </td>

                <td>
                  {[row.city, row.country].filter(Boolean).join(", ") || "—"}
                </td>

                <td>
                  {row.blocked ? (
                    <span className="pill bad">Denied</span>
                  ) : (
                    <span className="pill good">Allowed</span>
                  )}
                </td>

                <td>
                  {row.ip && !row.blocked && !blockedSet.has(row.ip) ? (
                    <button
                      className="btn small danger"
                      onClick={() => onBlock(row.ip)}
                    >
                      Block
                    </button>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function CommandPage({
  totals,
  trafficRows,
  users,
  employees,
  blocked,
  globePoints,
  geolocatedEvents,
  blockedSet,
  onBlock,
  onUnblock,
  onOpenTraffic,
  range,
  setRange,
}) {
  return (
    <>
      <PageHeader
        title="Command"
        description="Live snapshot of traffic, users, and revenue health."
      >
        <RangeControl range={range} setRange={setRange} />
      </PageHeader>

      <div className="kpi-grid">
        <KpiCard
          label="Requests"
          value={totals.requests ?? trafficRows.length}
        />

        <KpiCard
          label="Blocked"
          value={
            totals.blocked ??
            trafficRows.filter((row) => row.blocked).length
          }
          tone="var(--critical)"
        />

        <KpiCard label="Users" value={totals.users ?? users.length} />

        <KpiCard
          label="Employees"
          value={employees.length}
          tone="var(--ok)"
        />
      </div>

      <div className="split section">
        <div className="panel globe-panel">
          <div className="globe-overlay">
            <div className="panel-title">Live geo traffic</div>
            <div className="panel-sub">Drag to rotate, scroll to zoom.</div>
            <div className="panel-sub">
              {geolocatedEvents} geolocated events plotted.
            </div>
          </div>

          <div className="globe-legend">
            <span className="legend-item">
              <span className="legend-dot legend-ok" /> Traffic
            </span>

            <span className="legend-item">
              <span className="legend-dot legend-critical" /> Hotspot
            </span>
          </div>

          <Globe points={globePoints} />
        </div>

        <div className="panel">
          <div className="panel-title">Security posture</div>

          <div className="section">
            <div className="notice">
              Raw response bodies are <b>not</b> stored. Request metadata,
              blocking state, and safe analytics stay available for triage
              without retaining CVs, tokens, credentials, or generated
              documents.
            </div>
          </div>

          <div className="section">
            <div className="panel-title">Blocked IPs</div>

            {blocked.length === 0 ? (
              <div className="empty">
                No blocked IPs — anything blocked from Traffic shows up here.
              </div>
            ) : (
              <div className="table-wrap" style={{ marginTop: 8 }}>
                <table className="table">
                  <tbody>
                    {blocked.slice(0, 8).map((item) => (
                      <tr key={item.ip}>
                        <td className="mono">{item.ip}</td>
                        <td className="muted">
                          {item.reason || "Admin block"}
                        </td>
                        <td>
                          <button
                            className="btn small"
                            onClick={() => onUnblock(item.ip)}
                          >
                            Unblock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <div className="panel-title">Recent requests</div>
          <button className="btn small" onClick={onOpenTraffic}>
            View traffic log
          </button>
        </div>

        <RequestTable
          rows={trafficRows.slice(0, 20)}
          blockedSet={blockedSet}
          onBlock={onBlock}
        />
      </section>
    </>
  );
}

function TrafficPage({ trafficRows, blockedSet, onBlock, range, setRange }) {
  return (
    <>
      <PageHeader
        title="Traffic"
        description="Inbound requests, blocking decisions, and IP-level detail."
      >
        <RangeControl range={range} setRange={setRange} />
      </PageHeader>

      <div className="section-head">
        <div className="muted">{trafficRows.length} rows</div>
      </div>

      <RequestTable
        rows={trafficRows}
        blockedSet={blockedSet}
        onBlock={onBlock}
      />
    </>
  );
}

function UsersPage({ users }) {
  return (
    <>
      <PageHeader title="Users" description="Everyone with a Helixon account.">
        <div className="muted">{users.length} loaded</div>
      </PageHeader>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Agency</th>
              <th>Plan</th>
              <th>State</th>
            </tr>
          </thead>

          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty">
                  No users yet.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.email}
                    <div className="muted mono">{user.id}</div>
                  </td>

                  <td>
                    {[user.firstName, user.lastName]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </td>

                  <td>{user.agency?.id || "—"}</td>
                  <td>{user.subscription?.plan || "—"}</td>

                  <td>
                    {user.bannedUntil ? (
                      <span className="pill bad">Banned</span>
                    ) : (
                      <span className="pill good">Active</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function EmployeesPage({
  employees,
  empForm,
  setEmpForm,
  onCreate,
  onAction,
  busy,
}) {
  return (
    <>
      <PageHeader title="Employees" description="Staff accounts and access levels." />

      <section className="panel">
        <div className="panel-title">Create employee</div>

        <form onSubmit={onCreate} className="section form-grid">
          <div className="field">
            <label>Username</label>
            <input
              value={empForm.username}
              onChange={(event) =>
                setEmpForm({ ...empForm, username: event.target.value })
              }
              required
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={empForm.password}
              onChange={(event) =>
                setEmpForm({ ...empForm, password: event.target.value })
              }
              minLength={8}
              required
            />
          </div>

          <div className="field">
            <label>Full name</label>
            <input
              value={empForm.fullName}
              onChange={(event) =>
                setEmpForm({ ...empForm, fullName: event.target.value })
              }
              required
            />
          </div>

          <div className="field">
            <label>Role</label>
            <select
              value={empForm.role}
              onChange={(event) =>
                setEmpForm({ ...empForm, role: event.target.value })
              }
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div className="actions">
            <button className="btn primary" disabled={busy}>
              Create
            </button>
          </div>
        </form>
      </section>

      <section className="section">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>State</th>
                <th>Last login</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty">
                    No employees yet.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      {employee.username}
                      <div className="muted">
                        {employee.full_name || employee.display_name}
                      </div>
                    </td>

                    <td>{employee.role}</td>

                    <td>
                      {employee.is_active ? (
                        <span className="pill good">Active</span>
                      ) : (
                        <span className="pill bad">Disabled</span>
                      )}
                    </td>

                    <td>
                      {employee.last_login
                        ? new Date(employee.last_login).toLocaleString()
                        : "Never"}
                    </td>

                    <td>
                      <div className="actions">
                        <button
                          className="btn small"
                          onClick={() =>
                            onAction(
                              employee.id,
                              employee.is_active ? "deactivate" : "activate",
                            )
                          }
                          disabled={busy}
                        >
                          {employee.is_active ? "Deactivate" : "Activate"}
                        </button>

                        <select
                          className="btn small"
                          value={employee.role}
                          onChange={(event) =>
                            onAction(employee.id, "set_role", {
                              role: event.target.value,
                            })
                          }
                          disabled={busy}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function BillingPage({ stats }) {
  return (
    <>
      <PageHeader
        title="Billing"
        description="Subscription and revenue status across all accounts."
      />

      <div className="kpi-grid">
        <KpiCard label="Active subs" value={stats?.subscriptions?.active ?? "—"} />
        <KpiCard label="Trial" value={stats?.subscriptions?.trialing ?? "—"} />
        <KpiCard
          label="Past due"
          value={stats?.subscriptions?.past_due ?? "—"}
          tone="var(--warn)"
        />
        <KpiCard
          label="Cancelled"
          value={stats?.subscriptions?.canceled ?? "—"}
          tone="var(--critical)"
        />
      </div>

      <div className="panel section">
        <div className="panel-title">Billing telemetry</div>
        <div className="footer-note">
          This view reads from the existing subscription and admin APIs — it
          never exposes Stripe secrets or payment credentials directly.
        </div>
      </div>
    </>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState("Command");
  const [range, setRange] = useState("24h");
  const [stats, setStats] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [users, setUsers] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [empForm, setEmpForm] = useState({
    username: "",
    password: "",
    fullName: "",
    role: "employee",
  });

  const load = useCallback(async () => {
    setError("");

    try {
      const [statsResponse, trafficResponse, usersResponse, employeesResponse] =
        await Promise.all([
          fetch(`/api/admin/stats?range=${range}`, { cache: "no-store" }).then(
            (r) => r.json(),
          ),
          fetch(`/api/admin/traffic?range=${range}`, {
            cache: "no-store",
          }).then((r) => r.json()),
          fetch(`/api/admin/users?perPage=100`, { cache: "no-store" }).then(
            (r) => r.json(),
          ),
          fetch(`/api/admin/employees`, { cache: "no-store" }).then((r) =>
            r.json(),
          ),
        ]);

      if (statsResponse.error) throw new Error(statsResponse.error);
      if (trafficResponse.error) throw new Error(trafficResponse.error);
      if (usersResponse.error) throw new Error(usersResponse.error);
      if (employeesResponse.error) throw new Error(employeesResponse.error);

      setStats(statsResponse);
      setTraffic(trafficResponse);
      setUsers(usersResponse.users || []);
      setEmployees(employeesResponse.employees || []);
    } catch (err) {
      setError(err?.message || "Failed to load admin data.");
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  async function employeeAction(employeeId, action, extra = {}) {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/employees", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employeeId, action, ...extra }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Employee action failed.");
      }

      await load();
    } catch (err) {
      setError(err?.message || "Employee action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function createEmployee(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(empForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Employee creation failed.");
      }

      setEmpForm({ username: "", password: "", fullName: "", role: "employee" });
      await load();
    } catch (err) {
      setError(err?.message || "Employee creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function block(ip) {
    const reason = window.prompt("Reason for blocking this IP:", "Admin block");

    if (reason === null) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/traffic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ip, reason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to block IP.");
      }

      await load();
    } catch (err) {
      setError(err?.message || "Failed to block IP.");
    } finally {
      setBusy(false);
    }
  }

  async function unblock(ip) {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/admin/traffic", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ip }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to unblock IP.");
      }

      await load();
    } catch (err) {
      setError(err?.message || "Failed to unblock IP.");
    } finally {
      setBusy(false);
    }
  }

  const totals = stats?.totals || {};
  const trafficRows = traffic?.rows || [];
  const blocked = traffic?.blockedIps || [];

  const blockedSet = useMemo(
    () => new Set(blocked.map((entry) => entry.ip)),
    [blocked],
  );

  const globePoints = useMemo(() => {
    const raw = (traffic?.globe || []).slice(0, 200);

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
  }, [traffic?.globe]);

  const geolocatedEvents = (traffic?.globe || []).reduce(
    (sum, item) => sum + Number(item.count || 0),
    0,
  );

  return (
    <>
      <style>{css}</style>

      <div className="admin-shell">
        <aside className="sidebar">
          <div className="brand-row">
            <div className="brand-mark">H</div>
            <div className="brand-text">
              <div className="brand-name">Helixon</div>
              <div className="brand-sub">Admin console</div>
            </div>
          </div>

          <div className="status-row">
            <span className="status-dot" />
            <span>Console connected</span>
          </div>

          <nav className="side-nav">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`side-link ${tab === item.id ? "active" : ""}`}
                onClick={() => setTab(item.id)}
              >
                <span className="side-link-dot" />
                {item.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-footer">
            <button
              className="logout"
              onClick={() => {
                window.location.href = "/api/admin/logout";
              }}
            >
              Log out
            </button>
          </div>
        </aside>

        <div className="main-col">
          <div className="topbar">
            <span className="topbar-time">{new Date().toLocaleString()}</span>
            <button className="btn small" onClick={load} disabled={busy}>
              Refresh
            </button>
          </div>

          <main className="content">
            {error && <div className="notice error section">{error}</div>}

            {tab === "Command" && (
              <CommandPage
                totals={totals}
                trafficRows={trafficRows}
                users={users}
                employees={employees}
                blocked={blocked}
                globePoints={globePoints}
                geolocatedEvents={geolocatedEvents}
                blockedSet={blockedSet}
                onBlock={block}
                onUnblock={unblock}
                onOpenTraffic={() => setTab("Traffic")}
                range={range}
                setRange={setRange}
              />
            )}

            {tab === "Traffic" && (
              <TrafficPage
                trafficRows={trafficRows}
                blockedSet={blockedSet}
                onBlock={block}
                range={range}
                setRange={setRange}
              />
            )}

            {tab === "Users" && <UsersPage users={users} />}

            {tab === "Employees" && (
              <EmployeesPage
                employees={employees}
                empForm={empForm}
                setEmpForm={setEmpForm}
                onCreate={createEmployee}
                onAction={employeeAction}
                busy={busy}
              />
            )}

            {tab === "Billing" && <BillingPage stats={stats} />}
          </main>
        </div>
      </div>
    </>
  );
}