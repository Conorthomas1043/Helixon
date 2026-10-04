import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { cleanSavedSearch, toSavedSearch } from "@/lib/saved-searches";
import { applyFilters, readFilters, resolveFilters } from "@/lib/candidates/query";
import { agencyDb } from "@/lib/agency-db";

// Saved Candidates searches (lib/saved-searches.js): your own plus ones
// teammates shared.
//
// GET ?counts=1           with how many candidates each matches now
// POST { name, params, shared?, alert? }

export const GET = customerRoute(async (request, _context, auth) => {
  const { data, error } = await (await agencyDb())
    .from("saved_searches")
    .select("*")
    .eq("agency_id", auth.agencyId)
    .or(`user_id.eq."${auth.userId.replace(/"/g, "")}",shared.eq.true`)
    .order("name");
  if (error) return NextResponse.json({ error: "Failed to load saved searches." }, { status: 500 });
  const searches = (data ?? []).map((r) => toSavedSearch(r, auth.userId));

  if (new URL(request.url).searchParams.get("counts") === "1") {
    await Promise.all(
      searches.slice(0, 40).map(async (s) => {
        const { resolved, error: e } = await resolveFilters(auth.agencyId, readFilters(s.params));
        if (e) return;
        const { count } = await applyFilters((await agencyDb()).from("candidates").select("id", { count: "exact", head: true }).eq("agency_id", auth.agencyId), resolved);
        s.count = count ?? 0;
      })
    );
  }
  return NextResponse.json({ searches });
});

export const POST = customerRoute(async (request, _context, auth, body) => {
  const fields = cleanSavedSearch(body);
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  const { data, error } = await (await agencyDb())
    .from("saved_searches")
    .insert({ ...fields, agency_id: auth.agencyId, user_id: auth.userId, last_alerted_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save the search." }, { status: 500 });
  return NextResponse.json({ search: toSavedSearch(data, auth.userId) }, { status: 201 });
}, { body: JsonObject, optionalBody: true });
