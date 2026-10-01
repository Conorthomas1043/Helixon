import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanSavedSearch, toSavedSearch } from "@/lib/saved-searches";
import { applyFilters, readFilters, resolveFilters } from "@/lib/candidate-query";

// Saved Candidates searches (lib/saved-searches.js): your own plus ones
// teammates shared.
//
// GET ?counts=1           with how many candidates each matches now
// POST { name, params, shared?, alert? }

export async function GET(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await supabase
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
        const { count } = await applyFilters(supabase.from("candidates").select("id", { count: "exact", head: true }).eq("agency_id", auth.agencyId), resolved);
        s.count = count ?? 0;
      })
    );
  }
  return NextResponse.json({ searches });
}

export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const fields = cleanSavedSearch(await request.json().catch(() => ({})));
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({ ...fields, agency_id: auth.agencyId, user_id: auth.userId, last_alerted_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save the search." }, { status: 500 });
  return NextResponse.json({ search: toSavedSearch(data, auth.userId) }, { status: 201 });
}
