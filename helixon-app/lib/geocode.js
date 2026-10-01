// Turning a candidate's or a search's location into coordinates, for
// radius search. UK-only, via postcodes.io (free, no key): a postcode or
// outcode ("LS1 4AP", "LS1") is looked up exactly; anything else as a
// place name ("Leeds", "Hebden Bridge, West Yorkshire"). Results - found or
// not - are cached in geocode_cache so each place is only looked up once.

import { supabase } from "@/lib/supabase";

const POSTCODE_RE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})?$/i;
const MILE_KM = 1.609344;

export function normaliseLocation(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\b(united kingdom|uk|england|scotland|wales|northern ireland|great britain|gb)\b/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .slice(0, 200);
}

// Things that aren't a place - don't look them up.
export function isPlaceless(text) {
  return !text || /^(remote|anywhere|flexible|hybrid|wfh|home ?based|various|multiple|n\/a|na|tbc)$/i.test(text);
}

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Helixon recruitment software" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookup(query) {
  const compact = query.replace(/\s+/g, "").toUpperCase();
  const pc = query.toUpperCase().match(POSTCODE_RE);
  if (pc) {
    const data = pc[2]
      ? await fetchJson(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`)
      : await fetchJson(`https://api.postcodes.io/outcodes/${encodeURIComponent(compact)}`);
    const r = data?.result;
    if (r?.latitude != null) return { lat: r.latitude, lng: r.longitude };
  }
  // A place name: the first part ("Hebden Bridge, West Yorkshire" -> "Hebden Bridge").
  const place = query.split(",")[0].trim();
  if (place.length < 2) return null;
  const data = await fetchJson(`https://api.postcodes.io/places?q=${encodeURIComponent(place)}&limit=5`);
  const results = Array.isArray(data?.result) ? data.result : [];
  // Prefer an exact name match, and towns/cities over tiny places.
  const rank = { City: 0, Town: 1, "Suburban Area": 2, Village: 3, Hamlet: 4, Other: 5 };
  const exact = results.filter((r) => String(r.name_1 || "").toLowerCase() === place.toLowerCase());
  const best = (exact.length ? exact : results).sort((a, b) => (rank[a.local_type] ?? 5) - (rank[b.local_type] ?? 5))[0];
  return best?.latitude != null ? { lat: best.latitude, lng: best.longitude } : null;
}

// { lat, lng } or null. Never throws.
export async function geocode(text) {
  const query = normaliseLocation(text);
  if (isPlaceless(query) || query.length < 2) return null;
  const { data: cached } = await supabase.from("geocode_cache").select("lat, lng, found").eq("query", query).maybeSingle();
  if (cached) return cached.found ? { lat: cached.lat, lng: cached.lng } : null;
  const found = await lookup(query);
  await supabase.from("geocode_cache").upsert({ query, lat: found?.lat ?? null, lng: found?.lng ?? null, found: Boolean(found) });
  return found;
}

// A lat/lng box around a point - radius search filters on it in the
// database, then distanceMiles() checks the corners.
export function boundingBox({ lat, lng }, miles) {
  const km = miles * MILE_KM;
  const dLat = km / 111.32;
  const dLng = km / (111.32 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng };
}

export function distanceMiles(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(h))) / MILE_KM;
}
