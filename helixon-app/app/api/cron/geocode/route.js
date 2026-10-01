import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { cronAuthorized } from "@/lib/cron-auth";
import { geocode, normaliseLocation } from "@/lib/geocode";

// Places candidates on the map for radius search (lib/geocode.js): every
// candidate whose location hasn't been looked up yet - or has changed since
// (geocode_query no longer matches) - gets lat/lng. Each distinct place is
// looked up once (cached); up to MAX_PLACES new places per run.

const PAGE = 1000;
const ROW_CAP = 50000;
const MAX_PLACES = 400;

export const maxDuration = 300;

export async function GET(request) {
  if (!cronAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pending = new Map(); // normalised place -> [candidate ids]
  for (let from = 0; from < ROW_CAP; from += PAGE) {
    const { data, error } = await supabase
      .from("candidates")
      .select("id, location, geocode_query")
      .not("location", "is", null)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    for (const c of data ?? []) {
      const q = normaliseLocation(c.location);
      if (q === c.geocode_query) continue;
      if (!pending.has(q)) pending.set(q, []);
      pending.get(q).push(c.id);
    }
    if (!data || data.length < PAGE) break;
  }

  let placed = 0;
  let unplaced = 0;
  let places = 0;
  for (const [query, ids] of pending) {
    if (places >= MAX_PLACES) break;
    places += 1;
    const point = query ? await geocode(query) : null;
    for (let i = 0; i < ids.length; i += 200) {
      await supabase
        .from("candidates")
        .update({ lat: point?.lat ?? null, lng: point?.lng ?? null, geocoded_at: new Date().toISOString(), geocode_query: query })
        .in("id", ids.slice(i, i + 200));
    }
    if (point) placed += ids.length;
    else unplaced += ids.length;
  }
  return NextResponse.json({ ok: true, places, placed, unplaced, remainingPlaces: Math.max(0, pending.size - places) });
}
