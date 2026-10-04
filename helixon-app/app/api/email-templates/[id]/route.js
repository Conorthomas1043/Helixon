import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { customerRoute } from "@/lib/api/route";
import { JsonObject } from "@/lib/api/schemas";
import { cleanUuid } from "@/lib/sanitize";
import { cleanTemplate, toTemplate } from "@/lib/email-templates";
import { agencyDb } from "@/lib/agency-db";

// PATCH / DELETE one of the agency's email templates.

export const PATCH = customerRoute(async (request, { params }, auth, body) => {
  const id = cleanUuid((await params).id);
  const fields = cleanTemplate(body, { partial: true });
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  if (!id || Object.keys(fields).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  const { data, error } = await (await agencyDb())
    .from("email_templates")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("agency_id", auth.agencyId)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to save the template." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ template: toTemplate(data) });
}, { body: JsonObject, optionalBody: true });

export const DELETE = customerRoute(async (request, { params }, auth) => {
  const id = cleanUuid((await params).id);
  if (!id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await (await agencyDb()).from("email_templates").delete().eq("id", id).eq("agency_id", auth.agencyId);
  if (error) return NextResponse.json({ error: "Failed to delete the template." }, { status: 500 });
  return NextResponse.json({ ok: true });
});
