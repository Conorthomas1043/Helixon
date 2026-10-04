import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireCustomerContext } from "@/lib/customer-auth";
import { MERGE_FIELDS } from "@/lib/email-merge";
import { cleanTemplate, toTemplate } from "@/lib/email-templates";
import { inboundDomain } from "@/lib/tracked-email";
import { agencyDb } from "@/lib/agency-db";

// The agency's email templates (lib/email-merge.js for merge fields).
//
// GET                                          templates + the merge fields
// POST { name, audience?, subject, body }      create one

export async function GET() {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await (await agencyDb()).from("email_templates").select("*").eq("agency_id", auth.agencyId).order("name");
  if (error) return NextResponse.json({ error: "Failed to load templates." }, { status: 500 });
  return NextResponse.json({
    templates: (data ?? []).map(toTemplate),
    mergeFields: MERGE_FIELDS,
    // Whether replies are captured onto candidates' threads (lib/tracked-email.js).
    repliesCaptured: Boolean(inboundDomain() && process.env.RESEND_WEBHOOK_SECRET),
  });
}

export async function POST(request) {
  const auth = await requireCustomerContext();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const fields = cleanTemplate(await request.json().catch(() => ({})));
  if (fields.error) return NextResponse.json({ error: fields.error }, { status: 400 });
  const { data, error } = await (await agencyDb())
    .from("email_templates")
    .insert({ ...fields, agency_id: auth.agencyId, created_by: auth.userId })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: "Failed to save the template." }, { status: 500 });
  return NextResponse.json({ template: toTemplate(data) }, { status: 201 });
}
