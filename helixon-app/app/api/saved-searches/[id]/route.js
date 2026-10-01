import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanUuid } from "@/lib/sanitize";
import { cleanSavedSearch, toSavedSearch } from "@/lib/saved-searches";

// PATCH / DELETE one of your own saved searches.

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = cleanUuid((await params).id);
  const fields = cleanSavedSearch(await request.json().catch(() => ({})), { partial: true });
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  if (!id || Object.keys(fields).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  const { data, error } = await supabase
    .from("saved_searches")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("agency_id", auth.agencyId)
    .eq("user_id", auth.userId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Only the person who saved it can change it." }, { status: 404 });
  return NextResponse.json({ search: toSavedSearch(data, auth.userId) });
}

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = cleanUuid((await params).id);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await supabase.from("saved_searches").delete().eq("id", id).eq("agency_id", auth.agencyId).eq("user_id", auth.userId);
  if (error) return NextResponse.json({ error: "Failed to delete." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
