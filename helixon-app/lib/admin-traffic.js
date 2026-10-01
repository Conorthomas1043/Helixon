// lib/admin-traffic.js
// Pure helpers for the admin traffic API and map (tested in
// lib/admin-traffic.test.js).

export const RANGE_HOURS = { "24h": 24, "7d": 168, "30d": 720, "90d": 2160 };

export function rangeHours(range) {
  return RANGE_HOURS[range] || 24;
}

// Vercel's x-vercel-ip-city header is URL-encoded ("Frankfurt%20am%20Main"),
// and that's how proxy.ts has been storing it. Decode for display; leave
// anything that isn't valid percent-encoding as it is.
export function decodePlace(value) {
  if (!value) return null;
  const s = String(value);
  if (!s.includes("%")) return s;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Map point from an admin_traffic_geo() row. */
export function geoPointFromRow(row) {
  const requests = Number(row.requests || 0);
  const blocked = Number(row.blocked || 0);
  return {
    city: decodePlace(row.city),
    country: row.country || null,
    lat: Number(row.lat),
    lon: Number(row.lon),
    count: requests,
    blocked,
    uniqueIps: Number(row.unique_ips || 0),
  };
}

/**
 * Fallback when the database functions aren't available: aggregate raw
 * request_logs rows into the same point shape (coordinates rounded to
 * 0.1 degree, like the SQL version). Returns { points, summary }.
 */
export function aggregateTrafficRows(rows) {
  const places = new Map();
  const ips = new Set();
  const countries = new Set();
  let blocked = 0;
  let geolocated = 0;

  for (const row of rows) {
    if (row.ip) ips.add(row.ip);
    if (row.country) countries.add(row.country);
    if (row.blocked) blocked += 1;
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    if (row.lat === null || row.lat === undefined || row.lon === null || row.lon === undefined) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    geolocated += 1;
    const rlat = Math.round(lat * 10) / 10;
    const rlon = Math.round(lon * 10) / 10;
    const key = `${row.country || ""}|${row.city || ""}|${rlat}|${rlon}`;
    const p = places.get(key) || { city: decodePlace(row.city), country: row.country || null, lat: rlat, lon: rlon, count: 0, blocked: 0, ips: new Set() };
    p.count += 1;
    if (row.blocked) p.blocked += 1;
    if (row.ip) p.ips.add(row.ip);
    places.set(key, p);
  }

  const points = [...places.values()]
    .map(({ ips: placeIps, ...p }) => ({ ...p, uniqueIps: placeIps.size }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 400);

  return {
    points,
    summary: { requests: rows.length, blocked, uniqueIps: ips.size, geolocated, countries: countries.size },
  };
}

/** 0..1 share of a point's requests that were blocked. */
export function blockedShare(point) {
  return point.count ? point.blocked / point.count : 0;
}

/** "Frankfurt am Main, DE" / "DE" / "Unknown location". */
export function placeLabel(point) {
  const parts = [point.city, point.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "Unknown location";
}
