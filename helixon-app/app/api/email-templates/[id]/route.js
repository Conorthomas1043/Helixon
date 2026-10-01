import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { cleanUuid } from "@/lib/sanitize";
import { cleanTemplate, toTemplate } from "@/lib/email-templates";

// PATCH / DELETE one of the agency's email templates.

export async function PATCH(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = cleanUuid((await params).id);
  const fields = cleanTemplate(await request.json().catch(() => ({})), { partial: true });
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  if (!id || Object.keys(fields).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  const { data, error } = await supabase
    .from("email_templates")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("agency_id", auth.agencyId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to save the template." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template: toTemplate(data) });
}

export async function DELETE(request, { params }) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = cleanUuid((await params).id);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await supabase.from("email_templates").delete().eq("id", id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to delete the template." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
